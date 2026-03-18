import assert from 'node:assert/strict';
import test from 'node:test';
import {
    CHROME_WEB_STORE_REVIEW_URL,
    CHROME_WEB_STORE_URL,
    GITHUB_FEEDBACK_URL,
    GITHUB_REPO_URL
} from './links';

test('feedback url points to GitHub issues', () => {
    assert.equal(GITHUB_FEEDBACK_URL, `${GITHUB_REPO_URL}/issues`);
});

test('rate us url points to Chrome Web Store reviews page', () => {
    assert.ok(CHROME_WEB_STORE_URL.includes('chromewebstore.google.com/detail/source-detector/'));
    assert.equal(CHROME_WEB_STORE_REVIEW_URL, `${CHROME_WEB_STORE_URL}/reviews`);
});
