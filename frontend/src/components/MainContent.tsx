import React, { useState, useEffect } from 'react';
import './MainContent.css';
import { loadSongsByCategory, getRecentlyPlayed, searchSongs, getPlaylistSongs, setPlaylistQueue, playSpecificSong, loadSongs } from '../services/playerService';
import { Song } from '../types/music.types';
import { DEFAULT_COVER } from '../utils/constants';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faCompass, faPlay, faMusic } from '@fortawesome/free-solid-svg-icons';
import { faClock } from '@fortawesome/free-regular-svg-icons';
import { useAuth } from '../context/AuthContext';

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
  const [viewMode, setViewMode] = useState<'home' | 'category' | 'search' | 'playlist' | 'all-songs'>(propViewMode);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [categorySongs, setCategorySongs] = useState<Song[]>([]);
  const [recentlyPlayed, setRecentlyPlayed] = useState<Song[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<Song[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [playlistSongs, setPlaylistSongs] = useState<Song[]>([]);
  const [allSongs, setAllSongs] = useState<Song[]>([]);
  const [hoveredCardId, setHoveredCardId] = useState<number | null>(null);

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
    if (viewMode === 'playlist' && selectedPlaylistId) {
      const loadPlaylist = async () => {
        const songs = await getPlaylistSongs(selectedPlaylistId);
        setPlaylistSongs(songs);
      };
      loadPlaylist();
    }
  }, [viewMode, selectedPlaylistId]);

  // Load recently played on mount
  useEffect(() => {
    loadRecentlyPlayed();
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
            <h1>{selectedPlaylistName || 'Playlist'}</h1>
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
                <div 
                  key={song.id} 
                  className="music-card"
                  onMouseEnter={() => setHoveredCardId(song.id)}
                  onMouseLeave={() => setHoveredCardId(null)}
                  style={{ position: 'relative', cursor: 'pointer' }}
                >
                  <div className="card-image" onClick={() => handleSongClick(song, playlistSongs)}>
                    <img src={song.coverUrl || DEFAULT_COVER} alt={song.title} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }} />
                    {hoveredCardId === song.id && (
                      <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'rgba(0, 0, 0, 0.6)',
                        borderRadius: '8px'
                      }}>
                        <div style={{
                          width: '50px',
                          height: '50px',
                          borderRadius: '50%',
                          background: 'hotpink',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 4px 12px rgba(255, 105, 180, 0.5)',
                          transform: 'translateY(-50%)'
                        }}>
                          <FontAwesomeIcon icon={faPlay} style={{ fontSize: '20px', marginLeft: '3px' }} />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="card-info">
                    <h3>{song.title}</h3>
                    <p>{song.artist}</p>
                  </div>
                </div>
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
                <div 
                  key={song.id} 
                  className="music-card"
                  onMouseEnter={() => setHoveredCardId(song.id)}
                  onMouseLeave={() => setHoveredCardId(null)}
                  style={{ position: 'relative', cursor: 'pointer' }}
                >
                  <div className="card-image" onClick={() => handleSongClick(song, searchResults)}>
                    <img src={song.coverUrl || DEFAULT_COVER} alt={song.title} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }} />
                    {hoveredCardId === song.id && (
                      <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'rgba(0, 0, 0, 0.6)',
                        borderRadius: '8px'
                      }}>
                        <div style={{
                          width: '50px',
                          height: '50px',
                          borderRadius: '50%',
                          background: 'hotpink',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 4px 12px rgba(255, 105, 180, 0.5)',
                          transform: 'translateY(-50%)'
                        }}>
                          <FontAwesomeIcon icon={faPlay} style={{ fontSize: '20px', marginLeft: '3px' }} />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="card-info">
                    <h3>{song.title}</h3>
                    <p>{song.artist}</p>
                  </div>
                </div>
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
                <div 
                  key={song.id} 
                  className="music-card"
                  onMouseEnter={() => setHoveredCardId(song.id)}
                  onMouseLeave={() => setHoveredCardId(null)}
                  style={{ position: 'relative', cursor: 'pointer' }}
                >
                  <div className="card-image" onClick={() => handleSongClick(song, categorySongs)}>
                    <img src={song.coverUrl || DEFAULT_COVER} alt={song.title} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }} />
                    {hoveredCardId === song.id && (
                      <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'rgba(0, 0, 0, 0.6)',
                        borderRadius: '8px'
                      }}>
                        <div style={{
                          width: '50px',
                          height: '50px',
                          borderRadius: '50%',
                          background: 'hotpink',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 4px 12px rgba(255, 105, 180, 0.5)',
                          transform: 'translateY(-50%)'
                        }}>
                          <FontAwesomeIcon icon={faPlay} style={{ fontSize: '20px', marginLeft: '3px' }} />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="card-info">
                    <h3>{song.title}</h3>
                    <p>{song.artist}</p>
                  </div>
                </div>
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
                <div 
                  key={song.id} 
                  className="music-card"
                  onMouseEnter={() => setHoveredCardId(song.id)}
                  onMouseLeave={() => setHoveredCardId(null)}
                  style={{ position: 'relative', cursor: 'pointer' }}
                >
                  <div className="card-image" onClick={() => handleSongClick(song, allSongs)}>
                    <img src={song.coverUrl || DEFAULT_COVER} alt={song.title} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }} />
                    {hoveredCardId === song.id && (
                      <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'rgba(0, 0, 0, 0.6)',
                        borderRadius: '8px'
                      }}>
                        <div style={{
                          width: '50px',
                          height: '50px',
                          borderRadius: '50%',
                          background: 'hotpink',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 4px 12px rgba(255, 105, 180, 0.5)',
                          transform: 'translateY(-50%)'
                        }}>
                          <FontAwesomeIcon icon={faPlay} style={{ fontSize: '20px', marginLeft: '3px' }} />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="card-info">
                    <h3>{song.title}</h3>
                    <p>{song.artist}</p>
                  </div>
                </div>
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
              <div 
                key={song.id} 
                className="music-card"
                onMouseEnter={() => setHoveredCardId(song.id)}
                onMouseLeave={() => setHoveredCardId(null)}
                style={{ position: 'relative', cursor: 'pointer' }}
              >
                <div className="card-image" onClick={() => handleSongClick(song, recentlyPlayed)}>
                  <img src={song.coverUrl || DEFAULT_COVER} alt={song.title} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }} />
                  {hoveredCardId === song.id && (
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'rgba(0, 0, 0, 0.6)',
                      borderRadius: '8px'
                    }}>
                      <div style={{
                        width: '50px',
                        height: '50px',
                        borderRadius: '50%',
                        background: 'hotpink',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 4px 12px rgba(255, 105, 180, 0.5)',
                        transform: 'translateY(-50%)'
                      }}>
                        <FontAwesomeIcon icon={faPlay} style={{ fontSize: '20px', marginLeft: '3px' }} />
                      </div>
                    </div>
                  )}
                </div>
                <div className="card-info">
                  <h3>{song.title}</h3>
                  <p>{song.artist}</p>
                </div>
              </div>
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
          <div 
            className="browse-category" 
            style={{ 
              background: 'linear-gradient(135deg, #2c3e50, #34495e)', 
              cursor: 'pointer',
              gridColumn: '1 / -1'
            }}
            onClick={handleBrowseAllSongs}
          >
            <h3>Music Library</h3>
          </div>
        </div>
      </section>

      <section className="content-section">
        <div className="section-title">
          <FontAwesomeIcon icon={faCompass} />
          <h2>Browse Genres</h2>
        </div>
        <div className="browse-grid">
          <div 
            className="browse-category" 
            style={{ background: 'linear-gradient(135deg, #16a085, #1abc9c)', cursor: 'pointer' }}
            onClick={() => handleCategoryClick('Electronic')}
          >
            <h3>Electronic</h3>
          </div>
          <div 
            className="browse-category" 
            style={{ background: 'linear-gradient(135deg, #8e44ad, #9b59b6)', cursor: 'pointer' }}
            onClick={() => handleCategoryClick('Hiphop')}
          >
            <h3>Hiphop</h3>
          </div>
          <div 
            className="browse-category" 
            style={{ background: 'linear-gradient(135deg, #d35400, #e67e22)', cursor: 'pointer' }}
            onClick={() => handleCategoryClick('Lofi')}
          >
            <h3>Lofi</h3>
          </div>
          <div 
            className="browse-category" 
            style={{ background: 'linear-gradient(135deg, #c0392b, #e74c3c)', cursor: 'pointer' }}
            onClick={() => handleCategoryClick('Trance')}
          >
            <h3>Trance</h3>
          </div>
        </div>
      </section>
    </div>
  );
};

export default MainContent;
