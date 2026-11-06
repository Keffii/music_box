import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faVolumeXmark, faVolumeHigh } from '@fortawesome/free-solid-svg-icons';

interface VolumeControlProps {
  volume: number;
  isMuted: boolean;
  volumeSliderRef: React.RefObject<HTMLInputElement | null>;
  onVolumeChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onVolumeChangeEnd: () => void;
  onMute: () => void;
}

export const VolumeControl: React.FC<VolumeControlProps> = ({
  volume,
  isMuted,
  volumeSliderRef,
  onVolumeChange,
  onVolumeChangeEnd,
  onMute,
}) => {
  return (
    <div className="player-volume-container">
      {/* The button keeps the 36px box; fixedWidth keeps both glyphs at the same height */}
      <button
        type="button"
        className="player-volume-icon"
        onClick={onMute}
        title={isMuted || volume === 0 ? 'Unmute' : 'Mute'}
      >
        <FontAwesomeIcon
          icon={isMuted || volume === 0 ? faVolumeXmark : faVolumeHigh}
          size="xl"
          fixedWidth
        />
      </button>
      <input
        ref={volumeSliderRef}
        className="volume-slider"
        type="range"
        min="0"
        max="100"
        value={volume}
        onChange={onVolumeChange}
        onMouseUp={onVolumeChangeEnd}
        onTouchEnd={onVolumeChangeEnd}
      />
    </div>
  );
};
