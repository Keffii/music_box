import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faKeyboard } from '@fortawesome/free-regular-svg-icons';
import { VolumeControl } from './VolumeControl';

interface PlayerRightSectionProps {
  volume: number;
  isMuted: boolean;
  volumeSliderRef: React.RefObject<HTMLInputElement | null>;
  onVolumeChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onVolumeChangeEnd: () => void;
  onMute: () => void;
  onShowShortcuts: () => void;
}

export const PlayerRightSection: React.FC<PlayerRightSectionProps> = ({
  volume,
  isMuted,
  volumeSliderRef,
  onVolumeChange,
  onVolumeChangeEnd,
  onMute,
  onShowShortcuts,
}) => {
  return (
    <div className="player-right">
      <button
        type="button"
        className="player-shortcuts-button"
        onClick={onShowShortcuts}
        title="Keyboard shortcuts (?)"
        aria-label="Keyboard shortcuts"
      >
        <FontAwesomeIcon icon={faKeyboard} />
      </button>
      <VolumeControl
        volume={volume}
        isMuted={isMuted}
        volumeSliderRef={volumeSliderRef}
        onVolumeChange={onVolumeChange}
        onVolumeChangeEnd={onVolumeChangeEnd}
        onMute={onMute}
      />
    </div>
  );
};
