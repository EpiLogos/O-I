import React from 'react';
import ReactDOM from 'react-dom/client';
import { ExpressionApp, initialTheme } from './ExpressionApp';
import './expression.css';

document.documentElement.dataset.theme = initialTheme();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ExpressionApp />
  </React.StrictMode>,
);
