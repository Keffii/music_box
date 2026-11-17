/**
 * Turns Cognito errors into plain messages. Cognito's own wording ("Incorrect username or password.",
 * "Invalid verification code provided, please try again.") is fine for developers, not for visitors.
 */
export const friendlyAuthError = (code?: string, message?: string): string => {
  switch (code) {
    case 'NotAuthorizedException':
      if (message?.toLowerCase().includes('attempts exceeded')) {
        return 'Too many failed attempts. Wait a few minutes and try again.';
      }
      return 'Incorrect username, email or password.';
    case 'UserNotFoundException':
      return 'Incorrect username, email or password.';
    case 'UsernameExistsException':
      return 'That username is taken. Try another one.';
    case 'AliasExistsException':
      return 'That email already belongs to another account.';
    case 'InvalidPasswordException':
      return 'Password needs at least 8 characters, including a lowercase letter and a number.';
    case 'CodeMismatchException':
      return "That code isn't right. Check the email and try again.";
    case 'ExpiredCodeException':
      return 'That code has expired. Send a new one.';
    case 'LimitExceededException':
    case 'TooManyRequestsException':
    case 'TooManyFailedAttemptsException':
      return 'Too many attempts. Wait a few minutes and try again.';
    case 'CodeDeliveryFailureException':
      return "We couldn't send the email. Check the address and try again.";
    case 'NetworkError':
      return 'No connection. Check your internet and try again.';
    case 'EmptySignInUsername':
    case 'EmptySignUpUsername':
      return 'Enter your username.';
    case 'EmptySignInPassword':
    case 'EmptySignUpPassword':
      return 'Enter your password.';
    default:
      return message || 'Something went wrong. Please try again.';
  }
};
