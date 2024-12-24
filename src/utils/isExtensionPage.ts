export function isExtensionPage(url: string): boolean {
    return url.startsWith('https://chrome.google.com/webstore/detail/') ||
        url.startsWith('https://chromewebstore.google.com/detail/') ||
        url.startsWith('chrome-extension://');
}