import assert from 'node:assert/strict';
import test from 'node:test';
import { CrxFile } from '../../types';
import {
    buildCrxPackageGroups,
    findCrxPackageGroupByLookupUrl,
    findCrxPackageGroupByRecordId
} from './sourceExplorerCrxData';

function createCrxFile(overrides: Partial<CrxFile>): CrxFile {
    const blob = overrides.blob ?? new Blob(['crx-data'], { type: 'application/octet-stream' });
    return {
        id: overrides.id ?? 0,
        pageUrl: overrides.pageUrl ?? '',
        pageTitle: overrides.pageTitle ?? 'Demo',
        crxUrl: overrides.crxUrl ?? '',
        blob,
        size: overrides.size ?? blob.size,
        timestamp: overrides.timestamp ?? Date.now(),
        count: overrides.count ?? 1,
        contentHash: overrides.contentHash ?? `hash-${overrides.id ?? 0}`
    };
}

test('buildCrxPackageGroups groups chrome web store captures by extension id', () => {
    const records = [
        createCrxFile({
            id: 1,
            pageUrl: 'https://chromewebstore.google.com/detail/source-detector/aioimldmpakibclgckpdfpfkadbflfkn?hl=en',
            crxUrl: 'https://clients2.google.com/service/update2/crx?response=redirect&id=aioimldmpakibclgckpdfpfkadbflfkn',
            timestamp: 1000
        }),
        createCrxFile({
            id: 2,
            pageUrl: 'https://chromewebstore.google.com/detail/source-detector/aioimldmpakibclgckpdfpfkadbflfkn?hl=zh-CN',
            crxUrl: 'https://clients2.google.com/service/update2/crx?response=redirect&id=aioimldmpakibclgckpdfpfkadbflfkn',
            timestamp: 2000
        }),
        createCrxFile({
            id: 3,
            pageUrl: 'https://chrome.google.com/webstore/detail/source-detector/aioimldmpakibclgckpdfpfkadbflfkn',
            crxUrl: 'https://clients2.google.com/service/update2/crx?response=redirect&id=aioimldmpakibclgckpdfpfkadbflfkn',
            timestamp: 1500
        }),
        createCrxFile({
            id: 4,
            pageUrl: 'https://chromewebstore.google.com/detail/other-extension/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
            crxUrl: 'https://clients2.google.com/service/update2/crx?response=redirect&id=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
            timestamp: 1200
        })
    ];

    const groups = buildCrxPackageGroups(records);

    assert.equal(groups.length, 2);
    const sourceDetectorGroup = groups.find(group => group.packageId === 'aioimldmpakibclgckpdfpfkadbflfkn');
    assert.ok(sourceDetectorGroup);
    assert.equal(sourceDetectorGroup?.records.length, 3);
    assert.deepEqual(sourceDetectorGroup?.records.map(record => record.id), [2, 3, 1]);
});

test('buildCrxPackageGroups falls back to normalized page path for non-extension URLs', () => {
    const records = [
        createCrxFile({
            id: 1,
            pageUrl: 'https://example.com/store/package?ref=a',
            crxUrl: 'https://example.com/files/package.crx',
            timestamp: 1000
        }),
        createCrxFile({
            id: 2,
            pageUrl: 'https://example.com/store/package?ref=b',
            crxUrl: 'https://example.com/files/package.crx',
            timestamp: 2000
        }),
        createCrxFile({
            id: 3,
            pageUrl: 'https://example.com/store/other-package?ref=c',
            crxUrl: 'https://example.com/files/other.crx',
            timestamp: 1500
        })
    ];

    const groups = buildCrxPackageGroups(records);
    assert.equal(groups.length, 2);
    assert.equal(groups[0].records.length, 2);
    assert.equal(groups[0].canonicalPageUrl, 'https://example.com/store/package');
});

test('findCrxPackageGroup helpers resolve by record id and URL variants', () => {
    const records = [
        createCrxFile({
            id: 11,
            pageUrl: 'https://chromewebstore.google.com/detail/source-detector/aioimldmpakibclgckpdfpfkadbflfkn?hl=en',
            crxUrl: 'https://clients2.google.com/service/update2/crx?response=redirect&id=aioimldmpakibclgckpdfpfkadbflfkn',
            timestamp: 1000
        }),
        createCrxFile({
            id: 12,
            pageUrl: 'https://chromewebstore.google.com/detail/source-detector/aioimldmpakibclgckpdfpfkadbflfkn?hl=zh-CN',
            crxUrl: 'https://clients2.google.com/service/update2/crx?response=redirect&id=aioimldmpakibclgckpdfpfkadbflfkn',
            timestamp: 2000
        })
    ];

    const groups = buildCrxPackageGroups(records);
    const byRecordId = findCrxPackageGroupByRecordId(groups, 11);
    const byLookupUrl = findCrxPackageGroupByLookupUrl(
        groups,
        'https://chromewebstore.google.com/detail/source-detector/aioimldmpakibclgckpdfpfkadbflfkn?hl=fr'
    );

    assert.ok(byRecordId);
    assert.ok(byLookupUrl);
    assert.equal(byRecordId?.key, byLookupUrl?.key);
});
