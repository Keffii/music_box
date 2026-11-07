import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { AuthLayout } from './AuthLayout';
import { AuthAlert, PasswordField, SubmitButton } from './AuthParts';
import { ConfirmEmailStep } from './ConfirmEmailStep';

interface LoginProps {
  onSwitchToSignup: () => void;
  onForgotPassword: () => void;
  /** A message to show on arrival, e.g. after a password reset */
  notice?: string;
}

const Login: React.FC<LoginProps> = ({ onSwitchToSignup, onForgotPassword, notice: initialNotice }) => {
  const { signIn } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(initialNotice || '');
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setLoading(true);
    // A username or a verified email both work (email is a sign-in alias in the user pool)
    const result = await signIn(identifier.trim(), password);
    if (result.success) return; // the app takes over from here
    setLoading(false);
    if (result.needsConfirmation) {
      setConfirming(true); // signed up but never entered the email code
    } else {
      setError(result.error || 'Sign in failed.');
    }
  };

  if (confirming) {
    return (
      <AuthLayout>
        <ConfirmEmailStep
          username={identifier.trim()}
          password={password}
          sendCodeOnOpen
          onBack={() => setConfirming(false)}
          onConfirmedWithoutSignIn={(message) => { setConfirming(false); setNotice(message); }}
        />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="auth-heading">
        <h1>Welcome back</h1>
        <p>Sign in to pick up where you left off.</p>
      </div>

      <form className="auth-form" onSubmit={handleSubmit}>
        {error && <AuthAlert type="error">{error}</AuthAlert>}
        {notice && <AuthAlert type="success">{notice}</AuthAlert>}

        <div className="form-group">
          <label className="form-label" htmlFor="identifier">Username or email</label>
          <input
            id="identifier"
            type="text"
            className="form-input"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            autoFocus
            required
          />
        </div>

        <PasswordField
          id="password"
          label="Password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          labelAction={
            <button type="button" className="auth-link auth-link--small" onClick={onForgotPassword}>
              Forgot password?
            </button>
          }
        />

        <SubmitButton loading={loading}>{loading ? 'Signing in…' : 'Sign in'}</SubmitButton>
      </form>

      <div className="auth-switch">
        New to Music Box?{' '}
        <button type="button" className="auth-link" onClick={onSwitchToSignup}>Create an account</button>
      </div>
    </AuthLayout>
  );
};

export default Login;
