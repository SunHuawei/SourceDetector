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

- Displays a badge with the number when detected source files
- Collects source map files from a website
  - .map files
- Collects CRX files from a extension website or a extension page
- Download source map files and parsed files
- Download CRX files and parsed files
- Show View All Pages in desktop app
- Show history source map files in desktop app
- Show source map files from x domains in desktop app
- Show history CRX files in desktop app
- Show CRX files from x domains in desktop app

## TODO 
- [ ] i18n
- [ ] inline source map files
- [ ] UI improvements
- [ ] Open in desktop app