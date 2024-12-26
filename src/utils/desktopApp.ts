// Protocol name for the Source Detector desktop app
// This needs to be registered in the desktop app for each operating system
const PROTOCOL = 'source-detector://';

export type DesktopAction =
    | 'handleVersionMenuOpen'
    | 'handleViewAllPages'
    | 'handleOpenDesktopApp';

const getDesktopAppUrl = (type: DesktopAction, options?: any) => {
    let url = '';
    switch (type) {
        case 'handleVersionMenuOpen':
            url = `${PROTOCOL}source-map/${options.sourceMapId}/${options.version}`;
            break;
        case 'handleViewAllPages':
            url = `${PROTOCOL}pages/${options.pageId}`;
            break;
        case 'handleOpenDesktopApp':
            url = `${PROTOCOL}home`;
            break;
    }
    return url;
}

export async function openInDesktop(type: DesktopAction, serverStatus: boolean, options: object) {
    try {
        // Try to open in desktop app first
        try {
            // Create the desktop app URL
            const desktopUrl = getDesktopAppUrl(type, options);

            // Try to open the desktop app
            window.open(desktopUrl, '_self');
            if (serverStatus) {
                return;
            }

            // Set a timeout to check if the desktop app opened
            setTimeout(() => {
                // If we're still here after a short delay, the desktop app probably didn't open
                openWebVersion(type, options);
            }, 200);
        } catch (error) {
            console.error('Failed to open desktop app:', error);
            openWebVersion(type, options);
        }
    } catch (error) {
        console.error('Error checking desktop app settings:', error);
        openWebVersion(type, options);
    }
}

function openWebVersion(type: string, options?: any) {
    chrome.tabs.create({
        url: chrome.runtime.getURL(`pages/desktop/index.html?type=${type}${options ? `&options=${encodeURIComponent(JSON.stringify(options))}` : ''}`)
    });
}