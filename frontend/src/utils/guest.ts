/**
 * Guest accounts: "Sign in as guest" creates a throwaway Cognito user per visitor, so nobody shares
 * a password or a playlist. The user pool's pre-sign-up Lambda (infra/aws/guest-pre-signup)
 * confirms these accounts without an email, recognising them by the prefix and the email domain.
 */
export const GUEST_PREFIX = 'guest-';
export const GUEST_EMAIL_DOMAIN = 'guest.invalid';

/** The button only shows once the Lambda is attached (Amplify env var REACT_APP_GUEST_SIGN_IN=true) */
export const GUEST_SIGN_IN_ENABLED = process.env.REACT_APP_GUEST_SIGN_IN === 'true';

export const isGuestUsername = (username?: string) => !!username && username.startsWith(GUEST_PREFIX);

/** What the app calls the user: "Guest" for guest accounts, the username otherwise */
export const displayName = (username?: string) => (isGuestUsername(username) ? 'Guest' : username || 'User');

const randomHex = (bytes: number) =>
  Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, '0')).join('');

/** A fresh username, email and password. The password is never shown; the session keeps the guest signed in. */
export const newGuestCredentials = () => {
  const username = `${GUEST_PREFIX}${randomHex(5)}`;
  return {
    username,
    email: `${username}@${GUEST_EMAIL_DOMAIN}`,
    // Upper, lower, digit and symbol, so it passes any Cognito password policy
    password: `Gx9!${randomHex(16)}`,
  };
};
