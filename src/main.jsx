import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import 'bootstrap/dist/css/bootstrap.min.css';
import './index.css'
import { Buffer } from 'buffer'
globalThis.Buffer = Buffer

createRoot(document.getElementById('root')).render(<App />)
