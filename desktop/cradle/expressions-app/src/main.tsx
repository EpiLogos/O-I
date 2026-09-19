import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// This entry is the retired legacy workbench, kept read-only for reference at
// /legacy.html. The native Expressions workspace at / is the current app.
const banner = document.createElement('div');
banner.setAttribute('role', 'note');
banner.style.cssText =
  'position:fixed;left:0;right:0;top:0;z-index:2147483647;display:flex;gap:12px;align-items:center;justify-content:center;' +
  'padding:8px 16px;background:#1d231f;color:#f4f2eb;font:600 13px/1.4 system-ui,sans-serif;text-align:center;';
banner.innerHTML =
  '<span>Legacy preview — this workbench is superseded by the <strong>O:I Expressions</strong> workspace.</span>' +
  '<a href="/" style="color:#7fd8d8;font-weight:700;text-decoration:underline;white-space:nowrap;">Open the current app →</a>';
document.body.append(banner);
document.getElementById('root')!.style.paddingTop = '40px';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
