import assert from 'node:assert/strict';
import test from 'node:test';
import { Page, PageSourceMap, SourceMapFile } from '../../types';
import {
    buildSourceExplorerDomains,
    getDomainGroupedFiles,
    resolveSourceExplorerSelection
} from './sourceExplorerData';

function createSourceMapFile(overrides: Partial<SourceMapFile>): SourceMapFile {
    return {
        id: overrides.id ?? 0,
        url: overrides.url ?? 'https://example.com/main.js',
        sourceMapUrl: overrides.sourceMapUrl ?? 'https://example.com/main.js.map',
        content: overrides.content ?? '{}',
        originalContent: overrides.originalContent ?? 'console.log("demo");',
        fileType: overrides.fileType ?? 'js',
        size: overrides.size ?? 128,
        timestamp: overrides.timestamp ?? 0,
        version: overrides.version ?? 1,
        hash: overrides.hash ?? `hash-${overrides.id ?? 0}`,
        isLatest: overrides.isLatest ?? true,
        findings: overrides.findings
    };
}

const pages: Page[] = [
    {
        id: 1,
        url: 'https://app.alpha.com/dashboard',
        title: 'Alpha Dashboard',
        timestamp: 1700010000000
    },
    {
        id: 2,
        url: 'https://beta.io/home',
        title: 'Beta Home',
        timestamp: 1700009000000
    },
    {
        id: 3,
        url: 'https://app.alpha.com/admin',
        title: 'Alpha Admin',
        timestamp: 1700008000000
    }
];

const pageSourceMaps: PageSourceMap[] = [
    { id: 1, pageId: 1, sourceMapId: 11, timestamp: 1700010000001 },
    { id: 2, pageId: 1, sourceMapId: 12, timestamp: 1700010000002 },
    { id: 3, pageId: 2, sourceMapId: 13, timestamp: 1700009000001 },
    { id: 4, pageId: 3, sourceMapId: 14, timestamp: 1700008000001 }
];

const sourceMapFiles: SourceMapFile[] = [
    createSourceMapFile({
        id: 11,
        url: 'https://cdn.alpha.com/main.js',
        sourceMapUrl: 'https://cdn.alpha.com/main.js.map',
        timestamp: 1700010000100,
        version: 2,
        findings: [
            {
                ruleId: 'token',
                ruleName: 'Token',
                matchedText: 'token-1',
                startIndex: 5,
                endIndex: 12,
                line: 1,
                column: 6
            },
            {
                ruleId: 'token',
                ruleName: 'Token',
                matchedText: 'token-2',
                startIndex: 20,
                endIndex: 27,
                line: 2,
                column: 3
            }
        ]
    }),
    createSourceMapFile({
        id: 12,
        url: 'https://cdn.alpha.com/vendor.js',
        sourceMapUrl: 'https://cdn.alpha.com/vendor.js.map',
        timestamp: 1700010000200,
        version: 1,
        findings: []
    }),
    createSourceMapFile({
        id: 13,
        url: 'https://cdn.beta.io/app.js',
        sourceMapUrl: 'https://cdn.beta.io/app.js.map',
        timestamp: 1700009000100,
        version: 1,
        findings: [
            {
                ruleId: 'secret',
                ruleName: 'Secret',
                matchedText: 'secret-value',
                startIndex: 1,
                endIndex: 13,
                line: 1,
                column: 2
            }
        ]
    }),
    createSourceMapFile({
        id: 14,
        url: 'https://cdn.alpha.com/main.js',
        sourceMapUrl: 'https://cdn.alpha.com/main.js.map',
        timestamp: 1700008000100,
        version: 1,
        findings: []
    })
];

test('buildSourceExplorerDomains groups pages by hostname and computes leak counts', () => {
    const domains = buildSourceExplorerDomains(pages, pageSourceMaps, sourceMapFiles);

    assert.equal(domains.length, 2);
    assert.equal(domains[0].hostname, 'app.alpha.com');
    assert.equal(domains[0].pages.length, 2);
    assert.equal(domains[0].leakCount, 2);
    assert.equal(domains[0].pages[0].title, 'Alpha Dashboard');
});

test('getDomainGroupedFiles returns only files for selected domain with merged versions', () => {
    const domains = buildSourceExplorerDomains(pages, pageSourceMaps, sourceMapFiles);
    const alphaGroups = getDomainGroupedFiles(domains, 'app.alpha.com');

    assert.equal(alphaGroups.length, 2);
    assert.equal(alphaGroups[0].url, 'https://cdn.alpha.com/main.js');
    assert.deepEqual(
        alphaGroups[0].versions.map((version) => version.id),
        [11, 14]
    );
});

test('resolveSourceExplorerSelection picks domain and file from sourceUrl deep link', () => {
    const domains = buildSourceExplorerDomains(pages, pageSourceMaps, sourceMapFiles);
    const selection = resolveSourceExplorerSelection(domains, {
        sourceUrl: 'https://cdn.beta.io/app.js'
    });

    assert.equal(selection.selectedDomainHostname, 'beta.io');
    assert.equal(selection.selectedGroupUrl, 'https://cdn.beta.io/app.js');
    assert.equal(selection.selectedFileId, 13);
});

test('resolveSourceExplorerSelection keeps explicit sourceMapFileId when available', () => {
    const domains = buildSourceExplorerDomains(pages, pageSourceMaps, sourceMapFiles);
    const selection = resolveSourceExplorerSelection(domains, {
        sourceMapFileId: 14
    });

    assert.equal(selection.selectedDomainHostname, 'app.alpha.com');
    assert.equal(selection.selectedGroupUrl, 'https://cdn.alpha.com/main.js');
    assert.equal(selection.selectedFileId, 14);
});
