import React, { useState, useEffect, useRef } from 'react';
import './MainContent.css';
import { loadSongsByCategory, getRecentlyPlayed, searchSongs, getPlaylistSongs, setPlaylistQueue, playSpecificSong, loadSongs, removeSongFromPlaylist } from '../services/playerService';
import { Song } from '../types/music.types';
import { SongCard } from './SongCard';
import { BrowseTile } from './BrowseTile';
import { PageHero } from './PageHero';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faCompass, faMusic, faPen, faRecordVinyl, faListUl } from '@fortawesome/free-solid-svg-icons';
import { faClock } from '@fortawesome/free-regular-svg-icons';
import { useAuth } from '../context/AuthContext';
import { displayName } from '../utils/guest';
import { usePlaylists } from '../context/PlaylistContext';
import { useToast } from '../context/ToastContext';
import { GENRES, findGenre } from '../utils/genres';
import { Route, routeToPath } from '../utils/router';

interface MainContentProps {
  route: Route;
  navigate: (route: Route, options?: { replace?: boolean }) => void;
}

const LIBRARY_HUE = 340;
const PLAYLIST_HUE = 300;

const countLabel = (n: number) => `${n} song${n !== 1 ? 's' : ''}`;

/** The first few songs that have a cover */
const pickCovers = (songs: Song[], max: number) => songs.filter(s => s.coverUrl).slice(0, max);

const MainContent: React.FC<MainContentProps> = ({ route, navigate }) => {
  const { user } = useAuth();
  const { playlists, loading: playlistsLoading, renamePlaylist, refreshPlaylists } = usePlaylists();
  const { showToast } = useToast();
  const mainRef = useRef<HTMLDivElement>(null);

  const [recentlyPlayed, setRecentlyPlayed] = useState<Song[]>([]);
  const [recentLoaded, setRecentLoaded] = useState(false);
  const [library, setLibrary] = useState<Song[]>([]);
  // Songs of the genre, library or playlist page being shown
  const [pageSongs, setPageSongs] = useState<Song[]>([]);
  const [pageLoading, setPageLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState(route.view === 'search' ? route.q || '' : '');
  const [searchResults, setSearchResults] = useState<Song[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');

  // One key per page (the search text is left out, so typing doesn't count as a new page)
  const pageKey = route.view === 'search' ? '/search' : routeToPath(route);

  const loadRecentlyPlayed = async () => {
    const songs = await getRecentlyPlayed();
    setRecentlyPlayed(songs.slice(0, 7)); // Show max 7 songs (one row on wide screens)
    setRecentLoaded(true);
  };

  // Recently played, and the library for the tile counts and covers
  useEffect(() => {
    loadRecentlyPlayed();
    loadSongs().then((songs) => setLibrary(Array.isArray(songs) ? songs : []));
  }, []);

  // A new page: start at the top and load its songs
  useEffect(() => {
    mainRef.current?.scrollTo(0, 0);
    setIsRenaming(false);
    setPageSongs([]);

    let load: (() => Promise<Song[]>) | null = null;
    if (route.view === 'category') load = () => loadSongsByCategory(route.genre);
    else if (route.view === 'all-songs') load = loadSongs;
    else if (route.view === 'playlist') load = () => getPlaylistSongs(route.id);
    if (!load) return;

    let cancelled = false;
    setPageLoading(true);
    load().then((songs) => {
      if (cancelled) return;
      setPageSongs(Array.isArray(songs) ? songs : []);
      setPageLoading(false);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageKey]);

  // Back/Forward onto a search page brings its text back
  useEffect(() => {
    if (route.view === 'search' && (route.q || '') !== searchQuery.trim()) {
      setSearchQuery(route.q || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route]);

  // Search as you type (debounced), and keep the text in the address bar
  useEffect(() => {
    if (route.view !== 'search') return;
    const q = searchQuery.trim();
    const timer = setTimeout(async () => {
      navigate({ view: 'search', q: q || undefined }, { replace: true });
      if (q) {
        setIsSearching(true);
        setSearchResults(await searchSongs(q));
        setIsSearching(false);
      } else {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, route.view, navigate]);

  // Refresh recently played when the song changes or playback starts (live updates from the server)
  useEffect(() => {
    const refresh = () => setTimeout(loadRecentlyPlayed, 500);
    window.addEventListener('songChanged', refresh);
    window.addEventListener('playHistoryChanged', refresh);
    return () => {
      window.removeEventListener('songChanged', refresh);
      window.removeEventListener('playHistoryChanged', refresh);
    };
  }, []);

  const playlist = route.view === 'playlist' ? playlists.find(p => p.id === route.id) : undefined;
  const genre = route.view === 'category' ? findGenre(route.genre) : undefined;

  // The tab title, which is also what the browser's history list shows
  useEffect(() => {
    const titles: Record<string, string | undefined> = {
      search: 'Search',
      'all-songs': 'Library',
      category: route.view === 'category' ? genre?.label || route.genre : undefined,
      playlist: playlist?.name,
    };
    const page = titles[route.view];
    document.title = page ? `${page} · Music Box` : 'Music Box';
  }, [route, genre, playlist]);

  const goHome = () => navigate({ view: 'home' });
  const openGenre = (genre: string) => navigate({ view: 'category', genre });

  const handleSongClick = async (song: Song, songsInContext: Song[]) => {
    const success = await playSpecificSong(song.id, songsInContext.map(s => s.id));
    if (success) {
      // Refresh recently played after a short delay to ensure backend has updated
      setTimeout(loadRecentlyPlayed, 500);
    }
  };

  /** Plays the page's songs from the first one, in order */
  const handlePlayAll = async () => {
    if (pageSongs.length === 0) return;
    if (await setPlaylistQueue(pageSongs.map(s => s.id))) {
      setTimeout(loadRecentlyPlayed, 500);
    }
  };

  const startRename = () => {
    if (!playlist) return;
    setRenameValue(playlist.name);
    setIsRenaming(true);
  };

  const saveRename = async () => {
    const name = renameValue.trim();
    setIsRenaming(false);
    if (!playlist || !name || name === playlist.name) return;
    if (!(await renamePlaylist(playlist.id, name))) {
      showToast('Could not rename the playlist', 'error');
    }
  };

  const handleRemoveFromPlaylist = async (song: Song) => {
    if (!playlist) return;
    if (await removeSongFromPlaylist(playlist.id, song.id)) {
      setPageSongs(songs => songs.filter(s => s.id !== song.id));
      refreshPlaylists(); // song count in the sidebar
      showToast(`Removed ${song.title} from ${playlist.name}`, 'success');
    } else {
      showToast('Could not remove the song', 'error');
    }
  };

  /** The song grid of a genre, library or playlist page */
  const songGrid = (emptyText: string, onRemove?: (song: Song) => void) => {
    if (pageLoading) return null;
    if (pageSongs.length === 0) {
      return <p className="empty-state">{emptyText}</p>;
    }
    return (
      <section className="content-section">
        <div className="card-grid">
          {pageSongs.map((song) => (
            <SongCard
              key={song.id}
              song={song}
              onPlay={() => handleSongClick(song, pageSongs)}
              onRemove={onRemove ? () => onRemove(song) : undefined}
              onOpenGenre={route.view === 'category' ? undefined : openGenre}
            />
          ))}
        </div>
      </section>
    );
  };

  const subtitle = (text?: string) =>
    pageLoading ? 'Loading…' : [text, countLabel(pageSongs.length)].filter(Boolean).join(' · ');

  let content: React.ReactNode;

  if (route.view === 'playlist') {
    if (!playlist && !playlistsLoading) {
      // Deleted, or someone else's
      content = (
        <>
          <PageHero hue={PLAYLIST_HUE} icon={faListUl} eyebrow="Playlist" title="Playlist not found"
            subtitle="It may have been deleted." covers={[]} onBack={goHome} />
        </>
      );
    } else {
      const title = isRenaming ? (
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
          <h1 className="page-hero-title">{playlist?.name || 'Playlist'}</h1>
          <button type="button" className="playlist-rename-button" onClick={startRename} title="Rename playlist" aria-label="Rename playlist">
            <FontAwesomeIcon icon={faPen} />
          </button>
        </div>
      );
      content = (
        <>
          <PageHero hue={PLAYLIST_HUE} icon={faListUl} eyebrow="Playlist" title={title} subtitle={subtitle()}
            covers={pageSongs} onBack={goHome} onPlayAll={pageSongs.length > 0 ? handlePlayAll : undefined} />
          {songGrid('No songs in this playlist yet. Play a song and add it with the playlist button on the player.', handleRemoveFromPlaylist)}
        </>
      );
    }
  } else if (route.view === 'category') {
    content = (
      <>
        <PageHero hue={genre?.hue ?? LIBRARY_HUE} eyebrow="Genre"
          title={genre?.label || route.genre} subtitle={subtitle(genre?.tagline)} covers={pageSongs}
          onBack={goHome} onPlayAll={pageSongs.length > 0 ? handlePlayAll : undefined} />
        {songGrid('No songs found in this genre')}
      </>
    );
  } else if (route.view === 'all-songs') {
    content = (
      <>
        <PageHero hue={LIBRARY_HUE} icon={faRecordVinyl} eyebrow="Library" title="Music Library"
          subtitle={subtitle(`${GENRES.length} genres`)} covers={pageSongs}
          onBack={goHome} onPlayAll={pageSongs.length > 0 ? handlePlayAll : undefined} />
        {songGrid('No songs found in the library')}
      </>
    );
  } else if (route.view === 'search') {
    content = (
      <>
        <button type="button" className="back-button" onClick={goHome}>
          <FontAwesomeIcon icon={faArrowLeft} />
          Home
        </button>
        <div className="greeting-section">
          <h1>Search</h1>
          <p>Find songs by title, artist or genre</p>
        </div>

        <section className="content-section">
          <input
            type="search"
            className="search-input"
            placeholder="Search by title, artist or genre..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search songs"
            autoFocus
          />

          {isSearching ? (
            <p className="empty-state">Searching...</p>
          ) : searchQuery.trim().length === 0 ? (
            <p className="empty-state">Start typing to search for songs</p>
          ) : searchResults.length > 0 ? (
            <div className="card-grid">
              {searchResults.map((song) => (
                <SongCard key={song.id} song={song} onPlay={() => handleSongClick(song, searchResults)} onOpenGenre={openGenre} />
              ))}
            </div>
          ) : (
            <p className="empty-state">No results found for "{searchQuery.trim()}"</p>
          )}
        </section>
      </>
    );
  } else {
    content = (
      <>
        <div className="greeting-section">
          <h1>Hi, {displayName(user?.username)}</h1>
          <p>Welcome! Here's what's playing.</p>
        </div>

        <section className="content-section">
          <div className="section-title">
            <FontAwesomeIcon icon={faClock} />
            <h2>Recently Played</h2>
          </div>
          {/* Always exactly one row of cards, so the sections below don't jump when the first song plays.
              With no history yet, faint placeholder cards hold the space and the message sits on top. */}
          <div className="recent-row">
            <div className="card-grid card-grid--one-row">
              {recentlyPlayed.length > 0
                ? recentlyPlayed.map((song) => (
                    <SongCard key={song.id} song={song} onPlay={() => handleSongClick(song, recentlyPlayed)} onOpenGenre={openGenre} />
                  ))
                : Array.from({ length: 7 }, (_, i) => (
                    <div key={i} className="music-card music-card--placeholder" aria-hidden="true">
                      <div className="card-image" />
                      <div className="card-info">
                        <h3>&nbsp;</h3>
                        <p>&nbsp;</p>
                      </div>
                    </div>
                  ))}
            </div>
            {recentLoaded && recentlyPlayed.length === 0 && (
              <p className="recent-empty-note">No recently played songs yet. Start playing to see your history!</p>
            )}
          </div>
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
              hue={LIBRARY_HUE}
              covers={pickCovers(library, 5)}
              onClick={() => navigate({ view: 'all-songs' })}
            />
          </div>
        </section>

        <section className="content-section">
          <div className="section-title">
            <FontAwesomeIcon icon={faCompass} />
            <h2>Browse Genres</h2>
          </div>
          <div className="browse-grid">
            {GENRES.map((g) => {
              const songs = library.filter(s => s.category?.toLowerCase() === g.name.toLowerCase());
              return (
                <BrowseTile
                  key={g.name}
                  title={g.label}
                  subtitle={library.length > 0 ? countLabel(songs.length) : g.tagline}
                  hue={g.hue}
                  covers={pickCovers(songs, 3)}
                  onClick={() => navigate({ view: 'category', genre: g.name })}
                />
              );
            })}
          </div>
        </section>
      </>
    );
  }

  return (
    <div className="main-content" ref={mainRef}>
      {content}
    </div>
  );
};

export default MainContent;
