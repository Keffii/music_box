import React, { useState, useEffect } from 'react';
import './App.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBars } from '@fortawesome/free-solid-svg-icons';
import logo from './assets/logo.png';
import Sidebar from './components/Sidebar';
import MainContent from './components/MainContent';
import MusicPlayer from './components/MusicPlayer';
import Login from './components/Login';
import Signup from './components/Signup';
import { FavoritesProvider } from './context/FavoritesContext';
import { PlaylistProvider } from './context/PlaylistContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';

const AppContent: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const [authView, setAuthView] = useState<'login' | 'signup'>('login');
  const [mainView, setMainView] = useState<'home' | 'category' | 'search' | 'playlist' | 'all-songs'>('home');
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<number | null>(null);
  const [selectedPlaylistName, setSelectedPlaylistName] = useState<string | null>(null);
  // On phones and tablets the sidebar is a slide-in menu
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const handleNavigate = (view: 'home' | 'category' | 'search' | 'playlist' | 'all-songs') => {
    setMenuOpen(false);
    setMainView(view);
    if (view !== 'playlist') {
      setSelectedPlaylistId(null);
      setSelectedPlaylistName(null);
    }
  };

  const handlePlaylistClick = (playlistId: number, playlistName: string) => {
    setMenuOpen(false);
    setSelectedPlaylistId(playlistId);
    setSelectedPlaylistName(playlistName);
    setMainView('playlist');
  };

  if (isLoading) {
    return (
      <div className="App" style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        height: '100vh'
      }}>
        <p style={{ color: 'var(--foreground)' }}>Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return authView === 'login' ? (
      <Login onSwitchToSignup={() => setAuthView('signup')} />
    ) : (
      <Signup onSwitchToLogin={() => setAuthView('login')} />
    );
  }

  return (
    <ToastProvider>
      <FavoritesProvider>
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
                currentView={mainView}
                onPlaylistClick={handlePlaylistClick}
                selectedPlaylistId={selectedPlaylistId}
                isOpen={menuOpen}
                onClose={() => setMenuOpen(false)}
              />
              <MainContent 
                viewMode={mainView} 
                onNavigate={handleNavigate}
                selectedPlaylistId={selectedPlaylistId}
                selectedPlaylistName={selectedPlaylistName}
              />
            </div>
            <MusicPlayer />
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