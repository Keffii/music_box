import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMusic } from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/authService';
import './Auth.css';

interface SignupProps {
  onSwitchToLogin: () => void;
}

const Signup: React.FC<SignupProps> = ({ onSwitchToLogin }) => {
  const { signUp } = useAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationCode, setConfirmationCode] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    setIsLoading(true);

    try {
      const result = await signUp(username, password, email);
      
      if (result.success) {
        if (result.requiresConfirmation) {
          setShowConfirmation(true);
          setSuccessMessage('Account created! Please check your email for a confirmation code.');
        } else {
          setSuccessMessage('Account created successfully! Redirecting to login...');
          setTimeout(() => onSwitchToLogin(), 2000);
        }
      } else {
        setError(result.error || 'Sign up failed');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmation = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await authService.confirmSignUp(username, confirmationCode);
      
      if (result.success) {
        setSuccessMessage('Email confirmed! Redirecting to login...');
        setTimeout(() => onSwitchToLogin(), 2000);
      } else {
        setError(result.error || 'Confirmation failed');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    setError('');
    setIsLoading(true);

    try {
      const result = await authService.resendConfirmationCode(username);
      
      if (result.success) {
        setSuccessMessage('Confirmation code resent! Check your email.');
      } else {
        setError(result.error || 'Failed to resend code');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  if (showConfirmation) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <FontAwesomeIcon icon={faMusic} className="auth-logo" />
            <h1 className="auth-title">Confirm Your Email</h1>
            <p className="auth-subtitle">Enter the code sent to {email}</p>
          </div>

          <form className="auth-form" onSubmit={handleConfirmation}>
            {successMessage && <div className="success-message">{successMessage}</div>}
            {error && <div className="form-error">{error}</div>}
            
            <div className="form-group">
              <label className="form-label" htmlFor="code">Confirmation Code</label>
              <input
                id="code"
                type="text"
                className="form-input"
                placeholder="Enter 6-digit code"
                value={confirmationCode}
                onChange={(e) => setConfirmationCode(e.target.value)}
                required
                maxLength={6}
              />
            </div>

            <button 
              type="submit" 
              className="auth-button"
              disabled={isLoading}
            >
              {isLoading ? 'Confirming...' : 'Confirm Email'}
            </button>

            <button
              type="button"
              className="resend-button"
              onClick={handleResendCode}
              disabled={isLoading}
            >
              Resend Code
            </button>
          </form>

          <div className="auth-footer">
            <button type="button" className="auth-link" onClick={onSwitchToLogin}>
              Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <FontAwesomeIcon icon={faMusic} className="auth-logo" />
          <h1 className="auth-title">Create Account</h1>
          <p className="auth-subtitle">Join MusicBox today</p>
        </div>

        <form className="auth-form" onSubmit={handleSignup}>
          {successMessage && <div className="success-message">{successMessage}</div>}
          {error && <div className="form-error">{error}</div>}
          
          <div className="form-group">
            <label className="form-label" htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              className="form-input"
              placeholder="Choose a username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className="form-input"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="form-input"
              placeholder="Create a password (min 8 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              minLength={8}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="confirmPassword">Confirm Password</label>
            <input
              id="confirmPassword"
              type="password"
              className="form-input"
              placeholder="Confirm your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
          </div>

          <button 
            type="submit" 
            className="auth-button"
            disabled={isLoading}
          >
            {isLoading ? 'Creating Account...' : 'Sign Up'}
          </button>
        </form>

        <div className="auth-footer">
          Already have an account?{' '}
          <button type="button" className="auth-link" onClick={onSwitchToLogin}>
            Sign In
          </button>
        </div>
      </div>
    </div>
  );
};

export default Signup;
