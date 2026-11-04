// Empty means same origin: nginx (Docker) or the dev server proxy forwards /api and /media.
export const API_BASE = process.env.REACT_APP_API_BASE || '';
