import React, { useState, useRef, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faShuffle,
  faBackwardStep,
  faPlay,
  faPause,
  faForwardStep,
  faRepeat,
  faListUl,
} from '@fortawesome/free-solid-svg-icons';
import { faHeart as faHeartSolid } from '@fortawesome/free-solid-svg-icons';
import { faHeart as faHeartRegular } from '@fortawesome/free-regular-svg-icons';
import { sendCommand, addSongToPlaylist } from '../../services/playerService';
import { useFavorites } from '../../context/FavoritesContext';
import { usePlaylists } from '../../context/PlaylistContext';
import { useToast } from '../../context/ToastContext';
import { Song } from '../../types/music.types';

interface PlayerControlsProps {
  shuffleEnabled: boolean;
  isPlaying: boolean;
  repeatEnabled: boolean;
  currentSong: Song | null;
  onPlayPause: () => void;
}

export const PlayerControls: React.FC<PlayerControlsProps> = ({
  shuffleEnabled,
  isPlaying,
  repeatEnabled,
  currentSong,
  onPlayPause,
}) => {
  const { addFavorite, removeFavorite, isFavorite } = useFavorites();
  const { playlists, refreshPlaylists } = usePlaylists();
  const { showToast } = useToast();
  const [showPlaylistDropdown, setShowPlaylistDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowPlaylistDropdown(false);
      }
    };

    if (showPlaylistDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPlaylistDropdown]);

  const handleToggleFavorite = (): void => {
    if (!currentSong) return;
    
    if (isFavorite(currentSong.id)) {
      removeFavorite(currentSong.id);
    } else {
      addFavorite(currentSong);
    }
  };

  const handleAddToPlaylist = async (playlistId: number) => {
    if (!currentSong) return;
    
    const result = await addSongToPlaylist(playlistId, currentSong.id);
    if (result.success) {
      setShowPlaylistDropdown(false);
      const playlistName = result.playlistName || 'playlist';
      
      if (result.alreadyExists) {
        showToast(`Song already in ${playlistName}`, 'info');
      } else {
        showToast(`Song added to ${playlistName}`, 'success');
        // Reload so the song count in the sidebar goes up
        await refreshPlaylists();
      }
    } else {
      showToast('Failed to add song to playlist', 'error');
    }
  };

  return (
    // Three buttons on each side, so the play button sits in the middle
    <div className="player-controls">
      <button
        onClick={handleToggleFavorite}
        className={currentSong && isFavorite(currentSong.id) ? 'active' : ''}
        title={currentSong && isFavorite(currentSong.id) ? 'Remove from Favorites' : 'Add to Favorites'}
      >
        <FontAwesomeIcon icon={currentSong && isFavorite(currentSong.id) ? faHeartSolid : faHeartRegular} size="xl" />
      </button>
      <button
        onClick={() => sendCommand('SHUFFLE')}
        className={shuffleEnabled ? 'active' : ''}
        title="Shuffle"
      >
        <FontAwesomeIcon icon={faShuffle} size="xl" />
      </button>
      <button onClick={() => sendCommand('PREV')} title="Previous">
        <FontAwesomeIcon icon={faBackwardStep} size="xl" />
      </button>
      <button className="play-button" onClick={onPlayPause} title={isPlaying ? 'Pause' : 'Play'}>
        <FontAwesomeIcon icon={isPlaying ? faPause : faPlay} size="2xl" />
      </button>
      <button onClick={() => sendCommand('NEXT')} title="Next">
        <FontAwesomeIcon icon={faForwardStep} size="xl" />
      </button>
      <button
        onClick={() => sendCommand('REPEAT')}
        className={repeatEnabled ? 'active' : ''}
        title="Repeat"
      >
        <FontAwesomeIcon icon={faRepeat} size="xl" />
      </button>
      <div style={{ position: 'relative' }} ref={dropdownRef}>
        <button
          onClick={() => setShowPlaylistDropdown(!showPlaylistDropdown)}
          title="Add to Playlist"
        >
          <FontAwesomeIcon icon={faListUl} size="xl" />
        </button>
        {showPlaylistDropdown && (
          <div style={{
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginBottom: '8px',
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '8px',
            minWidth: '200px',
            maxHeight: '300px',
            overflowY: 'auto',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            zIndex: 1000
          }}>
            <div style={{
              fontSize: '12px',
              fontWeight: '600',
              color: 'var(--muted-foreground)',
              marginBottom: '8px',
              padding: '0 8px'
            }}>
              Add to Playlist
            </div>
            {playlists.length === 0 ? (
              <div style={{
                padding: '12px 8px',
                textAlign: 'center',
                color: 'var(--muted-foreground)',
                fontSize: '13px'
              }}>
                No playlists yet
              </div>
            ) : (
              playlists.map(playlist => (
                <div
                  key={playlist.id}
                  onClick={() => handleAddToPlaylist(playlist.id)}
                  style={{
                    padding: '10px 8px',
                    cursor: 'pointer',
                    borderRadius: '4px',
                    fontSize: '13px',
                    color: 'var(--foreground)',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--secondary)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  {playlist.name}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
