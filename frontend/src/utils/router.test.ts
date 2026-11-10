// Imported (not global) because the project has no @types/jest, and the build type-checks test files too
import { describe, it, expect } from '@jest/globals';
import { parseRoute, routeToPath, Route } from './router';

describe('parseRoute', () => {
  it.each([
    ['/', { view: 'home' }],
    ['/library', { view: 'all-songs' }],
    ['/search', { view: 'search', q: undefined }],
    ['/genre/lofi', { view: 'category', genre: 'Lofi' }],
    ['/genre/hip-hop', { view: 'category', genre: 'Hiphop' }],
    ['/genre/Hiphop', { view: 'category', genre: 'Hiphop' }],
    ['/genre/jazz', { view: 'category', genre: 'jazz' }],
    ['/playlist/12', { view: 'playlist', id: 12 }],
    ['/playlist/abc', { view: 'home' }],
    ['/playlist/-3', { view: 'home' }],
    ['/genre', { view: 'home' }],
    ['/no-such-page', { view: 'home' }],
  ])('%s', (path, expected) => {
    expect(parseRoute(path)).toEqual(expected);
  });

  it('reads the search text', () => {
    expect(parseRoute('/search', '?q=lo%20fi')).toEqual({ view: 'search', q: 'lo fi' });
  });
});

describe('routeToPath', () => {
  const cases: [Route, string][] = [
    [{ view: 'home' }, '/'],
    [{ view: 'all-songs' }, '/library'],
    [{ view: 'search' }, '/search'],
    [{ view: 'search', q: 'lo fi' }, '/search?q=lo%20fi'],
    [{ view: 'category', genre: 'Hiphop' }, '/genre/hip-hop'],
    [{ view: 'category', genre: 'Lofi' }, '/genre/lofi'],
    [{ view: 'playlist', id: 7 }, '/playlist/7'],
  ];
  it.each(cases)('%o', (route, expected) => {
    expect(routeToPath(route)).toBe(expected);
  });

  it('round-trips through parseRoute', () => {
    const route: Route = { view: 'category', genre: 'Trance' };
    expect(parseRoute(routeToPath(route))).toEqual(route);
  });
});
