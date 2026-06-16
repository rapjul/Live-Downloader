/* liveDownload */

/**
 * Wrap a picker function to prevent concurrent invocations that trigger
 * "File picker already active" browser errors.
 * @param {Function} originalFn - The original window picker function.
 * @returns {Function} The wrapped picker function.
 */
function wrapPickerPreventConcurrent(originalFn) {
  let activePromise = null;
  return function (...args) {
    if (activePromise) {
      console.warn('[liveDownload] Picker already active, reusing existing picker session.');
      return activePromise;
    }
    activePromise = originalFn.apply(this, args);
    activePromise.finally(() => {
      activePromise = null;
    });
    return activePromise;
  };
}

if (typeof window.showDirectoryPicker === 'function') {
  window.showDirectoryPicker = wrapPickerPreventConcurrent(window.showDirectoryPicker);
}
if (typeof window.showSaveFilePicker === 'function') {
  window.showSaveFilePicker = wrapPickerPreventConcurrent(window.showSaveFilePicker);
}
if (typeof window.showOpenFilePicker === 'function') {
  window.showOpenFilePicker = wrapPickerPreventConcurrent(window.showOpenFilePicker);
}

// Polyfill for browsers without native File System Access API (e.g. Brave, Firefox).

if (typeof self.showSaveFilePicker === 'undefined') {
  // Trigger a browser download from an OPFS file handle, then remove the OPFS entry.
  FileSystemFileHandle.prototype.download = async function () {
    const blob = await this.getFile();
    const objectURL = URL.createObjectURL(blob);

    const anchor = document.createElement('a');
    anchor.href = objectURL;
    // Strip the random prefix added by getFileHandle proxy below (format: "xxxxx - name")
    anchor.download = this.name.replace(/^[a-z0-9]+ - /, '');
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    setTimeout(() => {
      URL.revokeObjectURL(objectURL);
      navigator.storage.getDirectory().then(root => root.removeEntry(this.name)).catch(() => { });
    }, 200);
  };

  // Proxy getFileHandle to prepend a random prefix, ensuring OPFS filenames are unique
  // even when two recordings share the same base name.
  FileSystemDirectoryHandle.prototype.getFileHandle = new Proxy(
    FileSystemDirectoryHandle.prototype.getFileHandle,
    {
      apply(target, ctx, args) {
        const prefix = Math.random().toString(36).substring(2, 7);
        args[0] = `${prefix} - ${args[0]}`;
        return Reflect.apply(target, ctx, args);
      }
    }
  );

  // Polyfill showSaveFilePicker — creates a file in OPFS root.
  self.showSaveFilePicker = function (options = {}) {
    return navigator.storage.getDirectory().then(root =>
      root.getFileHandle(options.suggestedName || 'download', { create: true })
    );
  };
  self.showSaveFilePicker._polyfilled = true;

  // Polyfill showDirectoryPicker — returns OPFS root directory.
  self.showDirectoryPicker = function () {
    return navigator.storage.getDirectory();
  };
  self.showDirectoryPicker._polyfilled = true;
}
