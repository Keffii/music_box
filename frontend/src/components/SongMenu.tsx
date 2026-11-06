import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlay, faHeart as faHeartSolid, faPlus, faCompactDisc, faTrashCan, faMusic } from '@fortawesome/free-solid-svg-icons';
import { faHeart as faHeartRegular } from '@fortawesome/free-regular-svg-icons';
import { Song } from '../types/music.types';
import { useFavorites } from '../context/FavoritesContext';
import { usePlaylists } from '../context/PlaylistContext';
import { useToast } from '../context/ToastContext';
import { addSongToPlaylist, createPlaylist, getPlaylists } from '../services/playerService';
import { findGenre } from '../utils/genres';
import './Popovers.css';

/** Where the menu opens: next to a button, or at the mouse for a right-click */
export interface MenuAnchor {
  left: number;
  top: number;
  right: number;
  bottom: number;
  /** 'end' lines the menu's right edge up with the anchor's (for a ⋯ button) */
  align: 'start' | 'end';
  /** The button that opened it: gets focus back on close, and toggles the menu on a second click */
  opener?: HTMLElement | null;
}

interface SongMenuProps {
  song: Song;
  anchor: MenuAnchor;
  onClose: () => void;
  onPlay: () => void;
  /** Shown on a playlist page */
  onRemoveFromPlaylist?: () => void;
  /** Shown when the song has a genre and isn't already on that genre's page */
  onOpenGenre?: (genre: string) => void;
}

const GAP = 4;
const EDGE = 8;

/** The ⋯ / right-click menu of a song: play, like, add to any playlist (or a new one), go to its genre. */
export const SongMenu: React.FC<SongMenuProps> = ({ song, anchor, onClose, onPlay, onRemoveFromPlaylist, onOpenGenre }) => {
  const { isFavorite, addFavorite, removeFavorite } = useFavorites();
  const { playlists, refreshPlaylists } = usePlaylists();
  const { showToast } = useToast();
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const [newName, setNewName] = useState<string | null>(null); // null = not creating a playlist
  const [busy, setBusy] = useState(false);

  const liked = isFavorite(song.id);
  const genre = song.category ? findGenre(song.category) : undefined;

  // Place it below the anchor, or above when there's no room, and keep it on screen
  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const { width, height } = menu.getBoundingClientRect();
    let left = anchor.align === 'end' ? anchor.right - width : anchor.left;
    left = Math.max(EDGE, Math.min(left, window.innerWidth - width - EDGE));
    let top = anchor.bottom + GAP;
    if (top + height > window.innerHeight - EDGE) top = anchor.top - height - GAP;
    top = Math.max(EDGE, Math.min(top, window.innerHeight - height - EDGE));
    setPosition({ left, top });
  }, [anchor, playlists.length, newName !== null]); // eslint-disable-line react-hooks/exhaustive-deps

  // Focus the first item; give focus back to the opener (or whatever had it) when it closes
  const returnFocusTo = useRef<HTMLElement | null>(anchor.opener || (document.activeElement as HTMLElement | null));
  useEffect(() => {
    const back = returnFocusTo.current;
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    return () => {
      if (back && document.contains(back)) back.focus({ preventScroll: true });
    };
  }, []);

  // Close on a click outside, scrolling or resizing. A click on the ⋯ button that opened
  // the menu is left to that button, which closes it (otherwise it would close and reopen).
  useEffect(() => {
    const opener = anchor.opener;
    const onPointer = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (e.type === 'mousedown' && opener?.contains(target)) return;
      onClose();
    };
    const onScroll = (e: Event) => {
      if (!menuRef.current?.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', onPointer, true);
    document.addEventListener('contextmenu', onPointer, true);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onClose);
    return () => {
      document.removeEventListener('mousedown', onPointer, true);
      document.removeEventListener('contextmenu', onPointer, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onClose);
    };
  }, [onClose, anchor.opener]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (newName !== null) setNewName(null); else onClose();
      return;
    }
    if (e.key === 'Tab') {
      onClose();
      return;
    }
    if ((e.target as HTMLElement).tagName === 'INPUT') return;
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') || []);
    const index = items.indexOf(document.activeElement as HTMLElement);
    const go = (i: number) => items[(i + items.length) % items.length]?.focus();
    if (e.key === 'ArrowDown') { e.preventDefault(); go(index + 1); }
    if (e.key === 'ArrowUp') { e.preventDefault(); go(index - 1); }
    if (e.key === 'Home') { e.preventDefault(); go(0); }
    if (e.key === 'End') { e.preventDefault(); go(items.length - 1); }
  };

  const run = (action: () => void) => () => {
    onClose();
    action();
  };

  const toggleLike = () => {
    if (liked) {
      removeFavorite(song.id);
      showToast(`Removed ${song.title} from Favorites`, 'info');
    } else {
      addFavorite(song);
      showToast(`Added ${song.title} to Favorites`, 'success');
    }
  };

  const addTo = async (playlistId: number, fallbackName: string) => {
    const result = await addSongToPlaylist(playlistId, song.id);
    const name = result.playlistName || fallbackName;
    if (!result.success) {
      showToast('Could not add the song to the playlist', 'error');
    } else if (result.alreadyExists) {
      showToast(`${song.title} is already in ${name}`, 'info');
    } else {
      showToast(`Added ${song.title} to ${name}`, 'success');
      refreshPlaylists(); // song count in the sidebar
    }
  };

  /** Creates the playlist, then adds the song to it */
  const createAndAdd = async () => {
    const name = (newName || '').trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      if (!(await createPlaylist(name))) {
        showToast('Could not create the playlist', 'error');
        return;
      }
      // The API doesn't return the new ID, so take the newest playlist with this name
      const all: { id: number; name: string }[] = await getPlaylists();
      const created = all.filter(p => p.name === name).sort((a, b) => b.id - a.id)[0];
      onClose();
      if (created) await addTo(created.id, name);
      else refreshPlaylists();
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div
      ref={menuRef}
      className="song-menu"
      role="menu"
      aria-label={`${song.title} options`}
      style={position ? { left: position.left, top: position.top } : { left: -9999, top: -9999 }}
      onKeyDown={onKeyDown}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="song-menu-heading" aria-hidden="true">
        <span className="song-menu-title">{song.title}</span>
        <span className="song-menu-artist">{song.artist}</span>
      </div>

      <button type="button" role="menuitem" className="song-menu-item" onClick={run(onPlay)}>
        <FontAwesomeIcon icon={faPlay} fixedWidth /> Play
      </button>
      <button type="button" role="menuitem" className="song-menu-item" onClick={run(toggleLike)}>
        <FontAwesomeIcon icon={liked ? faHeartSolid : faHeartRegular} fixedWidth className={liked ? 'liked' : ''} />
        {liked ? 'Remove from Favorites' : 'Add to Favorites'}
      </button>

      <div className="song-menu-separator" role="separator" />
      <div className="song-menu-label" aria-hidden="true">Add to playlist</div>
      <div className="song-menu-playlists">
        {playlists.map(p => (
          <button key={p.id} type="button" role="menuitem" className="song-menu-item" onClick={run(() => addTo(p.id, p.name))}>
            <FontAwesomeIcon icon={faMusic} fixedWidth /> <span className="song-menu-item-text">{p.name}</span>
          </button>
        ))}
      </div>
      {newName === null ? (
        <button type="button" role="menuitem" className="song-menu-item" onClick={() => setNewName('')}>
          <FontAwesomeIcon icon={faPlus} fixedWidth /> New playlist
        </button>
      ) : (
        <form
          className="song-menu-new"
          onSubmit={(e) => { e.preventDefault(); createAndAdd(); }}
        >
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Playlist name"
            aria-label="New playlist name"
            maxLength={100}
            disabled={busy}
          />
          <button type="submit" disabled={busy || !newName.trim()}>Create</button>
        </form>
      )}

      {(onOpenGenre && song.category) || onRemoveFromPlaylist ? <div className="song-menu-separator" role="separator" /> : null}
      {onOpenGenre && song.category && (
        <button type="button" role="menuitem" className="song-menu-item" onClick={run(() => onOpenGenre(song.category!))}>
          <FontAwesomeIcon icon={faCompactDisc} fixedWidth /> Go to {genre?.label || song.category}
        </button>
      )}
      {onRemoveFromPlaylist && (
        <button type="button" role="menuitem" className="song-menu-item danger" onClick={run(onRemoveFromPlaylist)}>
          <FontAwesomeIcon icon={faTrashCan} fixedWidth /> Remove from this playlist
        </button>
      )}
    </div>,
    document.body
  );
};
