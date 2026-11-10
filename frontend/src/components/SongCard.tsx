import React, { useCallback, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlay, faXmark, faEllipsis, faHeart as faHeartSolid } from '@fortawesome/free-solid-svg-icons';
import { faHeart as faHeartRegular } from '@fortawesome/free-regular-svg-icons';
import { Song } from '../types/music.types';
import { coverOf } from '../utils/helpers';
import { useFavorites } from '../context/FavoritesContext';
import { useToast } from '../context/ToastContext';
import { SongMenu, MenuAnchor } from './SongMenu';

interface SongCardProps {
  song: Song;
  onPlay: () => void;
  /** Shows a remove (×) button on the cover and in the menu, e.g. on a playlist page */
  onRemove?: () => void;
  /** Adds "Go to <genre>" to the menu */
  onOpenGenre?: (genre: string) => void;
}

/**
 * A song tile. The card plays the song (mouse, or Enter / Space). Next to it: a heart to like it
 * and a ⋯ menu (also on right-click) to add it to a playlist and more. These buttons sit beside
 * the card, not inside it, so there is no button within a button.
 */
export const SongCard: React.FC<SongCardProps> = ({ song, onPlay, onRemove, onOpenGenre }) => {
  const { isFavorite, addFavorite, removeFavorite } = useFavorites();
  const { showToast } = useToast();
  const [menu, setMenu] = useState<MenuAnchor | null>(null);
  const closeMenu = useCallback(() => setMenu(null), []);
  const liked = isFavorite(song.id);

  const toggleLike = () => {
    if (liked) {
      removeFavorite(song.id);
      showToast(`Removed ${song.title} from Favorites`, 'info');
    } else {
      addFavorite(song);
      showToast(`Added ${song.title} to Favorites`, 'success');
    }
  };

  const openMenuAtButton = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (menu) { setMenu(null); return; }
    const r = e.currentTarget.getBoundingClientRect();
    setMenu({ left: r.left, top: r.top, right: r.right, bottom: r.bottom, align: 'end', opener: e.currentTarget });
  };

  const openMenuAtPointer = (e: React.MouseEvent) => {
    e.preventDefault();
    setMenu({ left: e.clientX, top: e.clientY, right: e.clientX, bottom: e.clientY, align: 'start' });
  };

  return (
    <div className={`song-card-wrap${menu ? ' menu-open' : ''}`} onContextMenu={openMenuAtPointer}>
      <div
        className="music-card"
        role="button"
        tabIndex={0}
        aria-label={`Play ${song.title} by ${song.artist}`}
        onClick={onPlay}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onPlay();
          }
        }}
      >
        <div className="card-image">
          <img src={coverOf(song)} alt="" className="card-cover" />
          <div className="hover-overlay card-play-overlay">
            <div className="card-play-button">
              <FontAwesomeIcon icon={faPlay} />
            </div>
          </div>
        </div>
        <div className="card-info">
          <h3>{song.title}</h3>
          <p>{song.artist}</p>
        </div>
      </div>

      <div className="card-actions">
        <button
          type="button"
          className={`card-action card-like${liked ? ' liked' : ''}`}
          onClick={toggleLike}
          aria-pressed={liked}
          aria-label={liked ? `Remove ${song.title} from Favorites` : `Add ${song.title} to Favorites`}
          title={liked ? 'Remove from Favorites' : 'Add to Favorites'}
        >
          <FontAwesomeIcon icon={liked ? faHeartSolid : faHeartRegular} />
        </button>
        <button
          type="button"
          className="card-action card-more"
          onClick={openMenuAtButton}
          aria-haspopup="menu"
          aria-expanded={!!menu}
          aria-label={`More options for ${song.title}`}
          title="More options"
        >
          <FontAwesomeIcon icon={faEllipsis} />
        </button>
      </div>

      {onRemove && (
        <button
          type="button"
          className="card-remove-button"
          onClick={onRemove}
          title="Remove from playlist"
          aria-label={`Remove ${song.title} from playlist`}
        >
          <FontAwesomeIcon icon={faXmark} />
        </button>
      )}

      {menu && (
        <SongMenu
          song={song}
          anchor={menu}
          onClose={closeMenu}
          onPlay={onPlay}
          onRemoveFromPlaylist={onRemove}
          onOpenGenre={onOpenGenre}
        />
      )}
    </div>
  );
};
