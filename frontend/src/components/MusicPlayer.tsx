/* eslint-disable unicode-bom */
import React, { useEffect, useRef } from 'react';
import './MusicPlayer.css';
import { useMusicPlayer } from '../hooks/useMusicPlayer';
import { sendCommand } from '../services/playerService';
import { updateSliderBackground } from '../utils/helpers';
import { SongInfo } from './player/SongInfo';
import { PlayerControls } from './player/PlayerControls';
import { ProgressBar } from './player/ProgressBar';
import { PlayerRightSection } from './player/PlayerRightSection';

const MusicPlayer: React.FC = () => {
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
    connectSSE();
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
        onMute={handleMute}
      />
    </div>
  );
};

export default MusicPlayer;
