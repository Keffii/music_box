import React, { useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faVolumeXmark, faVolumeHigh } from '@fortawesome/free-solid-svg-icons';

/** How long the percentage stays up after the volume changes */
export const VOLUME_TIP_MS = 1200;

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
  const shown = isMuted ? 0 : volume;

  // The percentage shows on hover and keyboard focus (CSS), and for a moment after every change,
  // also one from the remote's knob or a keyboard shortcut. Not on the first render.
  const [recentChange, setRecentChange] = useState(false);
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setRecentChange(true);
    const timer = setTimeout(() => setRecentChange(false), VOLUME_TIP_MS);
    return () => clearTimeout(timer);
  }, [shown]);

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
      <div className="volume-slider-wrap" style={{ '--volume': shown } as React.CSSProperties}>
        <input
          ref={volumeSliderRef}
          className="volume-slider"
          type="range"
          min="0"
          max="100"
          value={volume}
          aria-label="Volume"
          aria-valuetext={`${shown}%`}
          onChange={onVolumeChange}
          onMouseUp={onVolumeChangeEnd}
          onTouchEnd={onVolumeChangeEnd}
        />
        <span className={`volume-tooltip${recentChange ? ' visible' : ''}`} aria-hidden="true">
          {shown}%
        </span>
      </div>
    </div>
  );
};
