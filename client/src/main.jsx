import React, { Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';
if ('serviceWorker' in navigator && import.meta.env.PROD) window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
createRoot(document.getElementById('root')).render(<React.StrictMode><Suspense fallback={<div className="loading-screen"><b>Loading workspace module…</b></div>}><App /></Suspense></React.StrictMode>);
