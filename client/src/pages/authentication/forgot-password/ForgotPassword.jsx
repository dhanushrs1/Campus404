import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import './ForgotPassword.css';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      setIsSubmitted(true);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="forgot-page">
      {/* Left Branding Side */}
      <div className="forgot-brand-side">
        <div className="forgot-brand-content">
          <h1 className="forgot-logo">Campus404</h1>
          <p className="forgot-tagline">
            Secure recovery systems initialized. Regain access to your workspace and continue your coding journey where you left off.
          </p>
        </div>
        
        {/* External Background Image */}
        <div className="forgot-image-bg"></div>
        <div className="forgot-image-overlay"></div>
      </div>
      
      {/* Right Form Side */}
      <div className="forgot-form-side">
        <div className="forgot-form-card">
          {isSubmitted ? (
            <div className="auth-success-message">
              <div className="success-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
              <h2 className="forgot-title">Email Sent</h2>
              <p className="forgot-subtitle">Check your email for the reset link.</p>
              <Link to="/login" className="forgot-button" style={{ textAlign: 'center', textDecoration: 'none', display: 'inline-block', boxSizing: 'border-box' }}>
                Back to Login
              </Link>
            </div>
          ) : (
            <>
              <h2 className="forgot-title">Reset Password</h2>
              <p className="forgot-subtitle">Enter your registered email address and we'll send you a link to reset your password.</p>
              
              <form onSubmit={handleSubmit} className="forgot-form">
                <div className="input-group">
                  <label htmlFor="email">Email Address</label>
                  <input 
                    type="email" 
                    id="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    required
                    className="forgot-input"
                  />
                </div>
                
                <button type="submit" className="forgot-button" disabled={isLoading}>
                  {isLoading ? 'Sending...' : 'Send Reset Link'}
                </button>
              </form>
              
              <p className="forgot-switch-text">
                <Link to="/login" className="forgot-link">Back to Login</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
