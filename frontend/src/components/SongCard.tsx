import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlay, faXmark } from '@fortawesome/free-solid-svg-icons';
import { Song } from '../types/music.types';
import { DEFAULT_COVER } from '../utils/constants';

interface SongCardProps {
  song: Song;
  onPlay: () => void;
  /** Shows a remove (×) button on the cover, e.g. on a playlist page */
  onRemove?: () => void;
}

/** A song tile: the whole card plays the song, by mouse or keyboard (Enter / Space). */
export const SongCard: React.FC<SongCardProps> = ({ song, onPlay, onRemove }) => {
  const card = (
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
        <img src={song.coverUrl || DEFAULT_COVER} alt="" className="card-cover" />
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
  );

  if (!onRemove) return card;

  // The remove button sits next to the card (not inside it), so it isn't a button within a button
  return (
    <div className="song-card-wrap">
      {card}
      <button
        type="button"
        className="card-remove-button"
        onClick={onRemove}
        title="Remove from playlist"
        aria-label={`Remove ${song.title} from playlist`}
      >
        <FontAwesomeIcon icon={faXmark} />
      </button>
    </div>
  );
};
