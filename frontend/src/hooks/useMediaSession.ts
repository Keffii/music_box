import { useEffect, useRef, RefObject } from 'react';

interface MediaSessionOptions {
  title: string;
  artist: string;
  coverUrl: string;
  isPlaying: boolean;
  audioRef: RefObject<HTMLAudioElement | null>;
  onPlay: () => void;
  onPause: () => void;
  onPrevious: () => void;
  onNext: () => void;
}

/**
 * Connects the player to the operating system: the keyboard's media keys, headphone buttons,
 * the phone lock screen and the system media pop-up (with the song's cover) all control Music Box.
 * Play, pause, previous and next go through the same server commands as the on-screen buttons,
 * so the user's other devices stay in sync.
 */
export const useMediaSession = (options: MediaSessionOptions) => {
  // Always call the latest handlers without re-registering them on every render
  const latest = useRef(options);
  latest.current = options;

  const supported = typeof navigator !== 'undefined' && 'mediaSession' in navigator;

  // Action handlers, registered once
  useEffect(() => {
    if (!supported) return;
    const session = navigator.mediaSession;

    const seekTo = (time: number) => {
      const audio = latest.current.audioRef.current;
      if (!audio) return;
      const end = Number.isFinite(audio.duration) ? audio.duration : time;
      audio.currentTime = Math.max(0, Math.min(time, end));
    };
    const seekBy = (seconds: number) => {
      const audio = latest.current.audioRef.current;
      if (audio) seekTo(audio.currentTime + seconds);
    };

    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ['play', () => latest.current.onPlay()],
      ['pause', () => latest.current.onPause()],
      ['stop', () => latest.current.onPause()],
      ['previoustrack', () => latest.current.onPrevious()],
      ['nexttrack', () => latest.current.onNext()],
      ['seekbackward', (d) => seekBy(-(d.seekOffset || 10))],
      ['seekforward', (d) => seekBy(d.seekOffset || 10)],
      ['seekto', (d) => { if (d.seekTime != null) seekTo(d.seekTime); }],
    ];
    for (const [action, handler] of handlers) {
      try { session.setActionHandler(action, handler); } catch { /* action not supported by this browser */ }
    }
    return () => {
      for (const [action] of handlers) {
        try { session.setActionHandler(action, null); } catch { /* ignore */ }
      }
    };
  }, [supported]);

  // Song title, artist and cover for the lock screen and media pop-up
  const { title, artist, coverUrl, isPlaying, audioRef } = options;
  useEffect(() => {
    if (!supported || !('MediaMetadata' in window)) return;
    const artwork = coverUrl
      ? [{ src: new URL(coverUrl, window.location.href).href, sizes: '512x512' }]
      : [];
    navigator.mediaSession.metadata = new MediaMetadata({ title, artist, album: 'Music Box', artwork });
  }, [supported, title, artist, coverUrl]);

  useEffect(() => {
    if (supported) navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
  }, [supported, isPlaying]);

  // The progress bar on the lock screen. The browser moves it on by itself while playing,
  // so it only needs updating when the song, the position or the play state changes.
  useEffect(() => {
    const audio = audioRef.current;
    if (!supported || !audio || !navigator.mediaSession.setPositionState) return;
    const update = () => {
      if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
      try {
        navigator.mediaSession.setPositionState({
          duration: audio.duration,
          position: Math.min(audio.currentTime, audio.duration),
          playbackRate: audio.playbackRate || 1,
        });
      } catch { /* ignore an out-of-range position while a new song loads */ }
    };
    const events = ['loadedmetadata', 'seeked', 'play', 'pause', 'ratechange'];
    events.forEach(e => audio.addEventListener(e, update));
    return () => events.forEach(e => audio.removeEventListener(e, update));
  }, [supported, audioRef]);
};
