import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronRight, IconDefinition } from '@fortawesome/free-solid-svg-icons';
import { Song } from '../types/music.types';
import { coverOf } from '../utils/helpers';

interface BrowseTileProps {
  title: string;
  /** e.g. "4 songs" */
  subtitle: string;
  /** Optional icon in the top-left corner */
  icon?: IconDefinition;
  /** Accent hue (0-360) for the glow, icon and border */
  hue: number;
  /** A few songs whose covers fan out on the right */
  covers: Song[];
  wide?: boolean;
  onClick: () => void;
}

/** A genre (or the whole library) on the home page: a dark card lit in its own colour, with a fan of its covers. */
export const BrowseTile: React.FC<BrowseTileProps> = ({ title, subtitle, icon, hue, covers, wide, onClick }) => (
  <button
    type="button"
    className={`browse-tile${wide ? ' browse-tile--wide' : ''}`}
    style={{ '--tile-hue': hue } as React.CSSProperties}
    onClick={onClick}
    aria-label={`${title}, ${subtitle}`}
  >
    {icon && (
      <span className="browse-tile-icon">
        <FontAwesomeIcon icon={icon} />
      </span>
    )}

    <span className="browse-tile-text">
      <span className="browse-tile-title">{title}</span>
      <span className="browse-tile-subtitle">
        {subtitle}
        <FontAwesomeIcon icon={faChevronRight} className="browse-tile-chevron" />
      </span>
    </span>

    {covers.length > 0 && (
      <span className="browse-tile-covers" aria-hidden="true">
        {covers.map((song, i) => (
          <img
            key={song.id}
            src={coverOf(song)}
            alt=""
            className="browse-tile-cover"
            style={{ '--i': i, '--n': covers.length } as React.CSSProperties}
            loading="lazy"
          />
        ))}
      </span>
    )}
  </button>
);
