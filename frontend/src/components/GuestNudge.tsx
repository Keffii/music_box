import React, { useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark, faMobileScreen } from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../context/AuthContext';
import { usePlaylists } from '../context/PlaylistContext';
import { useFavorites } from '../context/FavoritesContext';
import './Popovers.css';

const SEEN_KEY = 'musicbox-guest-nudge-seen';

const alreadySeen = () => {
  try { return localStorage.getItem(SEEN_KEY) === '1'; } catch { return false; }
};
const markSeen = () => {
  try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* ignore */ }
};

/**
 * One gentle prompt for guests: the first time they create a playlist or like a song, explain what an
 * account adds. Shown once per browser; "Not now", × or "Create account" all dismiss it for good.
 */
export const GuestNudge: React.FC<{ onCreateAccount: () => void }> = ({ onCreateAccount }) => {
  const { isGuest } = useAuth();
  const { playlists, loading: playlistsLoading } = usePlaylists();
  const { favorites, isLoading: favoritesLoading } = useFavorites();
  const [visible, setVisible] = useState(false);
  // Counts once loaded, so only something the guest does now triggers it (not what was already there)
  const baseline = useRef<{ playlists: number; favorites: number } | null>(null);

  useEffect(() => {
    if (!isGuest || alreadySeen() || playlistsLoading || favoritesLoading) return;
    if (!baseline.current) {
      baseline.current = { playlists: playlists.length, favorites: favorites.length };
      return;
    }
    if (playlists.length > baseline.current.playlists || favorites.length > baseline.current.favorites) {
      markSeen();
      // A moment later, so the confirmation of what they just did shows first
      const timer = setTimeout(() => setVisible(true), 900);
      return () => clearTimeout(timer);
    }
  }, [isGuest, playlists.length, favorites.length, playlistsLoading, favoritesLoading]);

  if (!visible || !isGuest) return null;

  return (
    <aside className="guest-nudge" role="dialog" aria-labelledby="guest-nudge-title">
      <button type="button" className="guest-nudge-close" onClick={() => setVisible(false)} aria-label="Close">
        <FontAwesomeIcon icon={faXmark} />
      </button>
      <span className="guest-nudge-icon" aria-hidden="true">
        <FontAwesomeIcon icon={faMobileScreen} />
      </span>
      <div className="guest-nudge-body">
        <h2 id="guest-nudge-title">Keep your music on every device</h2>
        <p>Create a free account and your playlists and favourites come with you, on your phone too.</p>
        <div className="guest-nudge-actions">
          <button type="button" className="guest-nudge-primary" onClick={() => { setVisible(false); onCreateAccount(); }}>
            Create account
          </button>
          <button type="button" className="guest-nudge-secondary" onClick={() => setVisible(false)}>
            Not now
          </button>
        </div>
      </div>
    </aside>
  );
};
