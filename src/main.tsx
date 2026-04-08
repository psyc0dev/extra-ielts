import { createRoot } from 'react-dom/client'
import DisableDevtool from 'disable-devtool'
import { getIsAdmin } from './lib/api'
import './index.css'
import App from './App'

DisableDevtool({
  interval: 200,
  disableMenu: true,
  clearLog: true,
  detectors: [0, 1, 3, 4, 5, 6, 7],
  rewriteHTML: '',
  ignore: () => getIsAdmin(),
  ondevtoolopen(_type, next) {
    document.documentElement.innerHTML = ''
    next()
  },
})

document.body.classList.add('dark')

createRoot(document.getElementById('app')!).render(
  <App />
)
