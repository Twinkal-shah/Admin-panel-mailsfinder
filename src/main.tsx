import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import relativeTime from 'dayjs/plugin/relativeTime'
import App from './App'
import 'antd/dist/reset.css'
import './styles/ui.css'

// Extended once at boot. Previously `dayjs.extend(utc)` ran inside the
// Dashboard render body on every re-render.
dayjs.extend(utc)
dayjs.extend(relativeTime)

// Drop the pre-React boot silhouette right before we mount over it.
document.getElementById('boot-shell')?.remove()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
