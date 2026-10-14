import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './styles/tokens.css';
import './styles/base.css';
import './styles/app.css';
import './styles/exo.css';
import './styles/space.css';
import './styles/planetarium.css';
import './styles/missions.css';
import './styles/timeline.css';
import './styles/extreme.css';
import './styles/small-bodies.css';

const container = document.getElementById('root');
if (!container) throw new Error('Elemento #root em falta no index.html');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
