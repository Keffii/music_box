import { IconDefinition, faBolt, faMicrophoneLines, faMugHot, faWaveSquare } from '@fortawesome/free-solid-svg-icons';

export interface Genre {
  /** The category stored on each song */
  name: string;
  /** What the user sees */
  label: string;
  /** In the URL: /genre/<slug> */
  slug: string;
  icon: IconDefinition;
  /** Accent hue (0-360) for the tile and the genre page */
  hue: number;
  tagline: string;
}

export const GENRES: Genre[] = [
  { name: 'Electronic', label: 'Electronic', slug: 'electronic', icon: faBolt, hue: 265, tagline: 'Synths and pulses' },
  { name: 'Hiphop', label: 'Hip-Hop', slug: 'hip-hop', icon: faMicrophoneLines, hue: 320, tagline: 'Beats and bars' },
  { name: 'Lofi', label: 'Lofi', slug: 'lofi', icon: faMugHot, hue: 20, tagline: 'Slow and cosy' },
  { name: 'Trance', label: 'Trance', slug: 'trance', icon: faWaveSquare, hue: 195, tagline: 'Long builds' },
];

/** Finds a genre by its URL slug or stored name, ignoring case */
export const findGenre = (key: string): Genre | undefined => {
  const k = key.toLowerCase();
  return GENRES.find(g => g.slug === k || g.name.toLowerCase() === k);
};
