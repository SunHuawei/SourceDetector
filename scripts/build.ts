import * as esbuild from 'esbuild';
import fs from 'fs-extra';
import { resolve } from 'path';

const BUILD_DIR = 'dist';
const SRC_DIR = 'src';
const RULES_DIR = 'rules'; // Add this line

function formatDuration(duration: number): string {
    if (duration < 1000) {
        return `${duration}ms`;
    }
    return `${(duration / 1000).toFixed(2)}s`;
}

async function build(isWatch = false) {
    const startTime = Date.now();
    console.log('🚀 Building extension...');

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
        const duration = Date.now() - buildStart;
        console.log(`✅ Build completed successfully! (${formatDuration(duration)})`);

        if (isWatch) {
            console.log('👀 Watching for changes...');

            // Start watching with rebuild callback
            await ctx.watch(async (error, result) => {
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
            await ctx.dispose();
        }
    } catch (err) {
        console.error('❌ Build failed:', err);
        process.exit(1);
    }
}

// Handle watch mode
const isWatch = process.argv.includes('--watch');
build(isWatch); 