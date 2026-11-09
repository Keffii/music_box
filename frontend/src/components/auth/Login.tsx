import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { AuthLayout } from './AuthLayout';
import { AuthAlert, BackButton, PasswordField, SubmitButton } from './AuthParts';
import { ConfirmEmailStep } from './ConfirmEmailStep';
import { GUEST_SIGN_IN_ENABLED } from '../../utils/guest';

interface LoginProps {
  onSwitchToSignup: () => void;
  onForgotPassword: () => void;
  /** A message to show on arrival, e.g. after a password reset */
  notice?: string;
  /** A guest who opened this from the app: shows "Back to Music Box" */
  onClose?: () => void;
}

const Login: React.FC<LoginProps> = ({ onSwitchToSignup, onForgotPassword, notice: initialNotice, onClose }) => {
  const { signIn, signInAsGuest } = useAuth();
  const [guestLoading, setGuestLoading] = useState(false);
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

  // A throwaway account per visitor, no email or password (see utils/guest.ts)
  const handleGuest = async () => {
    setError('');
    setNotice('');
    setGuestLoading(true);
    const result = await signInAsGuest();
    if (result.success) return;
    setGuestLoading(false);
    setError(result.error || 'Guest sign-in failed.');
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
    <AuthLayout showFeatures>
      {/* In the page's corner, not the card, so sign-in keeps its size and still fits without scrolling */}
      {onClose && <BackButton onClick={onClose} label="Back to Music Box" className="auth-back--corner" />}
      <div className="auth-heading">
        <h1>Sign in</h1>
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

        <SubmitButton loading={loading} disabled={guestLoading}>{loading ? 'Signing in…' : 'Sign in'}</SubmitButton>
      </form>

      {/* Only when there's no session at all; a guest opening this screen already is one */}
      {GUEST_SIGN_IN_ENABLED && !onClose && (
        <>
          <div className="auth-divider"><span>or</span></div>
          <button
            type="button"
            className="auth-button auth-button--secondary"
            onClick={handleGuest}
            disabled={loading || guestLoading}
            aria-busy={guestLoading}
          >
            {guestLoading && <span className="auth-spinner" aria-hidden="true" />}
            <span>{guestLoading ? 'Signing in…' : 'Sign in as guest'}</span>
          </button>
        </>
      )}

      <div className="auth-switch">
        New to Music Box?{' '}
        <button type="button" className="auth-link" onClick={onSwitchToSignup}>Create an account</button>
      </div>
    </AuthLayout>
  );
};

export default Login;
