import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import {captureSharedMojiUrl, stripShareParameters} from './shareTarget';

let sharedUrl = '';
try { sharedUrl = captureSharedMojiUrl(window.location.href, window.localStorage) || ''; } catch { /* Let the app explain storage availability instead of crashing. */ }
if (sharedUrl) {
  window.history.replaceState({}, document.title, stripShareParameters(window.location.href));
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, {once: true});
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
