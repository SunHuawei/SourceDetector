import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSourceCodeTree, buildCrxCodeTree, detectCodeLanguage, isTextLikeFile } from './sourceCodeTree';

test('buildSourceCodeTree builds nested tree from source map sources and contents', () => {
    const tree = buildSourceCodeTree([
        { path: 'src/main.ts', content: 'export const main = true;' },
        { path: 'src/components/App.tsx', content: 'export function App() { return null; }' },
        { path: '../package.json', content: '{"name":"demo"}' }
    ]);

    assert.equal(tree.children.length, 2);
    const src = tree.children.find((node) => node.name === 'src');
    assert.ok(src);
    assert.equal(src?.type, 'directory');
    const packageJson = tree.children.find((node) => node.name === 'package.json');
    assert.ok(packageJson);
    assert.equal(packageJson?.type, 'file');
});

test('buildCrxCodeTree builds nested tree from CRX file paths', () => {
    const tree = buildCrxCodeTree([
        { path: 'manifest.json', content: '{"manifest_version":3}' },
        { path: 'src/background/index.js', content: 'console.log("bg")' },
        { path: 'assets/icon.png', content: '' }
    ]);

    const src = tree.children.find((node) => node.name === 'src');
    assert.ok(src);
    assert.equal(src?.type, 'directory');
    const manifest = tree.children.find((node) => node.name === 'manifest.json');
    assert.ok(manifest);
    assert.equal(manifest?.type, 'file');
});

test('isTextLikeFile recognizes code/text formats and rejects binaries', () => {
    assert.equal(isTextLikeFile('src/main.ts'), true);
    assert.equal(isTextLikeFile('README.md'), true);
    assert.equal(isTextLikeFile('manifest.json'), true);
    assert.equal(isTextLikeFile('assets/icon.png'), false);
    assert.equal(isTextLikeFile('archive.zip'), false);
});

test('detectCodeLanguage returns stable lightweight language ids', () => {
    assert.equal(detectCodeLanguage('src/main.ts'), 'typescript');
    assert.equal(detectCodeLanguage('src/App.tsx'), 'tsx');
    assert.equal(detectCodeLanguage('styles/app.css'), 'css');
    assert.equal(detectCodeLanguage('manifest.json'), 'json');
    assert.equal(detectCodeLanguage('README.md'), 'markdown');
    assert.equal(detectCodeLanguage('unknown.bin'), 'plaintext');
});
