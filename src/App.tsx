import { useState } from 'react'
import UpdateElectron from '@/components/update'
import { DatabaseInfo } from '@/components/DatabaseInfo'
import logoVite from './assets/logo-vite.svg'
import logoElectron from './assets/logo-electron.svg'
import './App.css'

function App() {
  const [count, setCount] = useState(0)
  return (
    <div className='App'>
      <DatabaseInfo />
      <div className='logo-box'>
        <a href='https://github.com/electron-vite/electron-vite-react' target='_blank'>
          <img src={logoVite} className='logo vite' alt='SourceDetectorDesktop logo' />
          <img src={logoElectron} className='logo electron' alt='SourceDetectorDesktop logo' />
        </a>
      </div>
      <h1>SourceDetectorDesktop</h1>
      <div className='card'>
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <p className='read-the-docs'>
        Click on the Electron + Vite logo to learn more
      </p>
      <div className='flex-center'>
        Place static files into the<code>/public</code> folder <img style={{ width: '5em' }} src='./node.svg' alt='Node logo' />
      </div>

      <UpdateElectron />
    </div>
  )
}

export default App