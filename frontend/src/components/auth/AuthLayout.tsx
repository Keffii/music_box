import React from 'react';
import logo from '../../assets/logo.png';
import '../Auth.css';

const REPO_URL = 'https://github.com/Keffii/music_box';
const STACK = ['React', 'TypeScript', 'Spring Boot', 'MySQL', 'AWS'];

const GitHubMark: React.FC = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="currentColor">
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
  </svg>
);

/**
 * The sign-in, sign-up and password-reset screens: one centred column on every screen size.
 * The logo and a one-line description on top, the form in a card, and what it's built with underneath.
 */
export const AuthLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="auth-page">
    <main className="auth-main">
      <header className="auth-brand">
        <img src={logo} alt="" className="auth-brand-logo" />
        <span className="auth-brand-name">Music Box</span>
        <p className="auth-tagline">Stream music, build playlists and keep playback in sync on every device.</p>
      </header>

      <div className="auth-card">{children}</div>

      <footer className="auth-footer">
        <ul className="auth-stack" aria-label="Built with">
          {STACK.map(s => <li key={s}>{s}</li>)}
        </ul>
        <div className="auth-legal">
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
            <GitHubMark />
            Source on GitHub
          </a>
          <span aria-hidden="true">·</span>
          <span>Music from Pixabay</span>
        </div>
      </footer>
    </main>
  </div>
);
