import React, { useState } from 'react';
import './App.css';
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

  const handleNavigate = (view: 'home' | 'category' | 'search' | 'playlist' | 'all-songs') => {
    setMainView(view);
    if (view !== 'playlist') {
      setSelectedPlaylistId(null);
      setSelectedPlaylistName(null);
    }
  };

  const handlePlaylistClick = (playlistId: number, playlistName: string) => {
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
            <div className="app-container">
              <Sidebar 
                onNavigate={handleNavigate} 
                currentView={mainView} 
                onPlaylistClick={handlePlaylistClick}
                selectedPlaylistId={selectedPlaylistId}
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