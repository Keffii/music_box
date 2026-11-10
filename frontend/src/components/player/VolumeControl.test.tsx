// Imported (not global) because the project has no @types/jest, and the build type-checks test files too
import { describe, it, expect, jest, afterEach } from '@jest/globals';
import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { VolumeControl, VOLUME_TIP_MS } from './VolumeControl';

const props = {
  isMuted: false,
  volumeSliderRef: React.createRef<HTMLInputElement>(),
  onVolumeChange: () => {},
  onVolumeChangeEnd: () => {},
  onMute: () => {},
};

describe('VolumeControl', () => {
  afterEach(() => { jest.useRealTimers(); });

  it('shows the percentage above the slider, for a moment after each change', () => {
    jest.useFakeTimers();
    const { rerender } = render(<VolumeControl {...props} volume={40} />);
    const tip = screen.getByText('40%');
    expect(tip.className).not.toContain('visible'); // not on the first render

    rerender(<VolumeControl {...props} volume={65} />); // e.g. the remote's knob
    expect(screen.getByText('65%').className).toContain('visible');

    act(() => { jest.advanceTimersByTime(VOLUME_TIP_MS + 50); });
    expect(screen.getByText('65%').className).not.toContain('visible');
  });

  it('reads 0% while muted and tells screen readers the value', () => {
    render(<VolumeControl {...props} volume={0} isMuted />);
    expect(screen.getByText('0%')).toBeTruthy();
    expect(screen.getByRole('slider', { name: 'Volume' }).getAttribute('aria-valuetext')).toBe('0%');
  });
});
