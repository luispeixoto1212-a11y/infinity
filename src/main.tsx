import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './styles/tokens.css';
import './styles/base.css';
import './styles/app.css';
import './styles/exo.css';

const container = document.getElementById('root');
if (!container) throw new Error('Elemento #root em falta no index.html');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
