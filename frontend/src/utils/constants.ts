export const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8080';

// Shown as a stats link in the player when set (Amplify env var REACT_APP_GRAFANA_URL); hidden otherwise
export const GRAFANA_URL = process.env.REACT_APP_GRAFANA_URL || '';

export const GRAFANA_ICON_URL = 'https://grafana-assets.grafana.net/grafana/12.4.0-19938312174/public/build/static/img/grafana_icon.1e0deb6b.svg';

// Used for songs that have no cover image in S3
export const DEFAULT_COVER = `${process.env.PUBLIC_URL}/default-cover.svg`;
