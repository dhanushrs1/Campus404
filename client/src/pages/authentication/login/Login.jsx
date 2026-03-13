import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './Login.css';

const Login = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Login failed');
      }
      
      localStorage.setItem('token', data.access_token);
      localStorage.setItem('role', data.role);
      
      if (data.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    } catch (error) {
      alert(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page">
      {/* Left Branding Side */}
      <div className="login-brand-side">
        <div className="login-brand-content">
          <h1 className="login-logo">Campus404</h1>
          <p className="login-tagline">
            Your high-performance workspace for elite coding challenges and peer-reviewed learning.
            Similar to LeetCode and CodeDex, practice and prepare for your ultimate engineering role.
          </p>
        </div>
        
        {/* External Background Image */}
        <div className="login-image-bg"></div>
        <div className="login-image-overlay"></div>
      </div>
      
      {/* Right Form Side */}
      <div className="login-form-side">
        <div className="login-form-card">
          <h2 className="login-title">Sign In</h2>
          <p className="login-subtitle">Log in to your account to continue.</p>
          
          <form onSubmit={handleLogin} className="login-form">
            <div className="input-group floating-group">
              <input 
                type="text" 
                id="identifier" 
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder=" "
                required
                className="login-input floating-input"
              />
              <label htmlFor="identifier" className="floating-label">Email or Username</label>
            </div>
            
            <div className="input-group floating-group">
              <input 
                type="password" 
                id="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder=" "
                required
                className="login-input floating-input"
              />
              <label htmlFor="password" className="floating-label">Password</label>
              <Link to="/forgot-password" className="forgot-link floating-forgot">Forgot?</Link>
            </div>
            
            <button type="submit" className="login-button" disabled={isLoading}>
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
          
          <p className="login-switch-text">
            Don't have an account? <Link to="/register" className="login-link">Sign up</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
