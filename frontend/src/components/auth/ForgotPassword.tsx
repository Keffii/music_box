import React, { useState } from 'react';
import { authService } from '../../services/authService';
import { useAuth } from '../../context/AuthContext';
import { AuthLayout } from './AuthLayout';
import { AuthAlert, PasswordField, SubmitButton, passwordMeetsRules } from './AuthParts';

interface ForgotPasswordProps {
  onBack: (notice?: string) => void;
}

/**
 * Forgot password: 1) username or email → Cognito emails a code, 2) code + new password → signed in.
 * The user pool doesn't reveal whether an account exists, so step 1 always moves on.
 */
const ForgotPassword: React.FC<ForgotPasswordProps> = ({ onBack }) => {
  const { signIn } = useAuth();
  const [step, setStep] = useState<'request' | 'reset'>('request');
  const [identifier, setIdentifier] = useState('');
  const [destination, setDestination] = useState<string | undefined>();
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);

  const requestCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError('');
    setNotice('');
    setLoading(true);
    const result = await authService.requestPasswordReset(identifier.trim());
    setLoading(false);
    if (!result.success) {
      setError(result.error || 'Could not send a code.');
      return;
    }
    setDestination(result.destination);
    if (step === 'reset') setNotice('We sent you a new code.');
    setStep('reset');
  };

  const resetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    if (!passwordMeetsRules(password)) {
      setError('Password needs at least 8 characters, including a lowercase letter and a number.');
      return;
    }
    setLoading(true);
    const result = await authService.confirmPasswordReset(identifier.trim(), code.trim(), password);
    if (!result.success) {
      setError(result.error || 'Could not reset the password.');
      setLoading(false);
      return;
    }
    const signedIn = await signIn(identifier.trim(), password);
    if (signedIn.success) return; // the app takes over from here
    setLoading(false);
    onBack('Your password is changed. Sign in with the new one.');
  };

  if (step === 'request') {
    return (
      <AuthLayout>
        <div className="auth-heading">
          <h1>Reset your password</h1>
          <p>Enter your username or email and we’ll send you a code to choose a new password.</p>
        </div>

        <form className="auth-form" onSubmit={requestCode}>
          {error && <AuthAlert type="error">{error}</AuthAlert>}

          <div className="form-group">
            <label className="form-label" htmlFor="reset-identifier">Username or email</label>
            <input
              id="reset-identifier"
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

          <SubmitButton loading={loading}>{loading ? 'Sending…' : 'Send code'}</SubmitButton>
        </form>

        <div className="auth-switch">
          <button type="button" className="auth-link" onClick={() => onBack()}>Back to sign in</button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="auth-heading">
        <h1>Choose a new password</h1>
        <p>
          If an account matches, we sent a code to {destination ? <strong>{destination}</strong> : 'its email'}.
          Enter it with your new password.
        </p>
      </div>

      <form className="auth-form" onSubmit={resetPassword}>
        {error && <AuthAlert type="error">{error}</AuthAlert>}
        {notice && <AuthAlert type="success">{notice}</AuthAlert>}

        <div className="form-group">
          <label className="form-label" htmlFor="reset-code">Code from the email</label>
          <input
            id="reset-code"
            className="form-input code-input"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            autoFocus
            required
          />
        </div>

        <PasswordField
          id="reset-password"
          label="New password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          showRules
        />

        <SubmitButton loading={loading} disabled={code.length !== 6}>
          {loading ? 'Saving…' : 'Save and sign in'}
        </SubmitButton>
      </form>

      <div className="auth-switch">
        No email?{' '}
        <button type="button" className="auth-link" onClick={() => requestCode()} disabled={loading}>Send a new code</button>
        {' · '}
        <button type="button" className="auth-link" onClick={() => onBack()}>Back to sign in</button>
      </div>
    </AuthLayout>
  );
};

export default ForgotPassword;
