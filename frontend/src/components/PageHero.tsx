import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IconDefinition, faArrowLeft, faPlay } from '@fortawesome/free-solid-svg-icons';
import { Song } from '../types/music.types';
import { coverOf } from '../utils/helpers';

interface PageHeroProps {
  /** Accent hue (0-360), the same one the page's tile uses on the home page */
  hue: number;
  /** Optional badge on the artwork */
  icon?: IconDefinition;
  /** Small label above the title, e.g. "Genre" */
  eyebrow: string;
  /** A string becomes the <h1>; pass an element for something else (e.g. the playlist rename field) */
  title: React.ReactNode;
  subtitle: string;
  /** Songs whose covers make up the artwork */
  covers: Song[];
  onBack: () => void;
  onPlayAll?: () => void;
}

/** The header of a genre, library or playlist page: artwork, title and a Play all button, lit in the page's colour. */
export const PageHero: React.FC<PageHeroProps> = ({ hue, icon, eyebrow, title, subtitle, covers, onBack, onPlayAll }) => {
  const withCovers = covers.filter(s => s.coverUrl);
  const mosaic = withCovers.length >= 4 ? withCovers.slice(0, 4) : withCovers.slice(0, 1);

  return (
    <>
      <button type="button" className="back-button" onClick={onBack}>
        <FontAwesomeIcon icon={faArrowLeft} />
        Home
      </button>

      <header className="page-hero" style={{ '--tile-hue': hue } as React.CSSProperties}>
        <div className={`page-hero-art${mosaic.length === 4 ? ' page-hero-art--mosaic' : ''}`} aria-hidden="true">
          {mosaic.map(song => (
            <img key={song.id} src={coverOf(song)} alt="" />
          ))}
          {icon && (
            <span className={`page-hero-badge${mosaic.length === 0 ? ' page-hero-badge--large' : ''}`}>
              <FontAwesomeIcon icon={icon} />
            </span>
          )}
        </div>

        <div className="page-hero-text">
          <span className="page-hero-eyebrow">{eyebrow}</span>
          {typeof title === 'string' ? <h1 className="page-hero-title">{title}</h1> : title}
          <p className="page-hero-subtitle">{subtitle}</p>
          {onPlayAll && (
            <button type="button" className="play-all-button" onClick={onPlayAll}>
              <FontAwesomeIcon icon={faPlay} />
              Play all
            </button>
          )}
        </div>
      </header>
    </>
  );
};
