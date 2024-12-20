# Source Detector

Source Detector is a Chrome extension that automatically collects and views source maps from websites.

## How to local development

1. Clone the repository
2. Install dependencies
3. Run `npm run dev`
4. Open Chrome and install the extension from the `dist` folder
  1. Open `chrome://extensions`
  2. Enable "Developer mode"
  3. Click "Load unpacked"
  4. Select the `dist` folder

## Functions

- Collects .map files from a website
- Displays a badge with the number of parsed source files
- Displays two tabs: "Parsed Source Files" and ".map Files"
- "Parsed Source Files" tab
  - Displays a tree to show all the latest parsed source files
    - Click to popup a dialog to introduce the desktop app
    - Displays history versions of each source file, click to popup a dialog to introduce the desktop app
  - Download the latest parsed source files as a zip file
- ".map Files" tab
  - Displays a tree to show all the latest .map files
    - Displays a tree to show the parsed source files of each .map file
    - Click to popup a dialog to introduce the desktop app
    - Click to download the parsed source files of each .map file
    - Click to download the latest .map file
    - Displays history versions of each .map file, click to popup a dialog to introduce the desktop app
    - Click to download each .map file as a zip file
    - Click to download all the latest .map files as a zip file
  - Download each .map files as a zip file
  - Download all the latest .map files as a zip file
- Show View All Pages, click to popup a dialog to introduce the desktop app
- Show more history .map files, click to popup a dialog to introduce the desktop app
- Show .map files from x domains, click to popup a dialog to introduce the desktop app