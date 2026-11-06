import { Amplify } from 'aws-amplify';
import { 
  signIn, 
  signUp, 
  signOut, 
  getCurrentUser,
  fetchAuthSession,
  confirmSignUp,
  resendSignUpCode
} from 'aws-amplify/auth';

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

export const authService = {
  // Sign up a new user
  async signUp({ username, password, email }: SignUpParams) {
    try {
      const { userId, nextStep } = await signUp({
        username,
        password,
        options: {
          userAttributes: {
            email,
          },
        },
      });
      
      return { 
        success: true, 
        userId, 
        requiresConfirmation: nextStep.signUpStep === 'CONFIRM_SIGN_UP'
      };
    } catch (error: any) {
      console.error('Sign up error:', error);
      return { 
        success: false, 
        error: error.message || 'Sign up failed'
      };
    }
  },

  // Confirm sign up with verification code
  async confirmSignUp(username: string, code: string) {
    try {
      await confirmSignUp({ username, confirmationCode: code });
      return { success: true };
    } catch (error: any) {
      console.error('Confirmation error:', error);
      return { 
        success: false, 
        error: error.message || 'Confirmation failed'
      };
    }
  },

  // Resend confirmation code
  async resendConfirmationCode(username: string) {
    try {
      await resendSignUpCode({ username });
      return { success: true };
    } catch (error: any) {
      console.error('Resend code error:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to resend code'
      };
    }
  },

  // Sign in
  async signIn({ username, password }: SignInParams) {
    try {
      const { isSignedIn, nextStep } = await signIn({ username, password });
      
      if (isSignedIn) {
        return { success: true };
      } else {
        return { 
          success: false, 
          error: `Additional step required: ${nextStep.signInStep}`
        };
      }
    } catch (error: any) {
      console.error('Sign in error:', error);
      return { 
        success: false, 
        error: error.message || 'Sign in failed'
      };
    }
  },

  // Sign out
  async signOut() {
    try {
      await signOut();
      return { success: true };
    } catch (error: any) {
      console.error('Sign out error:', error);
      return { 
        success: false, 
        error: error.message || 'Sign out failed'
      };
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

  // Get JWT token
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
