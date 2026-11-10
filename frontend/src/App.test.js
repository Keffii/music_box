import { render, screen } from '@testing-library/react';
import App from './App';

// The backend isn't running in tests: every API call answers with an empty list, and the
// player stream with no body (the hook then just retries later)
beforeEach(() => {
  global.fetch = jest.fn(() =>
    Promise.resolve({ ok: true, status: 200, body: null, json: () => Promise.resolve([]) })
  );
  // jsdom has no scrolling; the page scrolls to the top when it changes
  Element.prototype.scrollTo = jest.fn();
});

afterEach(() => {
  delete global.fetch;
});

test('opens straight into the player, with no sign-in screen', async () => {
  render(<App />);
  expect(await screen.findByText(/browse genres/i)).toBeInTheDocument();
  expect(screen.queryByText(/sign in/i)).not.toBeInTheDocument();
});

test('explains that every browser and the remote share one player', async () => {
  render(<App />);
  expect(await screen.findByText(/one shared player/i)).toBeInTheDocument();
  expect(screen.getByText(/esp32 remote control the same music/i)).toBeInTheDocument();
});
