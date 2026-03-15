import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API_URL } from '../../../config';
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
        const res = await fetch(`${API_URL}/auth/check-username/${formData.username}`);
        const data = await res.json();
        setUsernameStatus(data.available ? 'available' : 'taken');
      } catch {
        // If API is unreachable, don't block the form
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
      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: formData.username,
          email: formData.email,
          password: formData.password,
          first_name: formData.firstName,
          last_name: formData.lastName
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Registration failed');
      }

      localStorage.setItem('token', data.access_token);
      localStorage.setItem('role', data.role);
      navigate('/dashboard');
    } catch (error) {
      alert(error.message);
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
              <div className="input-group floating-group">
                <input 
                  type="text" 
                  id="firstName" 
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  placeholder=" "
                  required
                  className="register-input floating-input"
                />
                <label htmlFor="firstName" className="floating-label">First Name</label>
              </div>
              <div className="input-group floating-group">
                <input 
                  type="text" 
                  id="lastName" 
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  placeholder=" "
                  required
                  className="register-input floating-input"
                />
                <label htmlFor="lastName" className="floating-label">Last Name</label>
              </div>
            </div>
            
            <div className="input-group floating-group">
              <input 
                type="email" 
                id="email" 
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder=" "
                required
                className="register-input floating-input"
              />
              <label htmlFor="email" className="floating-label">Email</label>
            </div>

            <div className="input-group">
              <div className="username-wrapper floating-group">
                <span className="username-prefix">@</span>
                <input 
                  type="text" 
                  id="username" 
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  placeholder=" "
                  required
                  className="register-input floating-input has-prefix"
                />
                <label htmlFor="username" className="floating-label prefix-label">Username</label>
              </div>
              {usernameStatus === 'checking' && <span className="username-hint checking">Checking availability...</span>}
              {usernameStatus === 'available' && <span className="username-hint available">Username is available!</span>}
              {usernameStatus === 'taken' && <span className="username-hint taken">Username is already taken.</span>}
            </div>
            
            <div className="input-group floating-group">
              <input 
                type="password" 
                id="password" 
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder=" "
                required
                className="register-input floating-input"
              />
              <label htmlFor="password" className="floating-label">Password</label>
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
