import React from 'react';
import ReactDOM from 'react-dom/client';
import 'katex/dist/katex.min.css';
import { EssayApp } from './EssayApp';
import './essay.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <EssayApp />
  </React.StrictMode>,
);
