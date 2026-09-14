import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// BULLETPROOF entry point with comprehensive error handling
try {
  const rootElement = document.getElementById("root");
  
  if (!rootElement) {
    throw new Error('Root element not found. Make sure index.html has a <div id="root"></div> element.');
  }
  
  try {
    const root = createRoot(rootElement);
    root.render(<App />);
  } catch (createRootError) {
    console.error('❌ Failed to create React root:', createRootError);
    const wrap = document.createElement('div');
    wrap.style.cssText = 'padding:20px;font-family:system-ui;color:red';
    const h = document.createElement('h1');
    h.textContent = 'Application Error';
    const p1 = document.createElement('p');
    p1.textContent = 'Failed to initialize the application.';
    const p2 = document.createElement('p');
    p2.textContent = `Error: ${createRootError instanceof Error ? createRootError.message : 'Unknown error'}`;
    const p3 = document.createElement('p');
    p3.textContent = 'Please refresh the page or contact support.';
    wrap.append(h, p1, p2, p3);
    rootElement.replaceChildren(wrap);
  }
} catch (error) {
  console.error('❌ Critical error in main.tsx:', error);
  const wrap = document.createElement('div');
  wrap.style.cssText = 'padding:20px;font-family:system-ui;color:red';
  const h = document.createElement('h1');
  h.textContent = 'Critical Application Error';
  const p1 = document.createElement('p');
  p1.textContent = error instanceof Error ? error.message : 'Unknown error occurred';
  const p2 = document.createElement('p');
  p2.textContent = 'Please refresh the page.';
  wrap.append(h, p1, p2);
  document.body.replaceChildren(wrap);
}
