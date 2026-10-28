import React from 'react';
import ReactDOM from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import App from '../App.jsx';
import { AppProvider } from '../AppContext.jsx';
import { installMockServer } from './mockServer.js';
import '../styles/fonts.css';
import '../styles/global.css';
import '../styles/chart.css';

// Entry for the single-file preview that runs inside a Claude Artifact.
// MemoryRouter is used because an Artifact cannot change the browser address.
globalThis.__WA_MODE__ = 'preview';
installMockServer();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <MemoryRouter>
      <AppProvider>
        <App />
      </AppProvider>
    </MemoryRouter>
  </React.StrictMode>
);
