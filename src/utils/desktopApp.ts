import { browserAPI } from '@/utils/browser-polyfill';

// Protocol name for native Source Explorer integration (optional)
const PROTOCOL = 'source-detector://';

export type DesktopAction =
    | 'handleVersionMenuOpen'
    | 'handleOpenDesktopApp';

type DesktopNavigationOptions = Record<string, unknown>;

function setOptionalQueryParam(params: URLSearchParams, key: string, value: unknown) {
    if (typeof value === 'string' && value.trim().length > 0) {
        params.set(key, value);
        return;
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
        params.set(key, String(value));
    }
}

const getDesktopAppUrl = (type: DesktopAction, options: DesktopNavigationOptions = {}) => {
    let desktopUrl = '';
    switch (type) {
        case 'handleVersionMenuOpen': {
            const params = new URLSearchParams();
            setOptionalQueryParam(params, 'sourceUrl', options.sourceUrl ?? options.groupUrl ?? options.url);
            desktopUrl = `${PROTOCOL}source-files${params.toString().length > 0 ? `?${params.toString()}` : ''}`;
            break;
        }
        case 'handleOpenDesktopApp': {
            const targetType = typeof options.type === 'string' && options.type.length > 0
                ? options.type
                : 'source-files';
            const params = new URLSearchParams();
            setOptionalQueryParam(params, 'url', options.url);
            setOptionalQueryParam(params, 'sourceUrl', options.sourceUrl);
            setOptionalQueryParam(params, 'sourceMapFileId', options.sourceMapFileId);
            setOptionalQueryParam(params, 'view', options.view);
            desktopUrl = `${PROTOCOL}${targetType}${params.toString().length > 0 ? `?${params.toString()}` : ''}`;
            break;
        }
    }
    return desktopUrl;
}

export async function openInDesktop(
    type: DesktopAction,
    options: DesktopNavigationOptions = {}
) {
    try {
        const desktopUrl = getDesktopAppUrl(type, options);
        window.open(desktopUrl, '_self');
        setTimeout(() => {
            openWebVersion(type, options);
        }, 220);
    } catch (error) {
        console.error('Error opening Source Explorer:', error);
        openWebVersion(type, options);
    }
}

function openWebVersion(type: string, options?: DesktopNavigationOptions) {
    const queryParams = new URLSearchParams({ type });
    if (options) {
        queryParams.set('options', JSON.stringify(options));
        setOptionalQueryParam(queryParams, 'resourceType', options.type);
        setOptionalQueryParam(queryParams, 'url', options.url);
        setOptionalQueryParam(queryParams, 'sourceUrl', options.sourceUrl ?? options.groupUrl);
        setOptionalQueryParam(queryParams, 'sourceMapFileId', options.sourceMapFileId);
        setOptionalQueryParam(queryParams, 'view', options.view);
    }

    browserAPI.tabs.create({
        url: browserAPI.runtime.getURL(`pages/desktop/index.html?${queryParams.toString()}`)
    });
}