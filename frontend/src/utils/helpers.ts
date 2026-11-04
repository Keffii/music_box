import { API_BASE } from './constants';

export const formatTime = (seconds: number): string => {
  if (isNaN(seconds)) return '0:00';
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${min}:${sec}`;
};

export const updateSliderBackground = (
  slider: HTMLInputElement,
  value: number,
  min: number,
  max: number
): void => {
  if (!slider) return;
  const percentage = ((value - min) / (max - min)) * 100;
  slider.style.background = `linear-gradient(to right, hotpink 0%, hotpink ${percentage}%, white ${percentage}%, white 100%)`;
};

export const DEFAULT_COVER = '/default-cover.svg';

/** Absolute URL for a media path from the API ("/media/..."), resolved like the browser would. */
export const mediaUrl = (path: string): string => {
  const base = API_BASE || window.location.origin;
  return new URL(path, base.endsWith('/') ? base : `${base}/`).href;
};

export const coverOf = (song: { coverUrl?: string | null } | null | undefined): string =>
  song?.coverUrl ? mediaUrl(song.coverUrl) : DEFAULT_COVER;
