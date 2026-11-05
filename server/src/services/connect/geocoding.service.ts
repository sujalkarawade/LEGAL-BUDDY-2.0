import {
  GEOCODER_ENABLED, GEOCODER_URL, GEOCODER_USER_AGENT, GEOCODER_COUNTRY_CODES,
  GEOCODER_MIN_INTERVAL_MS, GEOCODER_TIMEOUT_MS,
} from '../../config/index.js';

export interface GeocodeResult {
  label: string;
  latitude: number;
  longitude: number;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  locality: string | null;
}

export class GeocodingUnavailableError extends Error {}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX = 500;
const cache = new Map<string, { at: number; results: GeocodeResult[] }>();
let queue: Promise<unknown> = Promise.resolve();
let lastRequestAt = 0;

/**
 * Server-side geocoding proxy for Nominatim-compatible APIs.
 * Policy compliance for the public OSM instance (operations.osmfoundation.org/policies/nominatim):
 *  - one request at a time with GEOCODER_MIN_INTERVAL_MS (default 1.1 s) between upstream calls for the WHOLE app,
 *  - identifying User-Agent (GEOCODER_USER_AGENT is required; requests are refused without it),
 *  - results cached for 24 h; identical queries never repeat upstream,
 *  - called only when a user submits a search (no autocomplete), and switchable off with GEOCODER_ENABLED=false.
 */
export const GeocodingService = {
  isConfigured(): boolean {
    return GEOCODER_ENABLED && GEOCODER_USER_AGENT.trim().length > 0;
  },

  async search(rawQuery: string): Promise<GeocodeResult[]> {
    if (!GeocodingService.isConfigured()) {
      throw new GeocodingUnavailableError('Location search is not configured on this server. Use your current location or pick a point on the map.');
    }
    const query = rawQuery.trim().replace(/\s+/g, ' ').slice(0, 200);
    const key = query.toLowerCase();
    const cached = cache.get(key);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.results;

    const run = async () => {
      const wait = lastRequestAt + GEOCODER_MIN_INTERVAL_MS - Date.now();
      if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
      lastRequestAt = Date.now();
      const url = new URL(`${GEOCODER_URL}/search`);
      url.searchParams.set('q', query);
      url.searchParams.set('format', 'jsonv2');
      url.searchParams.set('addressdetails', '1');
      url.searchParams.set('limit', '5');
      if (GEOCODER_COUNTRY_CODES) url.searchParams.set('countrycodes', GEOCODER_COUNTRY_CODES);
      const response = await fetch(url, {
        headers: { 'User-Agent': GEOCODER_USER_AGENT, Accept: 'application/json', 'Accept-Language': 'en' },
        signal: AbortSignal.timeout(GEOCODER_TIMEOUT_MS),
      });
      if (!response.ok) throw new GeocodingUnavailableError('The location service is temporarily unavailable. Try again shortly or pick a point on the map.');
      const body = await response.json() as unknown;
      return parseNominatim(body);
    };

    const pending = queue.then(run, run);
    queue = pending.catch(() => undefined);
    let results: GeocodeResult[];
    try {
      results = await pending;
    } catch (error) {
      if (error instanceof GeocodingUnavailableError) throw error;
      throw new GeocodingUnavailableError('The location service did not respond. Try again shortly or pick a point on the map.');
    }

    if (cache.size >= CACHE_MAX) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    cache.set(key, { at: Date.now(), results });
    return results;
  },
};

export function parseNominatim(body: unknown): GeocodeResult[] {
  if (!Array.isArray(body)) return [];
  return body.flatMap((item: any) => {
    const latitude = Number(item?.lat);
    const longitude = Number(item?.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];
    const a = item?.address || {};
    const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 120) : null);
    return [{
      label: String(item?.display_name || '').slice(0, 300),
      latitude,
      longitude,
      city: str(a.city) || str(a.town) || str(a.village) || str(a.county) || str(a.state_district),
      state: str(a.state),
      postalCode: str(a.postcode),
      locality: str(a.suburb) || str(a.neighbourhood) || str(a.quarter),
    }];
  });
}
