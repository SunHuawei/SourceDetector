import assert from 'node:assert/strict';
import test from 'node:test';
import JSZip from 'jszip';
import {
    buildCrxFileTreeFromZip,
    getDefaultCrxCodeFilePath,
    getLanguageFromPath,
    isSourceLikePath,
    listCrxCodeFiles
} from './crxExplorer';

async function createZip() {
    const zip = new JSZip();
    zip.file('manifest.json', '{"manifest_version":3}');
    zip.file('src/background/index.ts', 'export const ok = true;');
    zip.file('src/popup/App.tsx', 'export function App() { return null; }');
    zip.file('dist/bundle.js', '(()=>{})()');
    zip.file('assets/icon.png', 'not-really-binary');
    return zip;
}

test('buildCrxFileTreeFromZip creates nested directory tree', async () => {
    const tree = await buildCrxFileTreeFromZip(await createZip());
    assert.ok(tree.children.src);
    assert.ok(tree.children.src.children.background);
    assert.ok(tree.children.src.children.popup);
    assert.ok(tree.children['manifest.json']);
});

test('listCrxCodeFiles returns source-like files with language hints', async () => {
    const tree = await buildCrxFileTreeFromZip(await createZip());
    const files = listCrxCodeFiles(tree);
    assert.deepEqual(
        files.map((file) => file.path),
        ['dist/bundle.js', 'src/background/index.ts', 'src/popup/App.tsx', 'manifest.json']
    );
    assert.equal(files.find((file) => file.path === 'src/popup/App.tsx')?.language, 'typescript');
});

test('getDefaultCrxCodeFilePath prefers src-like paths over compiled bundle', async () => {
    const tree = await buildCrxFileTreeFromZip(await createZip());
    const files = listCrxCodeFiles(tree);
    assert.equal(getDefaultCrxCodeFilePath(files), 'src/background/index.ts');
});

test('source-like path and language detection are extension-aware', () => {
    assert.equal(isSourceLikePath('src/app/main.tsx'), true);
    assert.equal(isSourceLikePath('assets/icon.png'), false);
    assert.equal(getLanguageFromPath('manifest.json'), 'json');
    assert.equal(getLanguageFromPath('styles/main.css'), 'css');
    assert.equal(getLanguageFromPath('README.unknown'), 'plaintext');
});
