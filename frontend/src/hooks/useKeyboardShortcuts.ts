import { useEffect, useRef } from 'react';

export interface ShortcutActions {
  playPause: () => void;
  next: () => void;
  previous: () => void;
  seekBy: (seconds: number) => void;
  volumeBy: (delta: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  toggleLike: () => void;
  openSearch: () => void;
  openHelp: () => void;
}

/** The list shown in the shortcuts panel (press ?) */
export const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ['Space'], label: 'Play or pause' },
  { keys: ['Shift', '→'], label: 'Next song' },
  { keys: ['Shift', '←'], label: 'Previous song' },
  { keys: ['→'], label: 'Forward 10 seconds' },
  { keys: ['←'], label: 'Back 10 seconds' },
  { keys: ['↑'], label: 'Volume up' },
  { keys: ['↓'], label: 'Volume down' },
  { keys: ['M'], label: 'Mute or unmute' },
  { keys: ['S'], label: 'Shuffle on or off' },
  { keys: ['R'], label: 'Repeat on or off' },
  { keys: ['L'], label: 'Like or unlike the playing song' },
  { keys: ['/'], label: 'Search' },
  { keys: ['?'], label: 'Show these shortcuts' },
];

/** Typing in a text field must never trigger a shortcut */
const isTextField = (el: HTMLElement) =>
  el.isContentEditable ||
  el.tagName === 'TEXTAREA' ||
  el.tagName === 'SELECT' ||
  (el.tagName === 'INPUT' && !['range', 'checkbox', 'radio', 'button'].includes((el as HTMLInputElement).type));

/** Keyboard shortcuts for the player, active anywhere on the page except while typing. */
export const useKeyboardShortcuts = (actions: ShortcutActions) => {
  const latest = useRef(actions);
  latest.current = actions;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Leave browser and system shortcuts alone, and anything a menu or card already handled
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement;
      if (isTextField(target)) return;
      // An open menu or dialog has its own keys
      if (target.closest('[role="menu"], [role="dialog"]')) return;

      const a = latest.current;
      const onSlider = target.tagName === 'INPUT'; // a range slider uses the arrow keys itself
      // Space and Enter keep working on focused buttons and links, except the player's own buttons
      const onControl = !!target.closest('button, a, [role="button"], [role="menuitem"]')
        && !target.closest('.music-player');

      let handled = true;
      switch (e.key) {
        case ' ':
          if (onControl) return;
          a.playPause();
          break;
        case 'ArrowRight':
          if (onSlider) return;
          if (e.shiftKey) a.next(); else a.seekBy(10);
          break;
        case 'ArrowLeft':
          if (onSlider) return;
          if (e.shiftKey) a.previous(); else a.seekBy(-10);
          break;
        case 'ArrowUp':
          if (onSlider) return;
          a.volumeBy(10);
          break;
        case 'ArrowDown':
          if (onSlider) return;
          a.volumeBy(-10);
          break;
        case 'm': case 'M': a.toggleMute(); break;
        case 's': case 'S': a.toggleShuffle(); break;
        case 'r': case 'R': a.toggleRepeat(); break;
        case 'l': case 'L': a.toggleLike(); break;
        case '/': a.openSearch(); break;
        case '?': a.openHelp(); break;
        default: handled = false;
      }
      if (handled) e.preventDefault();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
};
