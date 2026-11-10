import React, { useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faVolumeXmark, faVolumeHigh } from '@fortawesome/free-solid-svg-icons';

/** How long the percentage stays up after the volume changes */
export const VOLUME_TIP_MS = 1200;
/** Volume change per mouse-wheel notch, in percent */
export const WHEEL_STEP = 5;
/** Scroll distance of one notch (Chrome and Edge report 100 px per notch; a trackpad adds up to it) */
const NOTCH_PX = 100;

interface VolumeControlProps {
  volume: number;
  isMuted: boolean;
  volumeSliderRef: React.RefObject<HTMLInputElement | null>;
  onVolumeChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onVolumeChangeEnd: () => void;
  /** Steps the volume up or down (the mouse wheel) */
  onVolumeBy: (delta: number) => void;
  onMute: () => void;
}

export const VolumeControl: React.FC<VolumeControlProps> = ({
  volume,
  isMuted,
  volumeSliderRef,
  onVolumeChange,
  onVolumeChangeEnd,
  onVolumeBy,
  onMute,
}) => {
  const shown = isMuted ? 0 : volume;

  // Mouse wheel over the volume control: up is louder. A native listener, because React's wheel
  // handler is passive and couldn't stop the page from scrolling at the same time.
  const containerRef = useRef<HTMLDivElement>(null);
  const onVolumeByRef = useRef(onVolumeBy);
  onVolumeByRef.current = onVolumeBy;
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let scrolled = 0;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      // lines (Firefox: 3 per notch) and pages to pixels
      const px = e.deltaY * (e.deltaMode === 1 ? NOTCH_PX / 3 : e.deltaMode === 2 ? 8 * NOTCH_PX : 1);
      if (Math.sign(px) !== Math.sign(scrolled)) scrolled = 0; // changed direction
      scrolled += px;
      const notches = Math.trunc(scrolled / NOTCH_PX);
      if (notches === 0) return;
      scrolled -= notches * NOTCH_PX;
      onVolumeByRef.current(-notches * WHEEL_STEP);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

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
    <div className="player-volume-container" ref={containerRef}>
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
