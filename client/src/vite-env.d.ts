/// <reference types="vite/client" />

// Legal Buddy Connect map settings (public values only — see client/.env.example)
interface ImportMetaEnv {
  readonly VITE_MAP_TILE_URL?: string;
  readonly VITE_MAP_ATTRIBUTION?: string;
  readonly VITE_MAP_MAX_ZOOM?: string;
}
