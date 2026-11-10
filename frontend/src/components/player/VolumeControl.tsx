import React, { useEffect, useRef, useState } from 'react';
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

/** How long the percentage bubble stays up after the last change */
const BUBBLE_MS = 1000;
/** Width of the slider thumb in px, so the bubble sits right over it */
const THUMB_PX = 12;

export const VolumeControl: React.FC<VolumeControlProps> = ({
  volume,
  isMuted,
  volumeSliderRef,
  onVolumeChange,
  onVolumeChangeEnd,
  onMute,
}) => {
  const [bubbleVisible, setBubbleVisible] = useState(false);
  const [dragging, setDragging] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstRender = useRef(true);

  // Show the bubble whenever the volume changes: the slider, the keyboard, or another device
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setBubbleVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setBubbleVisible(false), BUBBLE_MS);
  }, [volume, isMuted]);

  useEffect(() => () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);

  const muted = isMuted || volume === 0;
  const endDrag = () => {
    setDragging(false);
    onVolumeChangeEnd();
  };

  return (
    <div className="player-volume-container">
      {/* The button keeps the 36px box; fixedWidth keeps both glyphs at the same height */}
      <button
        type="button"
        className="player-volume-icon"
        onClick={onMute}
        title={muted ? 'Unmute' : 'Mute'}
      >
        <FontAwesomeIcon
          icon={muted ? faVolumeXmark : faVolumeHigh}
          size="xl"
          fixedWidth
        />
      </button>
      <div className="volume-slider-wrap">
        <input
          ref={volumeSliderRef}
          className="volume-slider"
          type="range"
          min="0"
          max="100"
          value={volume}
          aria-label="Volume"
          aria-valuetext={isMuted ? 'Muted' : `${volume}%`}
          onChange={onVolumeChange}
          onPointerDown={() => setDragging(true)}
          onMouseUp={endDrag}
          onTouchEnd={endDrag}
          onPointerCancel={() => setDragging(false)}
        />
        <span
          className={`volume-bubble${bubbleVisible || dragging ? ' is-visible' : ''}`}
          style={{
            left: `calc(${volume}% + ${THUMB_PX / 2 - (volume / 100) * THUMB_PX}px)`,
          }}
          aria-hidden="true"
        >
          {isMuted ? 'Muted' : `${volume}%`}
        </span>
      </div>
    </div>
  );
};
