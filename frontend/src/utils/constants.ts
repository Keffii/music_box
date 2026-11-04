// Empty means same origin: nginx (Docker) or the dev server proxy forwards /api and /media.
export const API_BASE = process.env.REACT_APP_API_BASE || '';

export const GRAFANA_URL = 'https://keffii.grafana.net/d/ad6pm99/music-box-db?orgId=1&from=now-6h&to=now&timezone=browser';

export const GRAFANA_ICON_URL = 'https://grafana-assets.grafana.net/grafana/12.4.0-19938312174/public/build/static/img/grafana_icon.1e0deb6b.svg';
