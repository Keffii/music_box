import { useState, useEffect, useRef, useCallback } from 'react';
import { Song, ServerState } from '../types/music.types';
import { API_BASE } from '../utils/constants';
import { coverOf, DEFAULT_COVER, mediaUrl } from '../utils/helpers';
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
  // Highest command sequence number already applied. SSE replays the full state on
  // every reconnect, so one-shot commands such as SEEK_FORWARD are keyed on seq.
  const lastSeqRef = useRef<number | null>(null);

  // Load songs
  const loadSongs = useCallback(async () => {
    const data = await fetchSongs();
    setSongs(data);
    songsRef.current = data;
    console.log('Songs loaded:', data);
    
    // Set the first song immediately on load
    if (data && data.length > 0) {
      const firstSong = data[0];
      setCurrentSong(firstSong);
      setSongTitle(firstSong.title || 'Song Name');
      setSongArtist(firstSong.artist || 'Artist Name');
      
      setCoverUrl(coverOf(firstSong));
    }
  }, []);

  // Safe play function
  const safePlay = useCallback(() => {
    audioRef.current?.play().catch((error: Error) => {
      console.warn('Autoplay blocked – waiting for user interaction.', error);
    });
  }, []);

  // Update state from server
  const updateStateFromServer = useCallback((data: ServerState) => {
    console.log('Server state update:', data);
    
    const isNewCommand = lastSeqRef.current !== null && data.seq !== lastSeqRef.current;
    lastSeqRef.current = data.seq;

    setSongTitle(data.title ?? 'No songs yet');
    setSongArtist(data.artist ?? 'Add tracks to the music folder');
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
      
      setCoverUrl(coverOf(song));

      // Update audio source if different
      if (audioRef.current && song.srcUrl) {
        // Compare absolute URLs: audio.src is always absolute, so a relative path would never match
        const currentSrc = audioRef.current.src;
        const newSrc = mediaUrl(song.srcUrl);
        
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

    // Seek forward (from the remote) only for a new command, never for a replayed state
    if (isNewCommand && data.lastCommand === 'SEEK_FORWARD' && audioRef.current) {
      const audio = audioRef.current;
      if (Number.isFinite(audio.duration)) {
        audio.currentTime = Math.min(audio.currentTime + 10, audio.duration);
      }
    }
  }, [safePlay]);

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
