import { useEffect, useState } from 'react';

export type Route =
  | { name: 'home' }
  | { name: 'new' }
  | { name: 'plan'; id: string }
  | { name: 'impact' }
  | { name: 'assumptions' }
  | { name: 'responsible-ai' }
  | { name: 'bills'; id: string }
  | { name: 'not-found' };

export function parseRoute(hash: string): Route {
  const clean = hash.replace(/^#\/?/, '').split('?')[0];
  const parts = clean.split('/').filter(Boolean);
  if (parts.length === 0) return { name: 'home' };
  if (parts[0] === 'new') return { name: 'new' };
  if (parts[0] === 'plan' && parts[1]) return { name: 'plan', id: parts[1] };
  if (parts[0] === 'impact') return { name: 'impact' };
  if (parts[0] === 'assumptions') return { name: 'assumptions' };
  if (parts[0] === 'responsible-ai') return { name: 'responsible-ai' };
  if (parts[0] === 'bills' && parts[1]) return { name: 'bills', id: parts[1] };
  return { name: 'not-found' };
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));

  useEffect(() => {
    const onChange = () => {
      setRoute(parseRoute(window.location.hash));
      window.scrollTo({ top: 0, behavior: 'auto' });
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  return route;
}

export function navigate(path: string): void {
  if (window.location.hash === `#${path}`) return;
  window.location.hash = path;
}

export function href(path: string): string {
  return `#${path}`;
}
