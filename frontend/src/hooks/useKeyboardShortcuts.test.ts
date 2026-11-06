// Imported (not global) because the project has no @types/jest, and the build type-checks test files too
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { renderHook } from '@testing-library/react';
import { useKeyboardShortcuts, ShortcutActions } from './useKeyboardShortcuts';

const makeActions = () => ({
  playPause: jest.fn(),
  next: jest.fn(),
  previous: jest.fn(),
  seekBy: jest.fn(),
  volumeBy: jest.fn(),
  toggleMute: jest.fn(),
  toggleShuffle: jest.fn(),
  toggleRepeat: jest.fn(),
  toggleLike: jest.fn(),
  openSearch: jest.fn(),
  openHelp: jest.fn(),
});

const press = (target: Element | Window, key: string, init: KeyboardEventInit = {}) => {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
};

describe('useKeyboardShortcuts', () => {
  let actions: ReturnType<typeof makeActions>;

  beforeEach(() => {
    actions = makeActions();
    renderHook(() => useKeyboardShortcuts(actions as unknown as ShortcutActions));
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('maps keys to actions', () => {
    press(document.body, ' ');
    press(document.body, 'ArrowRight', { shiftKey: true });
    press(document.body, 'ArrowLeft', { shiftKey: true });
    press(document.body, 'ArrowRight');
    press(document.body, 'ArrowLeft');
    press(document.body, 'ArrowUp');
    press(document.body, 'ArrowDown');
    press(document.body, 'm');
    press(document.body, 'S');
    press(document.body, 'r');
    press(document.body, 'l');
    press(document.body, '/');
    press(document.body, '?', { shiftKey: true });

    expect(actions.playPause).toHaveBeenCalledTimes(1);
    expect(actions.next).toHaveBeenCalledTimes(1);
    expect(actions.previous).toHaveBeenCalledTimes(1);
    expect(actions.seekBy.mock.calls).toEqual([[10], [-10]]);
    expect(actions.volumeBy.mock.calls).toEqual([[10], [-10]]);
    expect(actions.toggleMute).toHaveBeenCalledTimes(1);
    expect(actions.toggleShuffle).toHaveBeenCalledTimes(1);
    expect(actions.toggleRepeat).toHaveBeenCalledTimes(1);
    expect(actions.toggleLike).toHaveBeenCalledTimes(1);
    expect(actions.openSearch).toHaveBeenCalledTimes(1);
    expect(actions.openHelp).toHaveBeenCalledTimes(1);
  });

  it('stops Space from scrolling the page', () => {
    expect(press(document.body, ' ').defaultPrevented).toBe(true);
  });

  it('does nothing while typing in a text field', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    press(input, ' ');
    press(input, 'm');
    press(input, '/');
    expect(actions.playPause).not.toHaveBeenCalled();
    expect(actions.toggleMute).not.toHaveBeenCalled();
    expect(actions.openSearch).not.toHaveBeenCalled();
  });

  it('leaves browser shortcuts alone', () => {
    press(document.body, 'r', { ctrlKey: true });
    press(document.body, 'l', { metaKey: true });
    expect(actions.toggleRepeat).not.toHaveBeenCalled();
    expect(actions.toggleLike).not.toHaveBeenCalled();
  });

  it('lets Space press a focused button, except the player buttons', () => {
    const button = document.createElement('button');
    document.body.appendChild(button);
    press(button, ' ');
    expect(actions.playPause).not.toHaveBeenCalled();

    const player = document.createElement('div');
    player.className = 'music-player';
    const shuffle = document.createElement('button');
    player.appendChild(shuffle);
    document.body.appendChild(player);
    press(shuffle, ' ');
    expect(actions.playPause).toHaveBeenCalledTimes(1);
  });

  it('ignores keys inside an open menu', () => {
    const menu = document.createElement('div');
    menu.setAttribute('role', 'menu');
    const item = document.createElement('button');
    menu.appendChild(item);
    document.body.appendChild(menu);
    press(item, 'ArrowDown');
    press(item, 's');
    expect(actions.volumeBy).not.toHaveBeenCalled();
    expect(actions.toggleShuffle).not.toHaveBeenCalled();
  });

  it('leaves the arrow keys to a focused slider', () => {
    const slider = document.createElement('input');
    slider.type = 'range';
    document.body.appendChild(slider);
    press(slider, 'ArrowUp');
    press(slider, 'ArrowRight');
    expect(actions.volumeBy).not.toHaveBeenCalled();
    expect(actions.seekBy).not.toHaveBeenCalled();
  });
});
