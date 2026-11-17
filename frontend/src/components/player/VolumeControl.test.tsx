// Imported (not global) because the project has no @types/jest, and the build type-checks test files too
import { describe, it, expect, jest, afterEach } from '@jest/globals';
import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { VolumeControl, VOLUME_TIP_MS, WHEEL_STEP } from './VolumeControl';

const props = {
  isMuted: false,
  volumeSliderRef: React.createRef<HTMLInputElement>(),
  onVolumeChange: () => {},
  onVolumeChangeEnd: () => {},
  onVolumeBy: (_delta: number) => {},
  onMute: () => {},
};

const wheel = (el: Element, deltaY: number, deltaMode = 0) => {
  const e = new WheelEvent('wheel', { deltaY, deltaMode, bubbles: true, cancelable: true });
  el.dispatchEvent(e);
  return e;
};

describe('VolumeControl', () => {
  afterEach(() => { jest.useRealTimers(); });

  it('steps the volume with the mouse wheel, up is louder, without scrolling the page', () => {
    const steps: number[] = [];
    render(<VolumeControl {...props} volume={50} onVolumeBy={d => steps.push(d)} />);
    const slider = screen.getByRole('slider', { name: 'Volume' });

    const e = wheel(slider, -100); // one notch up
    expect(e.defaultPrevented).toBe(true);
    wheel(slider, 100); // one notch down
    wheel(slider, 3, 1); // Firefox: 3 lines, about one notch
    expect(steps).toEqual([WHEEL_STEP, -WHEEL_STEP, -WHEEL_STEP]);

    // a trackpad sends small amounts that add up to a notch
    steps.length = 0;
    for (let i = 0; i < 4; i++) wheel(slider, -30);
    expect(steps).toEqual([WHEEL_STEP]);
  });

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
