import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import './styles.css';
import { getSetting } from './db';
import { App } from './App';
import { ToastProvider } from './components/ui';
import { seedDemo } from './lib/demo';

getSetting('theme', 'system').then((t) => {
  if (t !== 'system') document.documentElement.dataset.theme = t as string;
});

registerSW({ immediate: true });

const demo = new URLSearchParams(location.search).has('demo') ? seedDemo() : Promise.resolve();
demo.finally(() => createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </StrictMode>
));
