import React, { useState, useEffect } from 'react';
import './MainContent.css';
import { loadSongsByCategory, getRecentlyPlayed, searchSongs, getPlaylistSongs, setPlaylistQueue, playSpecificSong, loadSongs, removeSongFromPlaylist } from '../services/playerService';
import { Song } from '../types/music.types';
import { SongCard } from './SongCard';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faCompass, faPlay, faMusic, faPen, faBolt, faMicrophoneLines, faMugHot, faWaveSquare, faRecordVinyl } from '@fortawesome/free-solid-svg-icons';
import { faClock } from '@fortawesome/free-regular-svg-icons';
import { useAuth } from '../context/AuthContext';
import { usePlaylists } from '../context/PlaylistContext';
import { useToast } from '../context/ToastContext';
import { BrowseTile } from './BrowseTile';

/** Genre tiles on the home page. `name` is the category stored on each song. */
const GENRES = [
  { name: 'Electronic', label: 'Electronic', icon: faBolt, hue: 265, tagline: 'Synths and pulses' },
  { name: 'Hiphop', label: 'Hip-Hop', icon: faMicrophoneLines, hue: 320, tagline: 'Beats and bars' },
  { name: 'Lofi', label: 'Lofi', icon: faMugHot, hue: 20, tagline: 'Slow and cosy' },
  { name: 'Trance', label: 'Trance', icon: faWaveSquare, hue: 195, tagline: 'Long builds' },
];

const countLabel = (n: number) => `${n} song${n !== 1 ? 's' : ''}`;

/** The first few songs that have a cover */
const pickCovers = (songs: Song[], max: number) => songs.filter(s => s.coverUrl).slice(0, max);

interface MainContentProps {
  viewMode: 'home' | 'category' | 'search' | 'playlist' | 'all-songs';
  onNavigate: (mode: 'home' | 'category' | 'search' | 'playlist' | 'all-songs') => void;
  selectedPlaylistId?: number | null;
  selectedPlaylistName?: string | null;
}

const MainContent: React.FC<MainContentProps> = ({ 
  viewMode: propViewMode, 
  onNavigate, 
  selectedPlaylistId, 
  selectedPlaylistName 
}) => {
  const { user } = useAuth();
  const { playlists, renamePlaylist, refreshPlaylists } = usePlaylists();
  const { showToast } = useToast();
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [viewMode, setViewMode] = useState<'home' | 'category' | 'search' | 'playlist' | 'all-songs'>(propViewMode);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [categorySongs, setCategorySongs] = useState<Song[]>([]);
  const [recentlyPlayed, setRecentlyPlayed] = useState<Song[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<Song[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [playlistSongs, setPlaylistSongs] = useState<Song[]>([]);
  const [allSongs, setAllSongs] = useState<Song[]>([]);
  const [library, setLibrary] = useState<Song[]>([]);

  // Load recently played songs
  const loadRecentlyPlayed = async () => {
    const songs = await getRecentlyPlayed();
    setRecentlyPlayed(songs.slice(0, 7)); // Show max 7 songs
  };

  // Sync viewMode from props
  useEffect(() => {
    setViewMode(propViewMode);
  }, [propViewMode]);

  // Load playlist songs when viewing a playlist
  useEffect(() => {
    setIsRenaming(false);
    if (viewMode === 'playlist' && selectedPlaylistId) {
      const loadPlaylist = async () => {
        const songs = await getPlaylistSongs(selectedPlaylistId);
        setPlaylistSongs(songs);
      };
      loadPlaylist();
    }
  }, [viewMode, selectedPlaylistId]);

  // Load recently played, and the library for the tile counts and covers, on mount
  useEffect(() => {
    loadRecentlyPlayed();
    loadSongs().then((songs) => setLibrary(Array.isArray(songs) ? songs : []));
  }, []);

  // Real-time search with debounce
  useEffect(() => {
    const delaySearch = setTimeout(async () => {
      if (searchQuery.trim().length > 0) {
        setIsSearching(true);
        const results = await searchSongs(searchQuery);
        setSearchResults(results);
        setIsSearching(false);
      } else {
        setSearchResults([]);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(delaySearch);
  }, [searchQuery]);

  // Listen for song changes via SSE and update recently played
  useEffect(() => {
    const handleSongChange = (event: Event) => {
      const customEvent = event as CustomEvent;
      console.log('Received songChanged event:', customEvent.detail);
      // Delay slightly to ensure backend has processed the command
      setTimeout(() => {
        console.log('Reloading recently played...');
        loadRecentlyPlayed();
      }, 500);
    };

    console.log('Setting up songChanged listener');
    window.addEventListener('songChanged', handleSongChange);
    
    return () => {
      console.log('Removing songChanged listener');
      window.removeEventListener('songChanged', handleSongChange);
    };
  }, []);

  const handleCategoryClick = async (category: string) => {
    setSelectedCategory(category);
    setViewMode('category');
    // Tell App too, so clicking Home in the sidebar is a real change and switches back
    onNavigate('category');
    const songs = await loadSongsByCategory(category);
    setCategorySongs(songs);
    console.log(`${category} songs:`, songs);
  };

  const handleBrowseAllSongs = async () => {
    setViewMode('all-songs');
    onNavigate('all-songs');
    const songs = await loadSongs();
    setAllSongs(songs);
    console.log('All songs:', songs);
  };

  const handleBackToHome = () => {
    setViewMode('home');
    onNavigate('home');
    setSelectedCategory(null);
    setCategorySongs([]);
    setSearchQuery('');
    setSearchResults([]);
    setPlaylistSongs([]);
    setAllSongs([]);
  };

  const handlePlayAll = async () => {
    if (playlistSongs.length === 0) return;
    
    // Get song IDs from playlist songs
    const songIds = playlistSongs.map(song => song.id);
    
    // Set the playlist queue on the backend
    const success = await setPlaylistQueue(songIds);
    if (success) {
      console.log('Playlist queue set, now playing playlist songs only');
    }
  };

  const handleSongClick = async (song: Song, songsInContext: Song[]) => {
    const songIds = songsInContext.map(s => s.id);
    const success = await playSpecificSong(song.id, songIds);
    if (success) {
      // Refresh recently played after a short delay to ensure backend has updated
      setTimeout(() => {
        loadRecentlyPlayed();
      }, 500);
    }
  };

  // The live name from the playlist list, so a rename shows here and in the sidebar at once
  const playlistName = playlists.find(p => p.id === selectedPlaylistId)?.name || selectedPlaylistName || 'Playlist';

  const startRename = () => {
    setRenameValue(playlistName);
    setIsRenaming(true);
  };

  const saveRename = async () => {
    const name = renameValue.trim();
    setIsRenaming(false);
    if (!selectedPlaylistId || !name || name === playlistName) return;
    if (!(await renamePlaylist(selectedPlaylistId, name))) {
      showToast('Could not rename the playlist', 'error');
    }
  };

  const handleRemoveFromPlaylist = async (song: Song) => {
    if (!selectedPlaylistId) return;
    if (await removeSongFromPlaylist(selectedPlaylistId, song.id)) {
      setPlaylistSongs(songs => songs.filter(s => s.id !== song.id));
      refreshPlaylists(); // song count in the sidebar
      showToast(`Removed ${song.title} from ${playlistName}`, 'success');
    } else {
      showToast('Could not remove the song', 'error');
    }
  };

  // Playlist Page View
  if (viewMode === 'playlist' && selectedPlaylistId) {
    return (
      <div className="main-content">
        <div className="greeting-section">
          <button 
            onClick={handleBackToHome}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              color: 'white',
              padding: '0.5rem 1rem',
              borderRadius: '20px',
              cursor: 'pointer',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <FontAwesomeIcon icon={faArrowLeft} />
            Back to Home
          </button>
          <div>
            {isRenaming ? (
              <input
                className="playlist-rename-input"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveRename();
                  if (e.key === 'Escape') setIsRenaming(false);
                }}
                onBlur={saveRename}
                aria-label="Playlist name"
                maxLength={100}
                autoFocus
              />
            ) : (
              <div className="playlist-title-row">
                <h1>{playlistName}</h1>
                <button type="button" className="playlist-rename-button" onClick={startRename} title="Rename playlist" aria-label="Rename playlist">
                  <FontAwesomeIcon icon={faPen} />
                </button>
              </div>
            )}
            <p>{playlistSongs.length} song{playlistSongs.length !== 1 ? 's' : ''}</p>
            {playlistSongs.length > 0 && (
              <button
                onClick={handlePlayAll}
                style={{
                  background: 'hotpink',
                  border: 'none',
                  color: 'white',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '25px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '16px',
                  fontWeight: '600',
                  boxShadow: '0 4px 12px rgba(255, 105, 180, 0.3)',
                  marginTop: '1rem'
                }}
              >
                <FontAwesomeIcon icon={faPlay} />
                Play All
              </button>
            )}
          </div>
        </div>

        {playlistSongs.length > 0 ? (
          <section className="content-section">
            <div className="card-grid">
              {playlistSongs.map((song) => (
                <SongCard
                  key={song.id}
                  song={song}
                  onPlay={() => handleSongClick(song, playlistSongs)}
                  onRemove={() => handleRemoveFromPlaylist(song)}
                />
              ))}
            </div>
          </section>
        ) : (
          <section className="content-section">
            <p style={{ textAlign: 'center', color: '#888', padding: '2rem' }}>No songs in this playlist yet</p>
          </section>
        )}
      </div>
    );
  }

  // Search Page View
  if (viewMode === 'search') {
    return (
      <div className="main-content">
        <div className="greeting-section">
          <button 
            onClick={handleBackToHome}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              color: 'white',
              padding: '0.5rem 1rem',
              borderRadius: '20px',
              cursor: 'pointer',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <FontAwesomeIcon icon={faArrowLeft} />
            Back to Home
          </button>
          <h1>Search</h1>
          <p>Find your favorite songs</p>
        </div>

        <section className="content-section">
          <div style={{ marginBottom: '1.5rem' }}>
            <input
              type="text"
              placeholder="Search by song title or artist..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'var(--card)',
                color: 'var(--foreground)',
                fontSize: '16px',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = 'hotpink'}
              onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
            />
          </div>

          {isSearching ? (
            <p style={{ textAlign: 'center', color: '#888', padding: '2rem' }}>Searching...</p>
          ) : searchQuery.trim().length === 0 ? (
            <p style={{ textAlign: 'center', color: '#888', padding: '2rem' }}>Start typing to search for songs</p>
          ) : searchResults.length > 0 ? (
            <div className="card-grid">
              {searchResults.map((song) => (
                <SongCard key={song.id} song={song} onPlay={() => handleSongClick(song, searchResults)} />
              ))}
            </div>
          ) : (
            <p style={{ textAlign: 'center', color: '#888', padding: '2rem' }}>No results found for "{searchQuery}"</p>
          )}
        </section>
      </div>
    );
  }

  // Category Page View
  if (viewMode === 'category' && selectedCategory) {
    return (
      <div className="main-content">
        <div className="greeting-section">
          <button 
            onClick={handleBackToHome}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              color: 'white',
              padding: '0.5rem 1rem',
              borderRadius: '20px',
              cursor: 'pointer',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <FontAwesomeIcon icon={faArrowLeft} />
            Back to Home
          </button>
          <h1>{selectedCategory}</h1>
          <p>{categorySongs.length} song{categorySongs.length !== 1 ? 's' : ''} available</p>
        </div>

        {categorySongs.length > 0 ? (
          <section className="content-section">
            <div className="card-grid">
              {categorySongs.map((song) => (
                <SongCard key={song.id} song={song} onPlay={() => handleSongClick(song, categorySongs)} />
              ))}
            </div>
          </section>
        ) : (
          <section className="content-section">
            <p style={{ textAlign: 'center', color: '#888', padding: '2rem' }}>No songs found in this category</p>
          </section>
        )}
      </div>
    );
  }

  // All Songs Page View
  if (viewMode === 'all-songs') {
    return (
      <div className="main-content">
        <div className="greeting-section">
          <button 
            onClick={handleBackToHome}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              color: 'white',
              padding: '0.5rem 1rem',
              borderRadius: '20px',
              cursor: 'pointer',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <FontAwesomeIcon icon={faArrowLeft} />
            Back to Home
          </button>
          <h1>All Songs</h1>
          <p>{allSongs.length} song{allSongs.length !== 1 ? 's' : ''} in library</p>
        </div>

        {allSongs.length > 0 ? (
          <section className="content-section">
            <div className="card-grid">
              {allSongs.map((song) => (
                <SongCard key={song.id} song={song} onPlay={() => handleSongClick(song, allSongs)} />
              ))}
            </div>
          </section>
        ) : (
          <section className="content-section">
            <p style={{ textAlign: 'center', color: '#888', padding: '2rem' }}>No songs found in library</p>
          </section>
        )}
      </div>
    );
  }

  // Home Page View
  return (
    <div className="main-content">
      <div className="greeting-section">
        <h1>Hi, {user?.username || 'User'}</h1>
          <p>Welcome! Here's what's playing.</p>
      </div>

      <section className="content-section">
        <div className="section-title">
          <FontAwesomeIcon icon={faClock} />
          <h2>Recently Played</h2>
        </div>
        {recentlyPlayed.length > 0 ? (
          <div className="card-grid">
            {recentlyPlayed.map((song) => (
              <SongCard key={song.id} song={song} onPlay={() => handleSongClick(song, recentlyPlayed)} />
            ))}
          </div>
        ) : (
          <p style={{ textAlign: 'center', color: '#888', padding: '1rem' }}>No recently played songs yet. Start playing to see your history!</p>
        )}
      </section>

      <section className="content-section">
        <div className="section-title">
          <FontAwesomeIcon icon={faMusic} />
          <h2>Browse All Songs</h2>
        </div>
        <div className="browse-grid">
          <BrowseTile
            wide
            title="Music Library"
            subtitle={library.length > 0
              ? `${countLabel(library.length)} · ${GENRES.length} genres`
              : 'Every song in one place'}
            icon={faRecordVinyl}
            hue={340}
            covers={pickCovers(library, 5)}
            onClick={handleBrowseAllSongs}
          />
        </div>
      </section>

      <section className="content-section">
        <div className="section-title">
          <FontAwesomeIcon icon={faCompass} />
          <h2>Browse Genres</h2>
        </div>
        <div className="browse-grid">
          {GENRES.map((genre) => {
            const songs = library.filter(s => s.category?.toLowerCase() === genre.name.toLowerCase());
            return (
              <BrowseTile
                key={genre.name}
                title={genre.label}
                subtitle={library.length > 0 ? countLabel(songs.length) : genre.tagline}
                icon={genre.icon}
                hue={genre.hue}
                covers={pickCovers(songs, 3)}
                onClick={() => handleCategoryClick(genre.name)}
              />
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default MainContent;
