import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('Falta el elemento #root en el HTML.');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
