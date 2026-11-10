import { useCallback, useEffect, useState } from 'react';
import { findGenre } from './genres';

/**
 * The page being shown, kept in the address bar so the browser's Back and Forward buttons work
 * and every page has a link of its own. nginx and the dev server serve index.html for any path, so these URLs load directly.
 */
export type Route =
  | { view: 'home' }
  | { view: 'search'; q?: string }
  | { view: 'all-songs' }
  | { view: 'category'; genre: string }
  | { view: 'playlist'; id: number };

export type View = Route['view'];

export const parseRoute = (pathname: string, search = ''): Route => {
  const parts = pathname.split('/').filter(Boolean).map(decodeURIComponent);
  switch (parts[0]) {
    case 'search':
      return { view: 'search', q: new URLSearchParams(search).get('q') || undefined };
    case 'library':
      return { view: 'all-songs' };
    case 'genre':
      if (parts[1]) return { view: 'category', genre: findGenre(parts[1])?.name || parts[1] };
      break;
    case 'playlist': {
      const id = Number(parts[1]);
      if (Number.isInteger(id) && id > 0) return { view: 'playlist', id };
      break;
    }
  }
  return { view: 'home' };
};

export const routeToPath = (route: Route): string => {
  switch (route.view) {
    case 'search':
      return route.q ? `/search?q=${encodeURIComponent(route.q)}` : '/search';
    case 'all-songs':
      return '/library';
    case 'category':
      return `/genre/${encodeURIComponent(findGenre(route.genre)?.slug || route.genre.toLowerCase())}`;
    case 'playlist':
      return `/playlist/${route.id}`;
    default:
      return '/';
  }
};

const currentRoute = () => parseRoute(window.location.pathname, window.location.search);

/**
 * The current route, and a function to go to another one.
 * `replace` swaps the current history entry instead of adding one (used while typing a search).
 */
export const useRoute = (): [Route, (route: Route, options?: { replace?: boolean }) => void] => {
  const [route, setRoute] = useState<Route>(currentRoute);

  useEffect(() => {
    const onPop = () => setRoute(currentRoute());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = useCallback((next: Route, options?: { replace?: boolean }) => {
    const path = routeToPath(next);
    if (path !== window.location.pathname + window.location.search) {
      if (options?.replace) window.history.replaceState(null, '', path);
      else window.history.pushState(null, '', path);
    }
    setRoute(next);
  }, []);

  return [route, navigate];
};
