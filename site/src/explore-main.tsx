import React from 'react';
import ReactDOM from 'react-dom/client';
import DirectExploreApp from './DirectExploreApp';
import './tokens.css';
import './explore.css';
import './direct-authoring.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DirectExploreApp />
  </React.StrictMode>,
);
