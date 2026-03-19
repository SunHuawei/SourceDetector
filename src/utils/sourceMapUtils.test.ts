import assert from 'node:assert/strict';
import test from 'node:test';
import { SourceMapFileSummary } from '../types';
import {
  buildSourceMapDirectoryTree,
  getSourceMapDirectorySegments,
  getSourceMapFileName,
  groupSourceMapFiles,
} from './sourceMapUtils';

function createSourceMapSummary(overrides: Partial<SourceMapFileSummary>): SourceMapFileSummary {
  return {
    id: overrides.id ?? 0,
    url: overrides.url ?? 'https://cdn.example.com/main.js',
    sourceMapUrl: overrides.sourceMapUrl ?? 'https://cdn.example.com/main.js.map',
    fileType: overrides.fileType ?? 'js',
    size: overrides.size ?? 100,
    timestamp: overrides.timestamp ?? 0,
    version: overrides.version ?? 1,
    hash: overrides.hash ?? `hash-${overrides.id ?? 0}`,
    isLatest: overrides.isLatest ?? true,
    findings: overrides.findings ?? [],
  };
}

test('buildSourceMapDirectoryTree creates host/path/file hierarchy', () => {
  const groupedFiles = groupSourceMapFiles([
    createSourceMapSummary({
      id: 1,
      url: 'https://cdn.example.com/static/js/app.js',
      version: 2,
    }),
    createSourceMapSummary({
      id: 2,
      url: 'https://cdn.example.com/static/js/vendor.js',
      version: 1,
    }),
    createSourceMapSummary({
      id: 3,
      url: 'https://assets.example.com/main.js',
      version: 1,
    }),
  ]);

  const tree = buildSourceMapDirectoryTree(groupedFiles, { idPrefix: 'test:' });

  assert.equal(tree.length, 2);
  assert.equal(tree[0].name, 'assets.example.com');
  assert.equal(tree[1].name, 'cdn.example.com');

  const cdnHostNode = tree[1];
  assert.equal(cdnHostNode.directories[0].name, 'static');
  assert.equal(cdnHostNode.directories[0].directories[0].name, 'js');
  assert.deepEqual(
    cdnHostNode.directories[0].directories[0].files.map(file => file.name),
    ['app.js', 'vendor.js']
  );
});

test('source map path helpers normalize URLs and keep filename', () => {
  assert.deepEqual(
    getSourceMapDirectorySegments('https://cdn.example.com/app/main.js?v=1#hash'),
    ['cdn.example.com', 'app']
  );
  assert.equal(getSourceMapFileName('https://cdn.example.com/app/main.js?v=1#hash'), 'main.js');
});
