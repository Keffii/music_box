// Cognito pre-sign-up trigger for "Sign in as guest".
// Confirms guest accounts (username "guest-…" with an "@guest.invalid" email) without sending
// an email code. Every other sign-up goes through the normal email confirmation.
// Must match frontend/src/utils/guest.ts.
const GUEST_USERNAME = /^guest-[0-9a-f]{10}$/;
const GUEST_EMAIL_DOMAIN = '@guest.invalid';

export const handler = async (event) => {
  const email = event.request.userAttributes?.email ?? '';
  if (GUEST_USERNAME.test(event.userName) && email.endsWith(GUEST_EMAIL_DOMAIN)) {
    event.response.autoConfirmUser = true;
    event.response.autoVerifyEmail = false; // the address doesn't exist
  }
  return event;
};
