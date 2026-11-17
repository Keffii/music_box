import React, { useState } from 'react';
import './Sidebar.css';
import { useFavorites } from '../context/FavoritesContext';
import { usePlaylists } from '../context/PlaylistContext';
import { useAuth } from '../context/AuthContext';
import { displayName } from '../utils/guest';
import logo from '../assets/logo.png';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMusic, faHome, faSearch, faPlus, faHeart, faSignOutAlt, faUser, faTrash, faPlay } from '@fortawesome/free-solid-svg-icons';
import { Song } from '../types/music.types';
import { playSpecificSong } from '../services/playerService';

interface SidebarProps {
  onNavigate: (view: 'home' | 'category' | 'search' | 'playlist' | 'all-songs') => void;
  currentView: 'home' | 'category' | 'search' | 'playlist' | 'all-songs';
  onPlaylistClick?: (playlistId: number, playlistName: string) => void;
  selectedPlaylistId?: number | null;
  /** Phones and tablets: whether the slide-in menu is open */
  isOpen?: boolean;
  onClose?: () => void;
  /** Guests: open the sign-in / create-account screens */
  onSignIn?: () => void;
  onCreateAccount?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onNavigate, currentView, onPlaylistClick, selectedPlaylistId, isOpen, onClose, onSignIn, onCreateAccount }) => {
  const { favorites } = useFavorites();
  const { playlists, createPlaylist, deletePlaylist } = usePlaylists();
  const { user, isGuest, signOut } = useAuth();
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [hoveredFavoriteId, setHoveredFavoriteId] = useState<number | null>(null);

  const handleCreatePlaylist = async () => {
    if (newPlaylistName.trim()) {
      const success = await createPlaylist(newPlaylistName.trim());
      if (success) {
        setNewPlaylistName('');
        setShowCreatePlaylist(false);
      }
    }
  };

  const handleDeletePlaylist = async (playlistId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this playlist?')) {
      const deleted = await deletePlaylist(playlistId);
      // Don't stay on the page of a playlist that no longer exists
      if (deleted && currentView === 'playlist' && playlistId === selectedPlaylistId) {
        onNavigate('home');
      }
    }
  };

  const handleFavoriteSongClick = async (song: Song) => {
    const songIds = favorites.map(s => s.id);
    onClose?.();
    await playSpecificSong(song.id, songIds);
  };
  
  return (
    <div className={`sidebar${isOpen ? ' open' : ''}`}>
      <div className="sidebar-header">
        <img src={logo} alt="Music Box logo" className="sidebar-logo"/>
        <h1>Music Box</h1>
      </div>

      <nav className="sidebar-nav">
        <button className={`nav-item ${currentView === 'home' ? 'active' : ''}`} onClick={() => onNavigate('home')}>
          <FontAwesomeIcon icon={faHome} />
          <span>Home</span>
        </button>
        <button className={`nav-item ${currentView === 'search' ? 'active' : ''}`} onClick={() => onNavigate('search')}>
          <FontAwesomeIcon icon={faSearch} />
          <span>Search</span>
        </button>
      </nav>

      <div className="sidebar-section">
        <div className="section-header">
          <h3>PLAYLISTS</h3>
          <FontAwesomeIcon
            icon={faPlus}
            className="section-action"
            onClick={() => setShowCreatePlaylist(!showCreatePlaylist)}
            title="Create playlist"
          />
        </div>
        {showCreatePlaylist && (
          <div style={{ padding: '8px 0' }}>
            <input
              type="text"
              placeholder="Playlist name"
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleCreatePlaylist()}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid var(--border)',
                background: 'var(--card)',
                color: 'var(--foreground)',
                outline: 'none'
              }}
              autoFocus
            />
          </div>
        )}
        <ul className="playlist-list">
          {playlists.length === 0 ? (
            <li
              className="playlist-item playlist-empty"
              role="button"
              tabIndex={0}
              onClick={() => setShowCreatePlaylist(true)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setShowCreatePlaylist(true)}
              title="Create playlist"
            >
              <FontAwesomeIcon icon={faMusic} />
              <div>
                <div className="playlist-name">No playlists yet</div>
                <div className="playlist-count">Click here or + to create one</div>
              </div>
            </li>
          ) : (
            playlists.map(playlist => (
              <li
                key={playlist.id}
                className={`playlist-item${currentView === 'playlist' && playlist.id === selectedPlaylistId ? ' active' : ''}`}
                style={{ position: 'relative', cursor: 'pointer' }}
                onClick={() => {
                  if (onPlaylistClick) {
                    onPlaylistClick(playlist.id, playlist.name);
                  }
                }}
              >
                <FontAwesomeIcon icon={faMusic} />
                <div style={{ flex: 1 }}>
                  <div className="playlist-name">{playlist.name}</div>
                  <div className="playlist-count">{playlist.songCount} song{playlist.songCount !== 1 ? 's' : ''}</div>
                </div>
                <FontAwesomeIcon 
                  icon={faTrash} 
                  onClick={(e) => handleDeletePlaylist(playlist.id, e)}
                  style={{
                    fontSize: '12px',
                    opacity: 0.6,
                    cursor: 'pointer',
                    padding: '4px',
                    transition: 'opacity 0.2s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = '0.6'}
                />
              </li>
            ))
          )}
        </ul>
      </div>

      <div className="sidebar-section">
        <div className="section-header">
          <h3>
            <FontAwesomeIcon icon={faHeart} /> FAVORITES
          </h3>
        </div>
        <ul className="favorites-list">
          {favorites.length === 0 ? (
            <li className="favorite-item empty">
              <div className="favorite-name" style={{ opacity: 0.5 }}>No favorites yet</div>
            </li>
          ) : (
            favorites.map(song => (
              <li 
                key={song.id} 
                className="favorite-item"
                onClick={() => handleFavoriteSongClick(song)}
                onMouseEnter={() => setHoveredFavoriteId(song.id)}
                onMouseLeave={() => setHoveredFavoriteId(null)}
                style={{ cursor: 'pointer', position: 'relative' }}
              >
                {song.coverUrl && (
                  <div style={{ position: 'relative', flexShrink: 0, width: '40px', height: '40px', lineHeight: 0 }}>
                    <img 
                      src={song.coverUrl} 
                      alt={song.title}
                      className="favorite-cover"
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '4px',
                        objectFit: 'cover',
                        display: 'block'
                      }}
                    />
                    {(
                      <div className={`hover-overlay${hoveredFavoriteId === song.id ? ' visible' : ''}`} style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '40px',
                        height: '40px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'rgba(0, 0, 0, 0.6)',
                        borderRadius: '4px'
                      }}>
                        <div style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          background: 'hotpink',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 2px 6px rgba(255, 105, 180, 0.5)'
                        }}>
                          <FontAwesomeIcon icon={faPlay} style={{ fontSize: '10px', marginLeft: '1px', color: 'white' }} />
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <div className="favorite-text">
                  <div className="favorite-name">{song.title}</div>
                  <div className="favorite-artist">{song.artist}</div>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>

      <div className="sidebar-footer">
        {isGuest ? (
          // No account yet: everything works; an account adds the other devices and keeps what they made
          <div className="guest-card">
            <div className="guest-card-text">
              <strong>Sync your music across devices</strong>
              <span>
                <FontAwesomeIcon icon={faUser} /> Listening as a guest
              </span>
            </div>
            <div className="guest-actions">
              <button type="button" className="sign-out-button" onClick={() => { onClose?.(); onSignIn?.(); }}>
                Sign in
              </button>
              <button type="button" className="sign-out-button guest-create" onClick={() => { onClose?.(); onCreateAccount?.(); }}>
                Create account
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="user-profile">
              <div className="user-avatar">
                <FontAwesomeIcon icon={faUser} />
              </div>
              <div className="user-info">
                <div className="user-name">{displayName(user?.username)}</div>
              </div>
            </div>
            <button className="sign-out-button" onClick={signOut}>
              <FontAwesomeIcon icon={faSignOutAlt} />
              <span>Sign Out</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
