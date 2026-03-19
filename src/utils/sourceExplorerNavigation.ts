import { browserAPI } from '@/utils/browser-polyfill';

export type SourceExplorerTab = 'overview' | 'source-maps' | 'crx-packages';

export interface OpenSourceExplorerOptions {
    tab?: SourceExplorerTab;
    pageUrl?: string;
    sourceUrl?: string;
    sourceMapFileId?: number;
    view?: string;
}

function setOptionalQueryParam(params: URLSearchParams, key: string, value: unknown) {
    if (typeof value === 'string' && value.trim().length > 0) {
        params.set(key, value);
        return;
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
        params.set(key, String(value));
    }
}

export function buildSourceExplorerUrl(options: OpenSourceExplorerOptions = {}): string {
    const queryParams = new URLSearchParams();

    setOptionalQueryParam(queryParams, 'tab', options.tab ?? 'overview');
    setOptionalQueryParam(queryParams, 'pageUrl', options.pageUrl);
    setOptionalQueryParam(queryParams, 'sourceUrl', options.sourceUrl);
    setOptionalQueryParam(queryParams, 'sourceMapFileId', options.sourceMapFileId);
    setOptionalQueryParam(queryParams, 'view', options.view);

    const queryString = queryParams.toString();
    return browserAPI.runtime.getURL(`pages/desktop/index.html${queryString.length > 0 ? `?${queryString}` : ''}`);
}

export async function openSourceExplorer(options: OpenSourceExplorerOptions = {}) {
    await browserAPI.tabs.create({
        url: buildSourceExplorerUrl(options)
    });
}
