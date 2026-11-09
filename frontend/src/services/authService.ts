import { Amplify } from 'aws-amplify';
import {
  signIn,
  signUp,
  signOut,
  getCurrentUser,
  fetchAuthSession,
  confirmSignUp,
  resendSignUpCode,
  resetPassword,
  confirmResetPassword,
} from 'aws-amplify/auth';
import { friendlyAuthError } from '../utils/authErrors';
import { newGuestCredentials, loadGuest, saveGuest, clearGuest } from '../utils/guest';
import { API_BASE } from '../utils/constants';

// Configure Amplify (this will be called from index.tsx)
export const configureAmplify = () => {
  const userPoolId = process.env.REACT_APP_COGNITO_USER_POOL_ID;
  const userPoolClientId = process.env.REACT_APP_COGNITO_APP_CLIENT_ID;

  if (!userPoolId || !userPoolClientId) {
    console.warn('Cognito configuration missing. Auth will not work.');
    return;
  }

  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: userPoolId,
        userPoolClientId: userPoolClientId,
      }
    }
  });
};

export interface SignUpParams {
  username: string;
  password: string;
  email: string;
}

export interface SignInParams {
  username: string;
  password: string;
}

/** Every call returns this: on failure, `error` is a message fit to show and `code` the Cognito error name */
export interface AuthResult {
  success: boolean;
  error?: string;
  code?: string;
}

const failure = (error: any, label: string): AuthResult => {
  console.error(`${label}:`, error);
  return { success: false, code: error?.name, error: friendlyAuthError(error?.name, error?.message) };
};

export const authService = {
  // Sign up a new user
  async signUp({ username, password, email }: SignUpParams): Promise<AuthResult & { userId?: string; requiresConfirmation?: boolean }> {
    try {
      const { userId, nextStep } = await signUp({
        username,
        password,
        options: { userAttributes: { email } },
      });
      return { success: true, userId, requiresConfirmation: nextStep.signUpStep === 'CONFIRM_SIGN_UP' };
    } catch (error: any) {
      return failure(error, 'Sign up error');
    }
  },

  // Confirm sign up with the code from the email
  async confirmSignUp(username: string, code: string): Promise<AuthResult> {
    try {
      await confirmSignUp({ username, confirmationCode: code });
      return { success: true };
    } catch (error: any) {
      return failure(error, 'Confirmation error');
    }
  },

  // Send the confirmation code again
  async resendConfirmationCode(username: string): Promise<AuthResult & { destination?: string }> {
    try {
      const { destination } = await resendSignUpCode({ username });
      return { success: true, destination };
    } catch (error: any) {
      return failure(error, 'Resend code error');
    }
  },

  // Sign in with a username or a verified email.
  // An account that was never confirmed comes back with needsConfirmation, so the app can ask for the code.
  async signIn({ username, password }: SignInParams): Promise<AuthResult & { needsConfirmation?: boolean }> {
    try {
      const { isSignedIn, nextStep } = await signIn({ username, password });
      if (isSignedIn) return { success: true };
      if (nextStep.signInStep === 'CONFIRM_SIGN_UP') return { success: false, needsConfirmation: true };
      return { success: false, error: `Additional step required: ${nextStep.signInStep}` };
    } catch (error: any) {
      if (error?.name === 'UserNotConfirmedException') return { success: false, needsConfirmation: true };
      return failure(error, 'Sign in error');
    }
  },

  // Sign in as a guest: the same guest as last time in this browser if there is one, otherwise a new
  // throwaway account (see utils/guest.ts)
  async signInAsGuest(): Promise<AuthResult> {
    const saved = loadGuest();
    if (saved) {
      try {
        const { isSignedIn } = await signIn({ username: saved.username, password: saved.password });
        if (isSignedIn) return { success: true };
      } catch {
        // e.g. the guest account was removed: fall through and make a new one
      }
      clearGuest();
    }

    const credentials = newGuestCredentials();
    const { username, email, password } = credentials;
    try {
      const { nextStep } = await signUp({ username, password, options: { userAttributes: { email } } });
      if (nextStep.signUpStep !== 'DONE' && nextStep.signUpStep !== 'COMPLETE_AUTO_SIGN_IN') {
        // The pre-sign-up Lambda isn't attached, so Cognito wants an email code that will never arrive
        return { success: false, error: "Guest sign-in isn't available right now. Create an account instead." };
      }
      const { isSignedIn } = await signIn({ username, password });
      if (!isSignedIn) return { success: false, error: 'Guest sign-in failed. Try again.' };
      saveGuest(credentials);
      return { success: true };
    } catch (error: any) {
      return failure(error, 'Guest sign in error');
    }
  },

  // After a guest signs in to a real account: move the guest's playlists, favourites and history to it.
  // guestToken is the guest session's ID token, taken before switching accounts.
  async claimGuestData(guestToken: string): Promise<boolean> {
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      if (!token) return false;
      const res = await fetch(`${API_BASE}/api/account/claim-guest`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestToken }),
      });
      return res.ok;
    } catch (error) {
      console.error('Moving guest data failed:', error);
      return false;
    }
  },

  // Forgot password, step 1: email a reset code (works with the username or the email)
  async requestPasswordReset(username: string): Promise<AuthResult & { destination?: string }> {
    try {
      const { nextStep } = await resetPassword({ username });
      return { success: true, destination: nextStep.codeDeliveryDetails?.destination };
    } catch (error: any) {
      return failure(error, 'Reset password error');
    }
  },

  // Forgot password, step 2: the code and the new password
  async confirmPasswordReset(username: string, code: string, newPassword: string): Promise<AuthResult> {
    try {
      await confirmResetPassword({ username, confirmationCode: code, newPassword });
      return { success: true };
    } catch (error: any) {
      return failure(error, 'Confirm reset password error');
    }
  },

  // Sign out
  async signOut(): Promise<AuthResult> {
    try {
      await signOut();
      return { success: true };
    } catch (error: any) {
      return failure(error, 'Sign out error');
    }
  },

  // Get current user
  async getCurrentUser() {
    try {
      const user = await getCurrentUser();
      return { success: true, user };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  // The ID token sent to the backend
  async getAccessToken(): Promise<string | null> {
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      return token || null;
    } catch (error) {
      console.error('Failed to get access token:', error);
      return null;
    }
  },

  // Check if user is authenticated
  async isAuthenticated(): Promise<boolean> {
    try {
      await getCurrentUser();
      return true;
    } catch {
      return false;
    }
  }
};
