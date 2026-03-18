import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveSourceExplorerSelection } from './sourceExplorerData';

test('resolveSourceExplorerSelection returns empty selection for empty domains', () => {
    const selection = resolveSourceExplorerSelection([], {});

    assert.deepEqual(selection, {
        selectedDomainHostname: null,
        selectedPageId: null,
        selectedGroupUrl: null,
        selectedFileId: null
    });
});
