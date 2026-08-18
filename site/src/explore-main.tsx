import React from 'react';
import ReactDOM from 'react-dom/client';
import ExploreApp from './ExploreApp';
import './tokens.css';
import './explore.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ExploreApp />
  </React.StrictMode>,
);
