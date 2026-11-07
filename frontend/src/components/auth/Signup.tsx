import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { AuthLayout } from './AuthLayout';
import { AuthAlert, BackButton, PasswordField, SubmitButton, passwordMeetsRules } from './AuthParts';
import { ConfirmEmailStep } from './ConfirmEmailStep';

interface SignupProps {
  onSwitchToLogin: (notice?: string) => void;
}

/** Checked here so people get a clear message before Cognito answers */
const usernameProblem = (username: string): string | null => {
  if (/\s/.test(username)) return 'Usernames can’t contain spaces.';
  if (username.includes('@')) return 'Pick a username that isn’t an email. Your email goes in the next field.';
  if (username.length < 3) return 'Usernames need at least 3 characters.';
  return null;
};

const Signup: React.FC<SignupProps> = ({ onSwitchToLogin }) => {
  const { signUp } = useAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const name = username.trim();
    const problem = usernameProblem(name);
    if (problem) { setError(problem); return; }
    if (!passwordMeetsRules(password)) {
      setError('Password needs at least 8 characters, including a lowercase letter and a number.');
      return;
    }

    setLoading(true);
    const result = await signUp(name, password, email.trim());
    setLoading(false);
    if (!result.success) {
      setError(result.error || 'Sign up failed.');
    } else if (result.requiresConfirmation) {
      setConfirming(true);
    } else {
      onSwitchToLogin('Your account is ready. Sign in to continue.');
    }
  };

  if (confirming) {
    return (
      <AuthLayout>
        <ConfirmEmailStep
          username={username.trim()}
          destination={email.trim()}
          password={password}
          backLabel="Back"
          onBack={() => setConfirming(false)}
          onConfirmedWithoutSignIn={onSwitchToLogin}
        />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout compact>
      <BackButton onClick={() => onSwitchToLogin()} />
      <div className="auth-heading">
        <h1>Create your account</h1>
      </div>

      <form className="auth-form" onSubmit={handleSubmit}>
        {error && <AuthAlert type="error">{error}</AuthAlert>}

        <div className="form-group">
          <label className="form-label" htmlFor="username">Username</label>
          <input
            id="username"
            type="text"
            className="form-input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            autoFocus
            required
            aria-describedby="username-hint"
          />
          <p id="username-hint" className="form-hint">No spaces. Capital letters don’t matter.</p>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            className="form-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            aria-describedby="email-hint"
          />
          <p id="email-hint" className="form-hint">You can sign in with this email or your username.</p>
        </div>

        <PasswordField
          id="new-password"
          label="Password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          showRules
        />

        <SubmitButton loading={loading}>{loading ? 'Creating your account…' : 'Create account'}</SubmitButton>
      </form>
    </AuthLayout>
  );
};

export default Signup;
