import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { captureInstallPrompt } from './hooks/useInstallPrompt.js';
import './hooks/useTheme.js'; // applies the saved theme immediately
import './index.css';

captureInstallPrompt();

// Ask the browser not to evict our IndexedDB data under storage pressure.
if (navigator.storage?.persist) {
  navigator.storage.persisted().then((already) => already || navigator.storage.persist()).catch(() => {});
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
