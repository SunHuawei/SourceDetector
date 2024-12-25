import { AppSettings } from "@/types";

// Protocol name for the Source Detector desktop app
// This needs to be registered in the desktop app for each operating system
const PROTOCOL = 'source-detector://';

export async function openInDesktop(type: 'handleVersionMenuOpen' | 'handleViewAllPages', options?: any) {
    try {
        // Get settings to check if desktop app is enabled
        const response = await chrome.runtime.sendMessage({
            type: 'GET_SETTINGS'
        });
        const settings: AppSettings = response.data;

        if (!settings?.enableDesktopApp) {
            // If desktop app is not enabled, open the web version
            openWebVersion(type, options);
            return;
        }

        // Try to open in desktop app first
        try {
            const params = new URLSearchParams({
                type,
                ...(options && { options: JSON.stringify(options) })
            });
            
            // Create the desktop app URL
            const desktopUrl = `${PROTOCOL}open?${params.toString()}`;
            
            // Try to open the desktop app
            window.location.href = desktopUrl;

            // Set a timeout to check if the desktop app opened
            setTimeout(() => {
                // If we're still here after a short delay, the desktop app probably didn't open
                openWebVersion(type, options);
            }, 100);
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

/*
Instructions for registering the protocol handler in different operating systems:

Windows:
1. Add registry entries under HKEY_CLASSES_ROOT:
   source-detector
      (Default) = "URL:Source Detector Protocol"
      URL Protocol = ""
      DefaultIcon
         (Default) = "path\to\your\app.exe,1"
      shell
         open
            command
               (Default) = "path\to\your\app.exe" "%1"

macOS:
1. Add CFBundleURLTypes to Info.plist:
   <key>CFBundleURLTypes</key>
   <array>
     <dict>
       <key>CFBundleURLName</key>
       <string>com.sourceDetector.app</string>
       <key>CFBundleURLSchemes</key>
       <array>
         <string>source-detector</string>
       </array>
     </dict>
   </array>

Linux:
1. Create a .desktop file in ~/.local/share/applications:
   [Desktop Entry]
   Name=Source Detector
   Exec=path/to/your/app %u
   Type=Application
   Terminal=false
   Categories=Development;
   MimeType=x-scheme-handler/source-detector;

2. Register the protocol handler:
   xdg-mime default source-detector.desktop x-scheme-handler/source-detector
*/ 