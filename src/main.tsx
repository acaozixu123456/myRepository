import {recoverStudyRestore} from './nhkBackup';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import {captureSharedMojiUrl, stripShareParameters} from './shareTarget';

let recoveryOK = true;
try {recoveryOK = recoverStudyRestore(window.localStorage);} catch { /* The app handles unavailable storage. */ }

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
    {recoveryOK ? <App /> : <main><h1>学习记录恢复尚未完成</h1><p>为避免覆盖原有数据，已暂停打开学习页面。请保留备份文件，不要清除网站数据，关闭其他标签后重新打开。</p></main>}
  </StrictMode>,
);
