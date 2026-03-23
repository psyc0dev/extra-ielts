import { createRoot } from 'react-dom/client'
import { getCurrentWindow, LogicalSize } from '@tauri-apps/api/window'
import './index.css'
import App from './App'

document.body.classList.add('dark')

createRoot(document.getElementById('app')!).render(
  <App />
)
