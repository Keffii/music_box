import { render, screen } from '@testing-library/react';
import App from './App';

test('shows the sign-in screen when nobody is logged in', async () => {
  localStorage.clear();
  render(<App />);
  expect(await screen.findByText(/sign in to continue/i)).toBeInTheDocument();
});
