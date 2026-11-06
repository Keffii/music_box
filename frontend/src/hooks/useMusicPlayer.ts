import { useState, useEffect, useRef, useCallback } from 'react';
import { Song, ServerState } from '../types/music.types';
import { API_BASE, DEFAULT_COVER } from '../utils/constants';
import { loadSongs as fetchSongs } from '../services/playerService';

export const useMusicPlayer = () => {
  const [songs, setSongs] = useState<Song[]>([]);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(50);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [shuffleEnabled, setShuffleEnabled] = useState<boolean>(false);
  const [repeatEnabled, setRepeatEnabled] = useState<boolean>(false);
  const [songTitle, setSongTitle] = useState<string>('Song Name');
  const [songArtist, setSongArtist] = useState<string>('Artist Name');
  const [coverUrl, setCoverUrl] = useState<string>(DEFAULT_COVER);

  const audioRef = useRef<HTMLAudioElement>(null);
  const songsRef = useRef<Song[]>([]);
  const userIsAdjustingVolume = useRef<boolean>(false);
  const volumeUpdateTimeout = useRef<NodeJS.Timeout | null>(null);
  const lastSongIdRef = useRef<number | null>(null);
  const lastCommandSeqRef = useRef<number | null>(null);
  // Latest state from the server. The first one usually arrives before the song list,
  // so loadSongs() applies it again once the songs are known.
  const lastServerStateRef = useRef<ServerState | null>(null);

  // Safe play function
  const safePlay = useCallback(() => {
    audioRef.current?.play().catch((error: Error) => {
      console.warn('Autoplay blocked – waiting for user interaction.', error);
    });
  }, []);

  // Update state from server
  const updateStateFromServer = useCallback((data: ServerState) => {
    lastServerStateRef.current = data;

    setSongTitle(data.title);
    setSongArtist(data.artist);
    setShuffleEnabled(data.shuffle);
    setRepeatEnabled(data.repeat);
    
    // Only update volume from server if user is not actively adjusting it
    if (!userIsAdjustingVolume.current) {
      setVolume(data.volume);
      setIsMuted(data.isMuted);

      // Apply volume changes to audio element
      if (audioRef.current) {
        audioRef.current.volume = data.isMuted ? 0 : data.volume / 100;
      }
    }

    // Use ref to get current songs array
    const song = songsRef.current.find(s => s.id === data.currentSongId);
    if (song) {
      // Check if song actually changed before updating UI
      const songChanged = lastSongIdRef.current !== null && lastSongIdRef.current !== data.currentSongId;
      
      setCurrentSong(song);
      
      // Dispatch event when song changes (but not on initial load)
      if (songChanged) {
        console.log('Song changed from', lastSongIdRef.current, 'to', data.currentSongId);
        // Use setTimeout to ensure the event is dispatched after the state update
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('songChanged', { detail: { songId: data.currentSongId } }));
        }, 0);
      }
      
      // Always update the last song ID
      lastSongIdRef.current = data.currentSongId;
      
      // Update cover URL with fallback
      if (song.coverUrl) {
        const fullCoverUrl = song.coverUrl.startsWith('http') 
          ? song.coverUrl 
          : `${API_BASE}${song.coverUrl}`;
        setCoverUrl(fullCoverUrl);
      } else {
        setCoverUrl(DEFAULT_COVER);
      }

      // Update audio source if different
      if (audioRef.current && song.srcUrl) {
        const currentSrc = audioRef.current.src;
        const newSrc = song.srcUrl.startsWith('http') ? song.srcUrl : `${API_BASE}${song.srcUrl}`;
        
        if (currentSrc !== newSrc) {
          const wasPlaying = !audioRef.current.paused;
          audioRef.current.src = newSrc;
          
          if (data.isPlaying || wasPlaying) {
            audioRef.current.load();
            safePlay();
          }
        }
      }
    }

    // Sync play/pause state
    setIsPlaying(data.isPlaying);
    
    if (data.isPlaying && audioRef.current?.paused) {
      safePlay();
    } else if (!data.isPlaying && !audioRef.current?.paused) {
      audioRef.current?.pause();
    }

    // Handle seek forward from the ESP32 remote, only for a new command
    // (not when the same state is replayed, e.g. after an SSE reconnect)
    const isNewCommand = lastCommandSeqRef.current !== null && data.commandSeq !== lastCommandSeqRef.current;
    lastCommandSeqRef.current = data.commandSeq ?? null;
    if (isNewCommand && data.lastCommand === 'SEEK_FORWARD' && audioRef.current) {
      const target = audioRef.current.currentTime + 10;
      audioRef.current.currentTime = Number.isFinite(audioRef.current.duration)
        ? Math.min(target, audioRef.current.duration)
        : target;
    }
  }, [safePlay]);

  // Load songs, then show the server's current song (or the first one) with its audio
  // loaded, so the player shows the song's length before anyone presses play
  const loadSongs = useCallback(async () => {
    const data = await fetchSongs();
    setSongs(data);
    songsRef.current = data;

    if (lastServerStateRef.current) {
      updateStateFromServer(lastServerStateRef.current);
      return;
    }
    if (data && data.length > 0) {
      const firstSong = data[0];
      setCurrentSong(firstSong);
      setSongTitle(firstSong.title || 'Song Name');
      setSongArtist(firstSong.artist || 'Artist Name');
      setCoverUrl(firstSong.coverUrl
        ? (firstSong.coverUrl.startsWith('http') ? firstSong.coverUrl : `${API_BASE}${firstSong.coverUrl}`)
        : DEFAULT_COVER);
      if (audioRef.current && !audioRef.current.src && firstSong.srcUrl) {
        // preload="metadata": fetches just enough to know the duration
        audioRef.current.src = firstSong.srcUrl.startsWith('http') ? firstSong.srcUrl : `${API_BASE}${firstSong.srcUrl}`;
      }
    }
  }, [updateStateFromServer]);

  // SSE Connection
  const connectSSE = useCallback(() => {
    const eventSource = new EventSource(`${API_BASE}/api/player/stream`);

    eventSource.onmessage = (event: MessageEvent) => {
      const data: ServerState = JSON.parse(event.data);
      updateStateFromServer(data);
    };

    eventSource.onerror = () => {
      console.warn('SSE connection lost – reconnecting...');
      eventSource.close();
      setTimeout(connectSSE, 2000);
    };

    return () => eventSource.close();
  }, [updateStateFromServer]);

  // Update songsRef when songs change
  useEffect(() => {
    songsRef.current = songs;
  }, [songs]);

  // Function to mark when user starts/stops adjusting volume
  const setUserAdjustingVolume = useCallback((isAdjusting: boolean) => {
    userIsAdjustingVolume.current = isAdjusting;
    
    // Clear any existing timeout
    if (volumeUpdateTimeout.current) {
      clearTimeout(volumeUpdateTimeout.current);
    }
    
    // If user stopped adjusting, allow server updates after a short delay
    if (!isAdjusting) {
      volumeUpdateTimeout.current = setTimeout(() => {
        userIsAdjustingVolume.current = false;
      }, 500);
    }
  }, []);

  return {
    // State
    songs,
    currentSong,
    isPlaying,
    isMuted,
    volume,
    currentTime,
    duration,
    shuffleEnabled,
    repeatEnabled,
    songTitle,
    songArtist,
    coverUrl,
    
    // Setters
    setIsPlaying,
    setIsMuted,
    setVolume,
    setCurrentTime,
    setDuration,
    
    // Refs
    audioRef,
    
    // Functions
    loadSongs,
    connectSSE,
    safePlay,
    setUserAdjustingVolume,
  };
};
