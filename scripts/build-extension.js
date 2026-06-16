#!/usr/bin/env node

/**
 * @fileoverview Build script to package liveDownload extension for Chrome and Firefox.
 * Uses native Node.js libraries to copy files, adjust manifest settings, and zip directories.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SOURCE_DIR = path.join(__dirname, '..', 'liveDownload');
const DIST_DIR = path.join(__dirname, '..', 'dist');
const TEMP_CHROME_DIR = path.join(DIST_DIR, 'chrome-temp');
const TEMP_FIREFOX_DIR = path.join(DIST_DIR, 'firefox-temp');

/**
 * Recursively copies a directory while filtering out unwanted files.
 * @param {string} src - The source directory path.
 * @param {string} dest - The destination directory path.
 * @returns {void}
 */
function copyDir(src, dest) {
	fs.cpSync(src, dest, {
		recursive: true,
		filter: (srcPath) => {
			const basename = path.basename(srcPath);
			// Exclude exact matches
			if (['liveDownload.zip', 'dist', 'scripts'].includes(basename)) {
				return false;
			}
			// Exclude any ZIP files
			if (basename.toLowerCase().endsWith('.zip')) {
				return false;
			}
			// Exclude hidden items (starting with .) and items starting with underscore (_)
			if (basename.startsWith('.') || basename.startsWith('_')) {
				return false;
			}
			return true;
		}
	});
}

/**
 * Modifies the manifest.json file for Firefox compatibility.
 * Specifically converts service_worker background script to standard background scripts array.
 * @param {string} manifestPath - Path to the manifest.json file to be modified.
 * @returns {void}
 */
function adaptManifestForFirefox(manifestPath) {
	const manifestContent = fs.readFileSync(manifestPath, 'utf8');
	const manifest = JSON.parse(manifestContent);

	if (manifest.background && manifest.background.service_worker) {
		const serviceWorkerScript = manifest.background.service_worker;
		delete manifest.background.service_worker;
		manifest.background.scripts = [serviceWorkerScript];
	}

	fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
}

/**
 * Zips the content of a directory into a zip archive.
 * @param {string} targetDir - The directory whose contents should be zipped.
 * @param {string} zipPath - The output path of the zip file.
 * @returns {void}
 */
function zipDirectory(targetDir, zipPath) {
	// Remove pre-existing zip if it exists
	if (fs.existsSync(zipPath)) {
		fs.unlinkSync(zipPath);
	}

	// Run zip command from within the target directory to avoid nested root folder structure in zip
	execSync(`zip -r "${zipPath}" . -x "*.DS_Store"`, {
		cwd: targetDir,
		stdio: 'inherit'
	});
}

/**
 * Main execution function of the build script.
 * Coordinates copying, modifications, zipping, and cleanup.
 * @returns {void}
 */
function main() {
	try {
		console.log('🚀 Starting extension packaging...');

		// Ensure dist directory exists
		fs.mkdirSync(DIST_DIR, { recursive: true });

		// Clean up any remaining temporary build directories from previous runs
		fs.rmSync(TEMP_CHROME_DIR, { recursive: true, force: true });
		fs.rmSync(TEMP_FIREFOX_DIR, { recursive: true, force: true });

		// 1. Prepare Chrome/Edge build
		console.log('📦 Preparing Chrome/Edge build...');
		copyDir(SOURCE_DIR, TEMP_CHROME_DIR);
		const chromeZipPath = path.join(DIST_DIR, 'liveDownload-chromium.zip');
		zipDirectory(TEMP_CHROME_DIR, chromeZipPath);
		console.log(`✅ Chrome/Edge package created: ${chromeZipPath}`);

		// 2. Prepare Firefox build
		console.log('🦊 Preparing Firefox build...');
		copyDir(SOURCE_DIR, TEMP_FIREFOX_DIR);
		const firefoxManifestPath = path.join(TEMP_FIREFOX_DIR, 'manifest.json');
		adaptManifestForFirefox(firefoxManifestPath);
		const firefoxZipPath = path.join(DIST_DIR, 'liveDownload-firefox.xpi');
		zipDirectory(TEMP_FIREFOX_DIR, firefoxZipPath);
		console.log(`✅ Firefox package created: ${firefoxZipPath}`);

		// 3. Cleanup temporary folders
		console.log('🧹 Cleaning up temporary build directories...');
		fs.rmSync(TEMP_CHROME_DIR, { recursive: true, force: true });
		fs.rmSync(TEMP_FIREFOX_DIR, { recursive: true, force: true });

		console.log('🎉 Build completed successfully!');
		process.exit(0);
	} catch (error) {
		console.error('❌ Build failed:', error);
		process.exit(1);
	}
}

main();
