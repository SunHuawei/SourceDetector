import * as esbuild from 'esbuild';
import fs from 'fs-extra';
import { resolve } from 'path';
import sharp from 'sharp';
import archiver from 'archiver';
import { ArchiverError } from 'archiver';

const BUILD_DIR = 'dist';
const SRC_DIR = 'src';
const RULES_DIR = 'rules'; // Add this line

function formatDuration(duration: number): string {
    if (duration < 1000) {
        return `${duration}ms`;
    }
    return `${(duration / 1000).toFixed(2)}s`;
}

async function convertIcons() {
    const sizes = [16, 48, 128];
    const sourceIcon = resolve('public/icons/icon.svg');
    const targetDir = resolve(BUILD_DIR, 'icons');

    // Ensure icons directory exists
    await fs.ensureDir(targetDir);

    // Convert icons to all sizes
    await Promise.all(sizes.map(size =>
        sharp(sourceIcon)
            .resize(size, size)
            .toFile(resolve(targetDir, `icon-${size}.png`))
    ));

    console.log('📦 Generated icon files in different sizes');
}

async function build(isWatch = false, browser = 'chrome') {
    const startTime = Date.now();
    console.log(`🚀 Building extension for ${browser}...`);

    // Add Firefox-specific manifest modifications
    if (browser === 'firefox') {
        const manifestContent = JSON.parse(
            await fs.readFile(resolve('public', 'manifest.json'), 'utf-8')
        );

        // Firefox-specific changes
        manifestContent.browser_specific_settings = {
            "gecko": {
                "id": "source-detector@yourdomain.com",
                "strict_min_version": "109.0"
            }
        };

        // Firefox uses different API namespace
        manifestContent.background = {
            "scripts": ["background/index.js"],
            "type": "module"
        };

        await fs.writeFile(
            resolve(BUILD_DIR, 'manifest.json'),
            JSON.stringify(manifestContent, null, 2),
            'utf-8'
        );
    }

    // Add icon conversion before other build steps
    await convertIcons();

    // Copy rules directory to dist
    await fs.copy(RULES_DIR, resolve(BUILD_DIR, RULES_DIR));
    console.log(`📦 Copied ${RULES_DIR} to ${BUILD_DIR}`);

    try {
        // Build context for watch mode
        const ctx = await esbuild.context({
            entryPoints: {
                'background/index': resolve(SRC_DIR, 'background/index.ts'),
                'popup/index': resolve(SRC_DIR, 'popup/index.tsx'),
                'pages/settings/index': resolve(SRC_DIR, 'pages/settings/index.tsx'),
                'pages/desktop/index': resolve(SRC_DIR, 'pages/desktop/index.tsx'),
            },
            bundle: true,
            format: 'iife',
            outdir: BUILD_DIR,
            sourcemap: true,
            target: ['chrome88'],
            loader: {
                '.tsx': 'tsx',
                '.ts': 'ts',
                '.jsx': 'jsx',
                '.js': 'js',
                '.svg': 'file',
                '.png': 'file',
                '.css': 'css',
                '.ttf': 'file',
                '.woff': 'file',
                '.woff2': 'file',
                '.eot': 'file',
            },
            define: {
                'process.env.NODE_ENV': '"production"',
                'global': 'globalThis'
            },
            assetNames: 'assets/[name]-[hash]',
            publicPath: '/',
            metafile: true,
            logLevel: 'info'
        });

        // Copy static files
        await fs.copy('public', BUILD_DIR, {
            filter: (src) => !src.includes('manifest.json'),
            overwrite: true
        });

        // Copy HTML files
        await fs.copy(
            resolve(SRC_DIR, 'popup/index.html'),
            resolve(BUILD_DIR, 'popup/index.html')
        );
        await fs.copy(
            resolve(SRC_DIR, 'pages/settings/index.html'),
            resolve(BUILD_DIR, 'pages/settings/index.html')
        );
        await fs.copy(
            resolve(SRC_DIR, 'pages/desktop/index.html'),
            resolve(BUILD_DIR, 'pages/desktop/index.html')
        );

        // Read and modify manifest
        const manifestContent = JSON.parse(
            await fs.readFile(resolve('public', 'manifest.json'), 'utf-8')
        );

        // Add web_accessible_resources for fonts and other assets
        manifestContent.web_accessible_resources = [{
            "resources": [
                "assets/*",
                "assets/**/*",
                "*.js",
                "**/*.js",
                "**/*.css",
                "**/*.ttf",
                "**/*.woff",
                "**/*.woff2",
                "vs/*",
                "vs/**/*"
            ],
            "matches": ["<all_urls>"]
        }];

        await fs.writeFile(
            resolve(BUILD_DIR, 'manifest.json'),
            JSON.stringify(manifestContent, null, 2),
            'utf-8'
        );

        // Initial build
        const buildStart = Date.now();
        await ctx.rebuild();

        if (isWatch) {
            console.log('👀 Watching for changes...');

            // Start watching with rebuild callback
            await ctx.watch(async (error: Error | null, result: esbuild.BuildResult | null) => {
                const rebuildStart = Date.now();
                try {
                    await ctx.rebuild();
                    const duration = Date.now() - rebuildStart;
                    const now = new Date().toLocaleTimeString();
                    console.log(`🔄 [${now}] Rebuild completed successfully! (${formatDuration(duration)})`);
                } catch (e) {
                    console.error('❌ Rebuild failed:', error || e);
                }
            });
        } else {
            console.log('>>>>>>1 ')
            await ctx.dispose();
        }

        // Add zip creation after build
        if (!isWatch) {
            console.log('>>>>>>2')
            await createExtensionZip();
        }
        console.log('>>>>>>3 ')

        const duration = Date.now() - buildStart;
        console.log(`✅ Build completed successfully! (${formatDuration(duration)})`);
    } catch (err) {
        console.error('❌ Build failed:', err);
        process.exit(1);
    }
}

async function createExtensionZip() {
    const zipPath = resolve('dist/source-collector.zip');

    // Remove existing zip if it exists
    if (await fs.pathExists(zipPath)) {
        await fs.remove(zipPath);
    }

    return new Promise<void>((resolve, reject) => {
        const output = fs.createWriteStream(zipPath);
        const archive = archiver('zip', {
            zlib: { level: 9 } // Maximum compression
        });

        output.on('close', () => {
            console.log(`Extension packaged: ${archive.pointer()} bytes`);
            resolve();
        });

        archive.on('warning', function (err: ArchiverError) {
            if (err.code === 'ENOENT') {
                console.warn('Warning during zip creation:', err);
            } else {
                reject(err);
            }
        });

        archive.on('error', (err: ArchiverError) => {
            console.error('Error during zip creation:', err);
            reject(err);
        });

        archive.pipe(output);

        // Add the dist directory contents to the zip, excluding the zip file itself
        archive.glob('**/*', {
            cwd: BUILD_DIR,
            ignore: ['source-collector.zip']
        });

        archive.finalize();
    });
}

// Handle watch mode
const isWatch = process.argv.includes('--watch');
build(isWatch); 