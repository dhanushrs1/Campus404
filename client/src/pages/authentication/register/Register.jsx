import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './Register.css';

const Register = () => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    username: ''
  });
  
  const [usernameStatus, setUsernameStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!formData.username) {
      setUsernameStatus(null);
      return;
    }

    const checkUsername = async () => {
      setUsernameStatus('checking');
      try {
        await new Promise(resolve => setTimeout(resolve, 500));
        const lowerUser = formData.username.toLowerCase();
        const isTaken = ['admin', 'test', 'campus'].includes(lowerUser);
        setUsernameStatus(isTaken ? 'taken' : 'available');
      } catch (error) {
        setUsernameStatus(null);
      }
    };

    const debounceTimer = setTimeout(() => {
      checkUsername();
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [formData.username]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (usernameStatus === 'taken' || usernameStatus === 'checking') return;
    
    setIsLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      localStorage.setItem('token', 'mock_jwt_token_register');
      navigate('/dashboard');
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="register-page">
      {/* Left Branding Side */}
      <div className="register-brand-side">
        <div className="register-brand-content">
          <h1 className="register-logo">Campus404</h1>
          <p className="register-tagline">
            Level up your developer skills. Create an account to access our vast library of coding challenges, tracks, and tech-based learning maps.
          </p>
        </div>
        
        {/* External Background Image */}
        <div className="register-image-bg"></div>
        <div className="register-image-overlay"></div>
      </div>
      
      {/* Right Form Side */}
      <div className="register-form-side">
        <div className="register-form-card">
          <h2 className="register-title">Create Account</h2>
          <p className="register-subtitle">Join our premium technical education platform.</p>
          
          <form onSubmit={handleRegister} className="register-form">
            <div className="name-row">
              <div className="input-group">
                <label htmlFor="firstName">First Name</label>
                <input 
                  type="text" 
                  id="firstName" 
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  placeholder="First"
                  required
                  className="register-input"
                />
              </div>
              <div className="input-group">
                <label htmlFor="lastName">Last Name</label>
                <input 
                  type="text" 
                  id="lastName" 
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  placeholder="Last"
                  required
                  className="register-input"
                />
              </div>
            </div>
            
            <div className="input-group">
              <label htmlFor="email">Email</label>
              <input 
                type="email" 
                id="email" 
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Enter your email"
                required
                className="register-input"
              />
            </div>

            <div className="input-group">
              <label htmlFor="username">Username</label>
              <div className="username-wrapper">
                <span className="username-prefix">@</span>
                <input 
                  type="text" 
                  id="username" 
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  placeholder="username"
                  required
                  className="register-input has-prefix"
                />
              </div>
              {usernameStatus === 'checking' && <span className="username-hint checking">Checking availability...</span>}
              {usernameStatus === 'available' && <span className="username-hint available">Username is available!</span>}
              {usernameStatus === 'taken' && <span className="username-hint taken">Username is already taken.</span>}
            </div>
            
            <div className="input-group">
              <label htmlFor="password">Password</label>
              <input 
                type="password" 
                id="password" 
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Create a strong password"
                required
                className="register-input"
              />
            </div>
            
            <button 
              type="submit" 
              className="register-button" 
              disabled={isLoading || usernameStatus === 'taken' || usernameStatus === 'checking'}
            >
              {isLoading ? 'Creating Account...' : 'Sign Up'}
            </button>
          </form>
          
          <p className="register-switch-text">
            Already have an account? <Link to="/login" className="register-link">Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
