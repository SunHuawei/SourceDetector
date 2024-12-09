import * as esbuild from 'esbuild';
import fs from 'fs-extra';
import { resolve } from 'path';

const BUILD_DIR = 'dist';
const SRC_DIR = 'src';

async function build(isWatch = false) {
    console.log('🚀 Building extension...');

    try {
        // Build context for watch mode
        const ctx = await esbuild.context({
            entryPoints: {
                'background/index': resolve(SRC_DIR, 'background/index.ts'),
                'content/index': resolve(SRC_DIR, 'content/index.ts'),
                'popup/index': resolve(SRC_DIR, 'popup/index.tsx'),
                'pages/viewer/index': resolve(SRC_DIR, 'pages/viewer/index.tsx'),
                'pages/history/index': resolve(SRC_DIR, 'pages/history/index.tsx'),
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
                'process.env.NODE_ENV': '"production"'
            },
            assetNames: 'assets/[name]-[hash]',
            publicPath: '/',
            metafile: true,
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
            resolve(SRC_DIR, 'pages/viewer/index.html'),
            resolve(BUILD_DIR, 'pages/viewer/index.html')
        );
        await fs.copy(
            resolve(SRC_DIR, 'pages/history/index.html'),
            resolve(BUILD_DIR, 'pages/history/index.html')
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
                "**/*.woff2"
            ],
            "matches": ["<all_urls>"]
        }];

        await fs.writeFile(
            resolve(BUILD_DIR, 'manifest.json'),
            JSON.stringify(manifestContent, null, 2),
            'utf-8'
        );

        if (isWatch) {
            console.log('👀 Watching for changes...');
            await ctx.watch();
        } else {
            await ctx.rebuild();
            await ctx.dispose();
        }

        console.log('✅ Build completed successfully!');
    } catch (err) {
        console.error('❌ Build failed:', err);
        process.exit(1);
    }
}

// Handle watch mode
const isWatch = process.argv.includes('--watch');
build(isWatch); 