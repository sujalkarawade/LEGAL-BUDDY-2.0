/**
 * Map provider configuration (client/.env). The defaults use the public OpenStreetMap tile
 * server, which is acceptable for development and demos ONLY: it has no SLA, requires the
 * visible "© OpenStreetMap contributors" attribution, and forbids heavy/bulk use
 * (https://operations.osmfoundation.org/policies/tiles/). For production set
 * VITE_MAP_TILE_URL / VITE_MAP_ATTRIBUTION to a commercial or self-hosted provider.
 * Never put a secret key here: everything prefixed VITE_ is shipped to the browser.
 */
const env = import.meta.env;

export const MAP_TILE_URL: string = env.VITE_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const MAP_ATTRIBUTION: string = env.VITE_MAP_ATTRIBUTION
  || '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors';
export const MAP_MAX_ZOOM = Number(env.VITE_MAP_MAX_ZOOM || 19);

/** Initial view before the user chooses a location: the whole of India. This is a viewport, not a lawyer location. */
export const DEFAULT_VIEW = { lat: 22.5, lng: 79.0, zoom: 5 };
