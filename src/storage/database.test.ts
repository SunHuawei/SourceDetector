import assert from 'node:assert/strict';
import test from 'node:test';
import 'fake-indexeddb/auto';
import { SourceDetectorDB } from './database';

function createDb(name: string): SourceDetectorDB {
    const db = new SourceDetectorDB();
    db.close();
    db.name = name;
    db.open();
    return db;
}

test('getPageFiles de-duplicates repeated page/sourceMap relations', async (t) => {
    const db = createDb(`SourceDetectorDB-test-${Date.now()}`);

    t.after(async () => {
        await db.delete();
    });

    const page = await db.addPage({
        url: 'https://example.com/dashboard',
        title: 'Dashboard',
        timestamp: 1
    });

    const sourceMap = await db.addSourceMapFile({
        url: 'https://cdn.example.com/main.js',
        sourceMapUrl: 'https://cdn.example.com/main.js.map',
        content: '{}',
        originalContent: 'console.log("demo")',
        fileType: 'js',
        size: 128,
        timestamp: 2,
        version: 1,
        hash: 'hash-1',
        isLatest: true,
        findings: []
    });

    await db.addPageSourceMap({ pageId: page.id, sourceMapId: sourceMap.id, timestamp: 3 });
    await db.addPageSourceMap({ pageId: page.id, sourceMapId: sourceMap.id, timestamp: 4 });

    const files = await db.getPageFiles('https://example.com/dashboard');

    assert.equal(files.length, 1);
    assert.equal(files[0].id, sourceMap.id);
});

test('getCrxFileByCrxUrl resolves stored CRX record by package url', async (t) => {
    const db = createDb(`SourceDetectorDB-test-${Date.now()}-crx`);

    t.after(async () => {
        await db.delete();
    });

    const blob = new Blob(['demo-crx'], { type: 'application/octet-stream' });
    await db.addCrxFile({
        pageUrl: 'https://chromewebstore.google.com/detail/source-detector/aioimldmpakibclgckpdfpfkadbflfkn',
        pageTitle: 'Source Detector',
        crxUrl: 'https://clients2.google.com/service/update2/crx?response=redirect&prodversion=130.0&id=aioimldmpakibclgckpdfpfkadbflfkn',
        blob,
        size: blob.size,
        timestamp: Date.now(),
        count: 1,
        contentHash: 'hash-crx'
    });

    const found = await db.getCrxFileByCrxUrl('https://clients2.google.com/service/update2/crx?response=redirect&prodversion=130.0&id=aioimldmpakibclgckpdfpfkadbflfkn');
    assert.ok(found);
    assert.equal(found?.pageTitle, 'Source Detector');
});

test('addSourceMapToPage does not create duplicate relation for same page and sourceMap', async (t) => {
    const db = createDb(`SourceDetectorDB-test-${Date.now()}-2`);

    t.after(async () => {
        await db.delete();
    });

    const sourceMap = await db.addSourceMapFile({
        url: 'https://cdn.example.com/app.js',
        sourceMapUrl: 'https://cdn.example.com/app.js.map',
        content: '{}',
        originalContent: 'console.log("demo")',
        fileType: 'js',
        size: 256,
        timestamp: 2,
        version: 1,
        hash: 'hash-2',
        isLatest: true,
        findings: []
    });

    await db.addSourceMapToPage('https://example.com/app', 'App', sourceMap);
    await db.addSourceMapToPage('https://example.com/app', 'App', sourceMap);

    const pages = await db.pages.toArray();
    const relations = await db.pageSourceMaps.toArray();

    assert.equal(pages.length, 1);
    assert.equal(relations.length, 1);
    assert.equal(relations[0].sourceMapId, sourceMap.id);
});

test('getPageFileSummaries omits heavy source content fields for popup list rendering', async (t) => {
    const db = createDb(`SourceDetectorDB-test-${Date.now()}-summaries`);

    t.after(async () => {
        await db.delete();
    });

    const sourceMap = await db.addSourceMapFile({
        url: 'https://cdn.example.com/large.js',
        sourceMapUrl: 'https://cdn.example.com/large.js.map',
        content: '{"huge":true}',
        originalContent: 'console.log("very large original source")',
        fileType: 'js',
        size: 4096,
        timestamp: 3,
        version: 2,
        hash: 'hash-3',
        isLatest: true,
        findings: [{
            ruleId: 'demo',
            ruleName: 'Demo Finding',
            matchedText: 'secret',
            line: 1,
            column: 1,
            startIndex: 0,
            endIndex: 6,
            contextLines: []
        }]
    });

    await db.addSourceMapToPage('https://example.com/heavy', 'Heavy', sourceMap);

    const summaries = await db.getPageFileSummaries('https://example.com/heavy');

    assert.equal(summaries.length, 1);
    assert.equal(summaries[0].url, sourceMap.url);
    assert.ok(!('content' in summaries[0]));
    assert.ok(!('originalContent' in summaries[0]));
});
