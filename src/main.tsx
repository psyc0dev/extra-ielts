import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

document.body.classList.add('dark')

createRoot(document.getElementById('app')!).render(
  <App />
)
