import assert from 'node:assert/strict';
import test from 'node:test';
import {
    extractSourceMapUrlFromContent,
    getFileTypeFromUrl,
    isPageUrlCandidate,
    normalizePageUrl,
    pickResolvedPageContext
} from './pageContext';

test('normalizePageUrl strips hash but preserves query string', () => {
    assert.equal(
        normalizePageUrl('https://example.com/app?foo=1#section'),
        'https://example.com/app?foo=1'
    );
    assert.equal(
        normalizePageUrl('file:///tmp/demo.js#L10'),
        'file:///tmp/demo.js'
    );
});

test('extractSourceMapUrlFromContent reads the last sourceMappingURL from file trailer', () => {
    const content = [
        'console.log("demo")',
        '//# sourceMappingURL=old.js.map',
        '//# sourceMappingURL=main.js.map'
    ].join('\n');

    assert.equal(extractSourceMapUrlFromContent(content), 'main.js.map');
});

test('extractSourceMapUrlFromContent returns null when no trailer exists', () => {
    assert.equal(extractSourceMapUrlFromContent('console.log("demo")'), null);
});

test('isPageUrlCandidate accepts http/https/file and rejects extension pages and blanks', () => {
    assert.equal(isPageUrlCandidate('https://example.com/app.js'), true);
    assert.equal(isPageUrlCandidate('http://example.com/app.js'), true);
    assert.equal(isPageUrlCandidate('file:///tmp/demo.js'), true);
    assert.equal(isPageUrlCandidate('chrome-extension://abc123/popup/index.html'), false);
    assert.equal(isPageUrlCandidate(''), false);
});

test('getFileTypeFromUrl distinguishes css from js across query strings', () => {
    assert.equal(getFileTypeFromUrl('https://cdn.example.com/app.css?v=1'), 'css');
    assert.equal(getFileTypeFromUrl('https://cdn.example.com/app.js?v=1'), 'js');
    assert.equal(getFileTypeFromUrl('https://cdn.example.com/chunk.123'), 'js');
});

test('pickResolvedPageContext prefers tab context over document and initiator', () => {
    const result = pickResolvedPageContext(
        { pageUrl: 'https://app.example.com/dashboard#top', pageTitle: 'Dashboard', tabId: 7 },
        { pageUrl: 'https://app.example.com/document', pageTitle: 'Document' },
        { pageUrl: 'https://cdn.example.com' }
    );

    assert.deepEqual(result, {
        pageUrl: 'https://app.example.com/dashboard',
        pageTitle: 'Dashboard',
        tabId: 7
    });
});

test('pickResolvedPageContext falls back to document context when tab context is missing', () => {
    const result = pickResolvedPageContext(
        null,
        { pageUrl: 'https://docs.example.com/page#section', pageTitle: 'Docs' },
        { pageUrl: 'https://cdn.example.com' }
    );

    assert.deepEqual(result, {
        pageUrl: 'https://docs.example.com/page',
        pageTitle: 'Docs',
        tabId: undefined
    });
});

test('pickResolvedPageContext falls back to initiator context when stronger contexts are invalid', () => {
    const result = pickResolvedPageContext(
        { pageUrl: 'chrome-extension://abc123/popup/index.html', pageTitle: 'Popup', tabId: 3 },
        { pageUrl: '', pageTitle: 'Blank' },
        { pageUrl: 'https://app.example.com/home#frag', pageTitle: 'Home' }
    );

    assert.deepEqual(result, {
        pageUrl: 'https://app.example.com/home',
        pageTitle: 'Home',
        tabId: undefined
    });
});

test('pickResolvedPageContext returns null when all candidates are unusable', () => {
    const result = pickResolvedPageContext(
        { pageUrl: 'chrome-extension://abc123/popup/index.html', pageTitle: 'Popup', tabId: 1 },
        { pageUrl: 'moz-extension://def456/options.html', pageTitle: 'Options' },
        null
    );

    assert.equal(result, null);
});
