import { app, BrowserWindow, shell, ipcMain } from 'electron'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import os from 'node:os'
import { update } from './update'
import { createServer, closeServer } from './server'
import { FastifyInstance } from 'fastify'
import { initDatabase, closeDatabase } from './database.js'
import { DatabaseOperations } from './database-operations.js'
import { setupIpcHandlers } from './ipc-handlers.js'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

let server: FastifyInstance | null = null

// Register the source-detector:// protocol
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('source-detector', process.execPath, [path.resolve(process.argv[1])])
  }
} else {
  app.setAsDefaultProtocolClient('source-detector')
}

// The built directory structure
//
// ├─┬ dist-electron
// │ ├─┬ main
// │ │ └── index.js    > Electron-Main
// │ └─┬ preload
// │   └── index.mjs   > Preload-Scripts
// ├─┬ dist
// │ └── index.html    > Electron-Renderer
//
process.env.APP_ROOT = path.join(__dirname, '../..')

export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')
export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

// Disable GPU Acceleration for Windows 7
if (os.release().startsWith('6.1')) app.disableHardwareAcceleration()

// Set application name for Windows 10+ notifications
if (process.platform === 'win32') app.setAppUserModelId(app.getName())

// Handle Windows protocol launch parameters
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
  process.exit(0)
}

// Protocol handler for Windows
if (process.platform === 'win32') {
  // Keep only command line / deep linked arguments
  const deeplinkingUrl = process.argv.find(arg => arg.startsWith('source-detector://'))
    console.log('deeplinkingUrl', deeplinkingUrl)
  if (deeplinkingUrl) {
    handleProtocolUrl(deeplinkingUrl)
  }
}

let win: BrowserWindow | null = null
const preload = path.join(__dirname, '../preload/index.mjs')
const indexHtml = path.join(RENDERER_DIST, 'index.html')

// Handle the protocol. In this case, we choose to show the home page.
async function handleProtocolUrl(url: string) {
  console.log('handleProtocolUrl', url)
  if (!win) return
  
  const urlObj = new URL(url)
  if (urlObj.protocol !== 'source-detector:') return
  
  const route = urlObj.hostname || ''
  const fileUrl = urlObj.searchParams.get('url')
  
  // If there's a URL parameter, we need to query the database to get the file info
  if (fileUrl) {
    try {
      // Wait for the window to finish loading before sending the selection message
      await win.webContents.loadURL(`${VITE_DEV_SERVER_URL}${route}`)
      
      // Send a message to the renderer to select the file
      win.webContents.send('select-file', {
        url: fileUrl,
        type: route === 'crx-files' ? 'crx' : 'sourcemap'
      })
    } catch (error) {
      console.error('Error handling protocol URL:', error)
      // If there's an error, just navigate to the page without selection
      if (VITE_DEV_SERVER_URL) {
        win.loadURL(`${VITE_DEV_SERVER_URL}${route}`)
      } else {
        win.loadFile(indexHtml, { hash: `${route}` })
      }
    }
  } else {
    // If there's no URL parameter, just navigate to the page
    if (VITE_DEV_SERVER_URL) {
      win.loadURL(`${VITE_DEV_SERVER_URL}${route}`)
    } else {
      win.loadFile(indexHtml, { hash: `${route}` })
    }
  }
}

// Handle macOS case when app is opened through protocol when app is not running
app.on('open-url', (event, url) => {
  event.preventDefault()
  if (app.isReady()) {
    handleProtocolUrl(url)
  } else {
    // If app is not ready, wait for it to be ready
    app.on('ready', () => {
      handleProtocolUrl(url)
    })
  }
})

async function createWindow() {
  // Start the server before creating the window
  try {
    const db = initDatabase()
    const dbOps = new DatabaseOperations(db)

    server = await createServer(dbOps)
  } catch (err) {
    console.error('Failed to start server:', err)
  }

  win = new BrowserWindow({
    title: 'Main window',
    icon: path.join(process.env.VITE_PUBLIC, 'favicon.ico'),
    webPreferences: {
      preload,
      // Warning: Enable nodeIntegration and disable contextIsolation is not secure in production
      // nodeIntegration: true,

      // Consider using contextBridge.exposeInMainWorld
      // Read more on https://www.electronjs.org/docs/latest/tutorial/context-isolation
      // contextIsolation: false,
    },
  })

  // Maximize the window by default
  win.maximize()

  if (VITE_DEV_SERVER_URL) { // #298
    win.loadURL(VITE_DEV_SERVER_URL)
    // Open devTool if the app is not packaged
    win.webContents.openDevTools()
  } else {
    win.loadFile(indexHtml)
  }

  // Test actively push message to the Electron-Renderer
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', new Date().toLocaleString())
  })

  // Make all links open with the browser, not with the application
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:')) shell.openExternal(url)
    return { action: 'deny' }
  })

  // Auto update
  update(win)
}

app.whenReady().then(async () => {
  // Initialize database
  const db = initDatabase()
  const dbOps = new DatabaseOperations(db)
  
  // Set up IPC handlers
  setupIpcHandlers(dbOps)
  
  createWindow()
})

app.on('window-all-closed', () => {
  closeDatabase()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('second-instance', (event, commandLine) => {
  // Someone tried to run a second instance, we should focus our window.
  if (win) {
    if (win.isMinimized()) win.restore()
    win.focus()

    // Handle protocol url if present in second instance
    // Protocol handler for Windows
    const deeplinkingUrl = commandLine.find(arg => arg.startsWith('source-detector://'))
    console.log('deeplinkingUrl', deeplinkingUrl)
    if (deeplinkingUrl) handleProtocolUrl(deeplinkingUrl)
  }
})

app.on('activate', () => {
  const allWindows = BrowserWindow.getAllWindows()
  if (allWindows.length) {
    allWindows[0].focus()
  } else {
    createWindow()
  }
})

// New window example arg: new windows url
ipcMain.handle('open-win', (_, arg) => {
  const childWindow = new BrowserWindow({
    webPreferences: {
      preload,
      nodeIntegration: true,
      contextIsolation: false,
    },
  })

  if (VITE_DEV_SERVER_URL) {
    childWindow.loadURL(`${VITE_DEV_SERVER_URL}${arg}`)
  } else {
    childWindow.loadFile(indexHtml, { hash: arg })
  }
})
