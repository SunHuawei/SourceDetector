import { ipcRenderer, contextBridge } from 'electron'

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('database', {
    // Database Info
    getPath: async () => ipcRenderer.invoke('database:getPath'),

    // Source Map Files
    getSourceMapFile: (params: { id: number }) => ipcRenderer.invoke('sourceMapFile:get', params),
    getSourceMapFileByUrl: (url: string) => ipcRenderer.invoke('getSourceMapFileByUrl', { url }),
    getLatestSourceMapFiles: () => ipcRenderer.invoke('getLatestSourceMapFiles'),

    // Parsed Source Files
    getParsedSourceFiles: (params: { sourceMapFileId: number }) => 
        ipcRenderer.invoke('parsedSourceFiles:getBySourceMapId', params),

    // Parsed CRX Files
    getParsedCrxFiles: (params: { crxFileId: number }) =>
        ipcRenderer.invoke('parsedCrxFiles:getByCrxId', params),

    // Pages
    getPage: (id: number) => ipcRenderer.invoke('getPage', { id }),
    getPageByUrl: (url: string) => ipcRenderer.invoke('getPageByUrl', { url }),

    // Page Source Maps
    getPageSourceMaps: async (pageId: string) => ipcRenderer.invoke('pageSourceMap:getByPageId', pageId),

    // Settings
    getSettings: async () => ipcRenderer.invoke('settings:get'),
    updateSettings: async (settings: any) => ipcRenderer.invoke('settings:update', settings),

    // CRX Files
    getCrxFile: async (id: number) => ipcRenderer.invoke('crxFile:get', id),
    getCrxFileByUrl: async (url: string) => ipcRenderer.invoke('crxFile:getByUrl', url),
    getCrxFiles: async () => ipcRenderer.invoke('crxFiles:getAll'),

    // Stats
    getStorageStats: async () => ipcRenderer.invoke('stats:get'),

    // Source Tree
    getDomains: async (offset: number, limit: number) => ipcRenderer.invoke('getDomains', offset, limit),
    getPages: async (domainId: number, offset: number, limit: number) => ipcRenderer.invoke('getPages', domainId, offset, limit),
    getSourceMaps: async (pageId: number, offset: number, limit: number) => ipcRenderer.invoke('getSourceMaps', pageId, offset, limit),
});

// For demo purposes
contextBridge.exposeInMainWorld('demo', {
    on: (channel: string, func: (...args: any[]) => void) => {
        ipcRenderer.on(channel, (event, ...args) => func(...args));
    }
});

// --------- Preload scripts loading ---------
function domReady(condition: DocumentReadyState[] = ['complete', 'interactive']) {
  return new Promise(resolve => {
    if (condition.includes(document.readyState)) {
      resolve(true)
    } else {
      document.addEventListener('readystatechange', () => {
        if (condition.includes(document.readyState)) {
          resolve(true)
        }
      })
    }
  })
}

const safeDOM = {
  append(parent: HTMLElement, child: HTMLElement) {
    if (!Array.from(parent.children).find(e => e === child)) {
      return parent.appendChild(child)
    }
  },
  remove(parent: HTMLElement, child: HTMLElement) {
    if (Array.from(parent.children).find(e => e === child)) {
      return parent.removeChild(child)
    }
  },
}

/**
 * https://tobiasahlin.com/spinkit
 * https://connoratherton.com/loaders
 * https://projects.lukehaas.me/css-loaders
 * https://matejkustec.github.io/SpinThatShit
 */
function useLoading() {
  const className = `loaders-css__square-spin`
  const styleContent = `
@keyframes square-spin {
  25% { transform: perspective(100px) rotateX(180deg) rotateY(0); }
  50% { transform: perspective(100px) rotateX(180deg) rotateY(180deg); }
  75% { transform: perspective(100px) rotateX(0) rotateY(180deg); }
  100% { transform: perspective(100px) rotateX(0) rotateY(0); }
}
.${className} > div {
  animation-fill-mode: both;
  width: 50px;
  height: 50px;
  background: #fff;
  animation: square-spin 3s 0s cubic-bezier(0.09, 0.57, 0.49, 0.9) infinite;
}
.app-loading-wrap {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #282c34;
  z-index: 9;
}
    `
  const oStyle = document.createElement('style')
  const oDiv = document.createElement('div')

  oStyle.id = 'app-loading-style'
  oStyle.innerHTML = styleContent
  oDiv.className = 'app-loading-wrap'
  oDiv.innerHTML = `<div class="${className}"><div></div></div>`

  return {
    appendLoading() {
      safeDOM.append(document.head, oStyle)
      safeDOM.append(document.body, oDiv)
    },
    removeLoading() {
      safeDOM.remove(document.head, oStyle)
      safeDOM.remove(document.body, oDiv)
    },
  }
}

// ----------------------------------------------------------------------

const { appendLoading, removeLoading } = useLoading()
domReady().then(appendLoading)

window.onmessage = (ev) => {
  ev.data.payload === 'removeLoading' && removeLoading()
}

setTimeout(removeLoading, 4999)