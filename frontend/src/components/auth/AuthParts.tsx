import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faEyeSlash, faCircle } from '@fortawesome/free-regular-svg-icons';
import { faCircleCheck, faCircleExclamation, faCircleInfo, faArrowLeft } from '@fortawesome/free-solid-svg-icons';

/** The ← button at the top of a card, back to the sign-in screen (or the previous step) */
export const BackButton: React.FC<{ onClick: () => void; label?: string }> = ({ onClick, label = 'Back to sign in' }) => (
  <button type="button" className="auth-back" onClick={onClick}>
    <FontAwesomeIcon icon={faArrowLeft} />
    {label}
  </button>
);

/** The same rules as the Cognito user pool */
const PASSWORD_RULES: { label: string; test: (v: string) => boolean }[] = [
  { label: 'At least 8 characters', test: (v) => v.length >= 8 },
  { label: 'A lowercase letter', test: (v) => /[a-z]/.test(v) },
  { label: 'A number', test: (v) => /[0-9]/.test(v) },
];

export const passwordMeetsRules = (value: string) => PASSWORD_RULES.every(rule => rule.test(value));

interface PasswordFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: 'current-password' | 'new-password';
  placeholder?: string;
  /** Shows the password rules, ticking each one off while typing (sign-up and new password) */
  showRules?: boolean;
  /** Something on the right of the label, e.g. "Forgot password?" */
  labelAction?: React.ReactNode;
  autoFocus?: boolean;
}

/** A password input with a show/hide button and, optionally, the password rules */
export const PasswordField: React.FC<PasswordFieldProps> = ({
  id, label, value, onChange, autoComplete, placeholder, showRules, labelAction, autoFocus,
}) => {
  const [visible, setVisible] = useState(false);

  return (
    <div className="form-group">
      <div className="form-label-row">
        <label className="form-label" htmlFor={id}>{label}</label>
        {labelAction}
      </div>
      <div className="password-input">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          className="form-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          required
          aria-describedby={showRules ? `${id}-rules` : undefined}
        />
        <button
          type="button"
          className="password-toggle"
          onClick={() => setVisible(v => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          title={visible ? 'Hide password' : 'Show password'}
        >
          <FontAwesomeIcon icon={visible ? faEyeSlash : faEye} />
        </button>
      </div>
      {showRules && (
        <ul id={`${id}-rules`} className="password-rules">
          {PASSWORD_RULES.map(rule => {
            const met = rule.test(value);
            return (
              <li key={rule.label} className={met ? 'met' : ''}>
                <FontAwesomeIcon icon={met ? faCircleCheck : faCircle} fixedWidth />
                {rule.label}
                <span className="visually-hidden">{met ? ' (done)' : ' (not yet)'}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

interface AuthAlertProps {
  type: 'error' | 'success' | 'info';
  children: React.ReactNode;
}

/** An error, success or info message above a form */
export const AuthAlert: React.FC<AuthAlertProps> = ({ type, children }) => (
  <div className={`auth-alert auth-alert--${type}`} role={type === 'error' ? 'alert' : 'status'}>
    <FontAwesomeIcon icon={type === 'error' ? faCircleExclamation : type === 'success' ? faCircleCheck : faCircleInfo} />
    <span>{children}</span>
  </div>
);

interface SubmitButtonProps {
  loading: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}

/** The form's main button, with a spinner while it works */
export const SubmitButton: React.FC<SubmitButtonProps> = ({ loading, disabled, children }) => (
  <button type="submit" className="auth-button" disabled={loading || disabled} aria-busy={loading}>
    {loading && <span className="auth-spinner" aria-hidden="true" />}
    <span>{children}</span>
  </button>
);
