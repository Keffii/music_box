import React, { useEffect, useState } from 'react';
import { authService } from '../../services/authService';
import { useAuth } from '../../context/AuthContext';
import { AuthAlert, BackButton, SubmitButton } from './AuthParts';

interface ConfirmEmailStepProps {
  username: string;
  /** Where the code went, e.g. the address typed at sign-up or Cognito's masked one (k***@g***) */
  destination?: string;
  /** Known after sign-up or a sign-in attempt: used to sign straight in once confirmed */
  password?: string;
  /** Send a fresh code on open (an old account signing in has no code waiting) */
  sendCodeOnOpen?: boolean;
  onBack: () => void;
  /** Text of the ← button: "Back to sign in" by default, "Back" when it returns to the sign-up form */
  backLabel?: string;
  /** Confirmed but not signed in (no password known): back to sign-in with this message */
  onConfirmedWithoutSignIn: (message: string) => void;
}

const RESEND_COOLDOWN = 30;

/** Enter the 6-digit code from the email. On success the user is signed in directly when possible. */
export const ConfirmEmailStep: React.FC<ConfirmEmailStepProps> = ({
  username, destination, password, sendCodeOnOpen, onBack, backLabel, onConfirmedWithoutSignIn,
}) => {
  const { signIn } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [sentTo, setSentTo] = useState(destination);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(sendCodeOnOpen ? 0 : RESEND_COOLDOWN);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const resend = async () => {
    setError('');
    setNotice('');
    const result = await authService.resendConfirmationCode(username);
    if (result.success) {
      if (result.destination) setSentTo(result.destination);
      setNotice('We sent you a new code.');
      setCooldown(RESEND_COOLDOWN);
    } else {
      setError(result.error || 'Could not send a new code.');
    }
  };

  useEffect(() => {
    if (sendCodeOnOpen) resend();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setLoading(true);
    const result = await authService.confirmSignUp(username, code.trim());
    if (!result.success) {
      setError(result.error || 'Confirmation failed.');
      setLoading(false);
      return;
    }
    if (password) {
      const signedIn = await signIn(username, password);
      if (signedIn.success) return; // the app takes over from here
    }
    setLoading(false);
    onConfirmedWithoutSignIn('Your email is confirmed. Sign in to continue.');
  };

  return (
    <>
      <BackButton onClick={onBack} label={backLabel} />
      <div className="auth-heading">
        <h1>Check your email</h1>
        <p>
          We sent a 6-digit code to {sentTo ? <strong>{sentTo}</strong> : 'your email'}.
          Enter it below to confirm your account.
        </p>
      </div>

      <form className="auth-form" onSubmit={submit} noValidate>
        {error && <AuthAlert type="error">{error}</AuthAlert>}
        {notice && <AuthAlert type="success">{notice}</AuthAlert>}

        <div className="form-group">
          <label className="form-label" htmlFor="code">Confirmation code</label>
          <input
            id="code"
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

        <SubmitButton loading={loading} disabled={code.length !== 6}>
          {loading ? 'Confirming…' : 'Confirm and continue'}
        </SubmitButton>
      </form>

      <div className="auth-switch">
        Didn't get it? Check your spam folder, or{' '}
        <button type="button" className="auth-link" onClick={resend} disabled={cooldown > 0}>
          {cooldown > 0 ? `send a new code in ${cooldown}s` : 'send a new code'}
        </button>
      </div>
    </>
  );
};
