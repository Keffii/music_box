import React from 'react';
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
    </div>
  );
};
