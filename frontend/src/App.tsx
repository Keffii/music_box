import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBars } from '@fortawesome/free-solid-svg-icons';
import logo from './assets/logo.png';
import Sidebar from './components/Sidebar';
import MainContent from './components/MainContent';
import MusicPlayer from './components/MusicPlayer';
import { GuestNudge } from './components/GuestNudge';
import Login from './components/auth/Login';
import Signup from './components/auth/Signup';
import ForgotPassword from './components/auth/ForgotPassword';
import { FavoritesProvider } from './context/FavoritesContext';
import { PlaylistProvider } from './context/PlaylistContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { useRoute, View } from './utils/router';

const AppContent: React.FC = () => {
  const { isAuthenticated, isGuest, isLoading, user } = useAuth();
  const [authView, setAuthView] = useState<'login' | 'signup' | 'forgot'>('login');
  // A guest can open the sign-in / create-account screens from the sidebar
  const [authOpen, setAuthOpen] = useState(false);
  const [authNotice, setAuthNotice] = useState<string | undefined>();
  // The page comes from the address bar, so Back/Forward and shared links work
  const [route, navigate] = useRoute();
  const selectedPlaylistId = route.view === 'playlist' ? route.id : null;
  // On phones and tablets the sidebar is a slide-in menu
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  // Back/Forward also closes the phone menu
  useEffect(() => {
    setMenuOpen(false);
  }, [route]);

  // Signing out goes back to Home, so the next person doesn't land on your playlist.
  // (Opening a shared link while signed out keeps it, and shows that page after sign-in.)
  const wasSignedIn = useRef(false);
  useEffect(() => {
    if (wasSignedIn.current && !isAuthenticated) navigate({ view: 'home' }, { replace: true });
    wasSignedIn.current = isAuthenticated;
  }, [isAuthenticated, navigate]);

  // Signed in to a real account: back to the app
  useEffect(() => {
    if (isAuthenticated && !isGuest) setAuthOpen(false);
  }, [isAuthenticated, isGuest]);

  const openAuth = (view: 'login' | 'signup') => {
    setMenuOpen(false);
    setAuthNotice(undefined);
    setAuthView(view);
    setAuthOpen(true);
  };

  const handleNavigate = (view: View) => {
    setMenuOpen(false);
    if (view === 'home' || view === 'search' || view === 'all-songs') navigate({ view });
  };

  // The / shortcut: go to search and put the cursor in the box
  const openSearch = () => {
    if (route.view !== 'search') navigate({ view: 'search' });
    setTimeout(() => document.querySelector<HTMLInputElement>('.search-input')?.focus(), 0);
  };

  const handlePlaylistClick = (playlistId: number) => {
    setMenuOpen(false);
    navigate({ view: 'playlist', id: playlistId });
  };

  if (isLoading) {
    return (
      <div className="app-loading" role="status" aria-label="Loading Music Box">
        <img src={logo} alt="" className="app-loading-logo" />
        <span className="app-loading-bar" aria-hidden="true" />
      </div>
    );
  }

  // The sign-in screens: when there's no session at all (guest sessions switched off or failed),
  // or when a guest opened them from the sidebar
  if (!isAuthenticated || authOpen) {
    // Each screen can hand a message to the sign-in screen (e.g. "Your password is changed")
    const toLogin = (notice?: string) => {
      setAuthNotice(notice);
      setAuthView('login');
    };
    if (authView === 'signup') return <Signup onSwitchToLogin={toLogin} />;
    if (authView === 'forgot') return <ForgotPassword onBack={toLogin} />;
    return (
      <Login
        key={authNotice || 'login'}
        notice={authNotice}
        onSwitchToSignup={() => { setAuthNotice(undefined); setAuthView('signup'); }}
        onForgotPassword={() => { setAuthNotice(undefined); setAuthView('forgot'); }}
        onClose={isAuthenticated ? () => setAuthOpen(false) : undefined}
      />
    );
  }

  return (
    <ToastProvider>
      {/* Keyed by user: going from guest to an account reloads playlists, favourites and the player */}
      <FavoritesProvider key={user?.userId}>
        <PlaylistProvider>
          <div className="App">
            {/* Only shown on phones and tablets (App.css) */}
            <header className="mobile-topbar">
              <button
                type="button"
                className="menu-button"
                onClick={() => setMenuOpen(true)}
                aria-label="Open menu"
                aria-expanded={menuOpen}
              >
                <FontAwesomeIcon icon={faBars} />
              </button>
              <img src={logo} alt="" className="mobile-topbar-logo" />
              <span className="mobile-topbar-title">Music Box</span>
            </header>
            {menuOpen && <div className="sidebar-backdrop" onClick={() => setMenuOpen(false)} />}
            <div className="app-container">
              <Sidebar
                onNavigate={handleNavigate}
                currentView={route.view}
                onPlaylistClick={handlePlaylistClick}
                selectedPlaylistId={selectedPlaylistId}
                isOpen={menuOpen}
                onClose={() => setMenuOpen(false)}
                onSignIn={() => openAuth('login')}
                onCreateAccount={() => openAuth('signup')}
              />
              <MainContent route={route} navigate={navigate} />
            </div>
            <MusicPlayer onOpenSearch={openSearch} />
            <GuestNudge onCreateAccount={() => openAuth('signup')} />
          </div>
        </PlaylistProvider>
      </FavoritesProvider>
    </ToastProvider>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;