/* eslint-disable unicode-bom */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import './MusicPlayer.css';
import { useMusicPlayer } from '../hooks/useMusicPlayer';
import { useMediaSession } from '../hooks/useMediaSession';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { sendCommand } from '../services/playerService';
import { updateSliderBackground } from '../utils/helpers';
import { useFavorites } from '../context/FavoritesContext';
import { useToast } from '../context/ToastContext';
import { SongInfo } from './player/SongInfo';
import { PlayerControls } from './player/PlayerControls';
import { ProgressBar } from './player/ProgressBar';
import { PlayerRightSection } from './player/PlayerRightSection';
import { ShortcutsDialog } from './ShortcutsDialog';

interface MusicPlayerProps {
  /** Goes to the search page and puts the cursor in the search box (the / shortcut) */
  onOpenSearch: () => void;
}

const MusicPlayer: React.FC<MusicPlayerProps> = ({ onOpenSearch }) => {
  const {
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
    setIsMuted,
    setVolume,
    setCurrentTime,
    setDuration,
    audioRef,
    loadSongs,
    connectSSE,
    setUserAdjustingVolume,
  } = useMusicPlayer();

  const progressSliderRef = useRef<HTMLInputElement | null>(null);
  const volumeSliderRef = useRef<HTMLInputElement | null>(null);

  // Load songs and connect SSE on mount
  useEffect(() => {
    loadSongs();
    // Stop the stream on unmount (e.g. sign out), so it doesn't keep reconnecting
    return connectSSE();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update slider backgrounds when values change
  useEffect(() => {
    if (progressSliderRef.current) {
      updateSliderBackground(progressSliderRef.current, currentTime, 0, duration);
    }
  }, [currentTime, duration]);

  useEffect(() => {
    if (volumeSliderRef.current) {
      updateSliderBackground(volumeSliderRef.current, volume, 0, 100);
    }
  }, [volume]);

  // Event handlers
  const handlePlayPause = async (): Promise<void> => {
    if (isMuted && audioRef.current?.paused) {
      await sendCommand('MUTE');
    }
    
    if (audioRef.current?.paused) {
      await sendCommand('PLAY');
    } else {
      await sendCommand('PAUSE');
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const newVolume = parseInt(e.target.value);
    
    // Mark that user is adjusting volume (prevents SSE from overriding)
    setUserAdjustingVolume(true);
    
    // Update UI and audio element immediately for instant feedback
    setVolume(newVolume);
    setIsMuted(false); // Unmute when manually adjusting volume
    if (audioRef.current) {
      audioRef.current.volume = newVolume / 100;
    }
    // Don't send to backend yet - wait until drag ends
  };

  const handleVolumeChangeEnd = (): void => {
    // Send final volume to backend when user finishes dragging
    sendCommand(`VOLUME:${volume}`);
    
    // Mark that user finished adjusting volume
    setUserAdjustingVolume(false);
  };

  const handleMute = (): void => {
    sendCommand('MUTE');
  };

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const newTime = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
    setCurrentTime(newTime);
  };

  const handleTimeUpdate = (): void => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = (): void => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleEnded = (): void => {
    sendCommand('NEXT');
  };

  // Media keys, headphone buttons, the lock screen and the system media pop-up
  useMediaSession({
    title: songTitle,
    artist: songArtist,
    coverUrl,
    isPlaying,
    audioRef,
    onPlay: () => { if (audioRef.current?.paused) handlePlayPause(); },
    onPause: () => { if (!audioRef.current?.paused) handlePlayPause(); },
    onPrevious: () => sendCommand('PREV'),
    onNext: () => sendCommand('NEXT'),
  });

  // Keyboard shortcuts (press ? for the list)
  const { isFavorite, addFavorite, removeFavorite } = useFavorites();
  const { showToast } = useToast();
  const [showShortcuts, setShowShortcuts] = useState(false);
  const closeShortcuts = useCallback(() => setShowShortcuts(false), []);
  const volumeSendTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Arrow keys and the mouse wheel: change it here at once, tell the server when they stop
  const changeVolumeBy = (delta: number) => {
    const next = Math.max(0, Math.min(100, (isMuted ? 0 : volume) + delta));
    setUserAdjustingVolume(true);
    setVolume(next);
    setIsMuted(next === 0);
    if (audioRef.current) audioRef.current.volume = next / 100;
    if (volumeSendTimer.current) clearTimeout(volumeSendTimer.current);
    volumeSendTimer.current = setTimeout(() => {
      sendCommand(`VOLUME:${next}`);
      setUserAdjustingVolume(false);
    }, 400);
  };

  useKeyboardShortcuts({
    playPause: handlePlayPause,
    next: () => sendCommand('NEXT'),
    previous: () => sendCommand('PREV'),
    seekBy: (seconds) => {
      const audio = audioRef.current;
      if (!audio || !Number.isFinite(audio.duration)) return;
      audio.currentTime = Math.max(0, Math.min(audio.currentTime + seconds, audio.duration));
      setCurrentTime(audio.currentTime);
    },
    volumeBy: changeVolumeBy,
    toggleMute: () => sendCommand('MUTE'),
    toggleShuffle: () => {
      sendCommand('SHUFFLE');
      showToast(shuffleEnabled ? 'Shuffle off' : 'Shuffle on', 'info');
    },
    toggleRepeat: () => {
      sendCommand('REPEAT');
      showToast(repeatEnabled ? 'Repeat off' : 'Repeat on', 'info');
    },
    toggleLike: () => {
      if (!currentSong) return;
      if (isFavorite(currentSong.id)) {
        removeFavorite(currentSong.id);
        showToast(`Removed ${currentSong.title} from Favorites`, 'info');
      } else {
        addFavorite(currentSong);
        showToast(`Added ${currentSong.title} to Favorites`, 'success');
      }
    },
    openSearch: onOpenSearch,
    openHelp: () => setShowShortcuts(true),
  });

  return (
    <div className="music-player">
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
      />

      <SongInfo
        coverUrl={coverUrl}
        songTitle={songTitle}
        songArtist={songArtist}
      />

      <div className="player-center">
        <PlayerControls
          shuffleEnabled={shuffleEnabled}
          isPlaying={isPlaying}
          repeatEnabled={repeatEnabled}
          currentSong={currentSong}
          onPlayPause={handlePlayPause}
        />
        <ProgressBar
          currentTime={currentTime}
          duration={duration}
          progressSliderRef={progressSliderRef}
          onProgressChange={handleProgressChange}
        />
      </div>

      <PlayerRightSection
        volume={volume}
        isMuted={isMuted}
        volumeSliderRef={volumeSliderRef}
        onVolumeChange={handleVolumeChange}
        onVolumeChangeEnd={handleVolumeChangeEnd}
        onVolumeBy={changeVolumeBy}
        onMute={handleMute}
        onShowShortcuts={() => setShowShortcuts(true)}
      />

      {showShortcuts && <ShortcutsDialog onClose={closeShortcuts} />}
    </div>
  );
};

export default MusicPlayer;
