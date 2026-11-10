import React, { useState, useEffect } from 'react';
import './App.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBars } from '@fortawesome/free-solid-svg-icons';
import logo from './assets/logo.png';
import Sidebar from './components/Sidebar';
import MainContent from './components/MainContent';
import MusicPlayer from './components/MusicPlayer';
import { FavoritesProvider } from './context/FavoritesContext';
import { PlaylistProvider } from './context/PlaylistContext';
import { ToastProvider } from './context/ToastContext';
import { useRoute, View } from './utils/router';

/**
 * The local demo has no accounts: the app opens straight away, and every browser and the ESP32
 * remote share one player and one library.
 */
const App: React.FC = () => {
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
                currentView={route.view}
                onPlaylistClick={handlePlaylistClick}
                selectedPlaylistId={selectedPlaylistId}
                isOpen={menuOpen}
                onClose={() => setMenuOpen(false)}
              />
              <MainContent route={route} navigate={navigate} />
            </div>
            <MusicPlayer onOpenSearch={openSearch} />
          </div>
        </PlaylistProvider>
      </FavoritesProvider>
    </ToastProvider>
  );
};

export default App;
