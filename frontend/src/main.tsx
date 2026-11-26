import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/sora';
import '@fontsource-variable/inter';
import '@/styles/index.css';
import { App } from '@/App';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root mount element #root was not found in index.html');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
