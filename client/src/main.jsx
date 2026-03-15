import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './styles/variables.css'
import './index.css'
import App from './App.jsx'

// Global fetch interceptor to handle session expiration (401 Unauthorized) across the ENTIRE app
const originalFetch = window.fetch;
window.fetch = async function (...args) {
  const response = await originalFetch.apply(this, args);
  
  // If we get an unauthorized error from the API, and we're not currently trying to log in/register
  if (response.status === 401) {
    const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
    if (!url.includes('/api/auth/login') && !url.includes('/api/auth/register') && !url.includes('/api/auth/check-username')) {
      // Clear invalid credentials
      localStorage.removeItem('token');
      localStorage.removeItem('role');
      // Redirect to login if not already there
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
  }
  return response;
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
