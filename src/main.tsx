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
    // Fallback: try to show error message
    rootElement.innerHTML = `
      <div style="padding: 20px; font-family: system-ui; color: red;">
        <h1>Application Error</h1>
        <p>Failed to initialize the application.</p>
        <p>Error: ${createRootError instanceof Error ? createRootError.message : 'Unknown error'}</p>
        <p>Please refresh the page or contact support.</p>
      </div>
    `;
  }
} catch (error) {
  console.error('❌ Critical error in main.tsx:', error);
  // Last resort: try to show error
  document.body.innerHTML = `
    <div style="padding: 20px; font-family: system-ui; color: red;">
      <h1>Critical Application Error</h1>
      <p>${error instanceof Error ? error.message : 'Unknown error occurred'}</p>
      <p>Please refresh the page.</p>
    </div>
  `;
}
