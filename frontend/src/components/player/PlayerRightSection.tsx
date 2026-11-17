import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faKeyboard } from '@fortawesome/free-regular-svg-icons';
import { GRAFANA_URL, GRAFANA_ICON_URL } from '../../utils/constants';
import { VolumeControl } from './VolumeControl';

interface PlayerRightSectionProps {
  volume: number;
  isMuted: boolean;
  volumeSliderRef: React.RefObject<HTMLInputElement | null>;
  onVolumeChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onVolumeChangeEnd: () => void;
  /** Steps the volume up or down (the mouse wheel) */
  onVolumeBy: (delta: number) => void;
  onMute: () => void;
  onShowShortcuts: () => void;
}

export const PlayerRightSection: React.FC<PlayerRightSectionProps> = ({
  volume,
  isMuted,
  volumeSliderRef,
  onVolumeChange,
  onVolumeChangeEnd,
  onVolumeBy,
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
        onVolumeBy={onVolumeBy}
        onMute={onMute}
      />
      {GRAFANA_URL && (
        <a
          href={GRAFANA_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="grafana-link"
          title="View Statistics"
        >
          <img
            src={GRAFANA_ICON_URL}
            alt="Grafana"
            className="grafana-icon"
          />
        </a>
      )}
    </div>
  );
};
