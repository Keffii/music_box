import React from 'react';
import { GRAFANA_URL, GRAFANA_ICON_URL } from '../../utils/constants';
import { VolumeControl } from './VolumeControl';

interface PlayerRightSectionProps {
  volume: number;
  isMuted: boolean;
  volumeSliderRef: React.RefObject<HTMLInputElement | null>;
  onVolumeChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onVolumeChangeEnd: () => void;
  onMute: () => void;
}

export const PlayerRightSection: React.FC<PlayerRightSectionProps> = ({
  volume,
  isMuted,
  volumeSliderRef,
  onVolumeChange,
  onVolumeChangeEnd,
  onMute,
}) => {
  return (
    <div className="player-right">
      <VolumeControl
        volume={volume}
        isMuted={isMuted}
        volumeSliderRef={volumeSliderRef}
        onVolumeChange={onVolumeChange}
        onVolumeChangeEnd={onVolumeChangeEnd}
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
