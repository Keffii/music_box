import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faListUl, faTowerBroadcast, faKeyboard } from '@fortawesome/free-solid-svg-icons';
import logo from '../../assets/logo.png';
import '../Auth.css';

const REPO_URL = 'https://github.com/Keffii/music_box';

const FEATURES = [
  { icon: faListUl, title: 'Playlists and favourites', text: 'Save the songs you love and build playlists that follow you.' },
  { icon: faTowerBroadcast, title: 'Live sync across devices', text: 'Press play on your phone and your laptop follows along.' },
  { icon: faKeyboard, title: 'Media keys and shortcuts', text: 'Control playback from the keyboard, headphones or lock screen.' },
];

const STACK = ['React', 'TypeScript', 'Spring Boot', 'MySQL', 'AWS'];

const COVERS = ['showcase/lofi.jpg', 'showcase/electronic.jpg', 'showcase/hiphop.jpg', 'showcase/trance.webp'];

const GitHubMark: React.FC = () => (
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="currentColor">
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
  </svg>
);

/**
 * The sign-in, sign-up and password-reset screens: what Music Box is on the left (for a visitor
 * arriving from a CV or LinkedIn), the form on the right. On phones only the form, under the logo.
 */
export const AuthLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="auth-page">
    <aside className="auth-showcase" aria-label="About Music Box">
      <div className="auth-brand">
        <img src={logo} alt="" className="auth-brand-logo" />
        <span>Music Box</span>
      </div>

      <div className="auth-showcase-body">
        <div className="auth-covers" aria-hidden="true">
          {COVERS.map((src, i) => (
            <img key={src} src={`${process.env.PUBLIC_URL}/${src}`} alt="" style={{ '--i': i } as React.CSSProperties} />
          ))}
        </div>

        <h2 className="auth-headline">Your music, in sync on every device.</h2>
        <p className="auth-lead">
          A music streaming app with playlists, favourites and live playback sync,
          built as a full-stack project.
        </p>

        <ul className="auth-features">
          {FEATURES.map(f => (
            <li key={f.title}>
              <span className="auth-feature-icon"><FontAwesomeIcon icon={f.icon} /></span>
              <span>
                <strong>{f.title}</strong>
                <span>{f.text}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="auth-showcase-footer">
        <ul className="auth-stack" aria-label="Built with">
          {STACK.map(s => <li key={s}>{s}</li>)}
        </ul>
        <a className="auth-repo-link" href={REPO_URL} target="_blank" rel="noopener noreferrer">
          <GitHubMark />
          View the source on GitHub
        </a>
      </div>
    </aside>

    <main className="auth-main">
      <div className="auth-mobile-brand">
        <img src={logo} alt="" className="auth-brand-logo" />
        <span>Music Box</span>
      </div>

      <div className="auth-panel">{children}</div>

      <footer className="auth-legal">
        <span>Music from Pixabay</span>
        <span aria-hidden="true">·</span>
        <a href={REPO_URL} target="_blank" rel="noopener noreferrer">Source on GitHub</a>
      </footer>
    </main>
  </div>
);
