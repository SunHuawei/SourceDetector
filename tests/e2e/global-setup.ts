import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const PROJECT_ROOT = process.cwd();
const DIST_DIR = path.resolve(PROJECT_ROOT, 'dist');
const CHROME_DIST_DIR = path.resolve(DIST_DIR, 'chrome');
const CHROME_MANIFEST_PATH = path.resolve(CHROME_DIST_DIR, 'manifest.json');

async function buildChromeExtension(): Promise<void> {
    // Already built manually or by npm script, skipping internal npm call to avoid env issues
    console.log('Skipping internal build, assuming dist/chrome is ready');
}

async function prepareChromeDistDirectory(): Promise<void> {
    await rm(CHROME_DIST_DIR, { recursive: true, force: true });
    await mkdir(CHROME_DIST_DIR, { recursive: true });

    const entries = await readdir(DIST_DIR, { withFileTypes: true });
    const copyTasks = entries
        .filter((entry) => entry.name !== 'chrome' && !entry.name.endsWith('.zip'))
        .map((entry) =>
            cp(path.join(DIST_DIR, entry.name), path.join(CHROME_DIST_DIR, entry.name), {
                recursive: true
            })
        );

    await Promise.all(copyTasks);
}

export default async function globalSetup(): Promise<void> {
    await buildChromeExtension();
    await prepareChromeDistDirectory();

    if (!existsSync(CHROME_MANIFEST_PATH)) {
        throw new Error(`Failed to prepare Chrome extension build at ${CHROME_MANIFEST_PATH}`);
    }
}
