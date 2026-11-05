import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LocateFixed, Search, MapPin, SlidersHorizontal, List, Map as MapIcon, X, Info, MousePointerClick } from 'lucide-react';
import { ConnectApi } from '../../services/connectApi.js';
import { LawyerMap } from '../../components/connect/LawyerMap.js';
import { LawyerResultCard, InlineError, LegalDisclaimer } from '../../components/connect/ConnectUi.js';
import type { PublicLawyer, SearchFilters, SearchLocation, Specialization, GeocodeResult } from '../../types/connect.js';

const RADII = [5, 10, 25, 50, 100];
const DEFAULT_FILTERS: SearchFilters = {
  radiusKm: 25, specialization: '', experience: '', mode: '', language: '', verification: 'VERIFIED_ONLY', availability: '', sort: 'NEAREST',
};

type GeoState = 'idle' | 'explain' | 'locating';

function geolocationMessage(error: GeolocationPositionError | null): string {
  if (!error) return 'Your browser does not support location access. Search by city, locality or PIN code instead.';
  switch (error.code) {
    case error.PERMISSION_DENIED: return 'Location permission was denied. You can search by city, locality or PIN code, or pick a point on the map.';
    case error.POSITION_UNAVAILABLE: return 'Your location could not be determined. Search by city, locality or PIN code instead.';
    case error.TIMEOUT: return 'Finding your location took too long. Try again or search by city, locality or PIN code.';
    default: return 'Location is unavailable. Search by city, locality or PIN code instead.';
  }
}

export const FindLawyerPage: React.FC = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [filters, setFilters] = useState<SearchFilters>({ ...DEFAULT_FILTERS, specialization: params.get('specialization') || '', availability: params.get('specialization') ? 'ACCEPTING' : '' });
  const [location, setLocation] = useState<SearchLocation | null>(null);
  const [specializations, setSpecializations] = useState<Specialization[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [geocodingEnabled, setGeocodingEnabled] = useState(true);

  const [query, setQuery] = useState('');
  const [geoResults, setGeoResults] = useState<GeocodeResult[] | null>(null);
  const [geoState, setGeoState] = useState<GeoState>('idle');
  const [pickMode, setPickMode] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [searchingPlace, setSearchingPlace] = useState(false);

  const [lawyers, setLawyers] = useState<PublicLawyer[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<'list' | 'map'>('list');
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    ConnectApi.getSpecializations().then(r => { setSpecializations(r.specializations); setLanguages(r.languages); }).catch(() => undefined);
    ConnectApi.geoStatus().then(r => setGeocodingEnabled(r.geocodingEnabled)).catch(() => setGeocodingEnabled(false));
  }, []);

  // Search whenever the location, a filter or the page changes.
  useEffect(() => {
    if (!location) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    ConnectApi.searchNearby(location.lat, location.lng, filters, page)
      .then(r => {
        if (cancelled) return;
        setLawyers(r.lawyers);
        setTotal(r.pagination.total);
        setTotalPages(r.pagination.totalPages);
        if (selectedId && !r.lawyers.some(l => l.id === selectedId)) setSelectedId(null);
      })
      .catch(e => { if (!cancelled) { setError(e.message); setLawyers([]); setTotal(0); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [location?.lat, location?.lng, filters, page]);

  const updateFilter = <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => {
    setFilters(f => ({ ...f, [key]: value }));
    setPage(1);
  };

  const chooseLocation = (loc: SearchLocation) => {
    setLocation(loc);
    setPage(1);
    setGeoResults(null);
    setPickMode(false);
    setLocationError(null);
  };

  const requestBrowserLocation = () => {
    if (!('geolocation' in navigator) || !window.isSecureContext) {
      setGeoState('idle');
      setLocationError(window.isSecureContext ? geolocationMessage(null) : 'Location access needs a secure (HTTPS) connection. Search by city, locality or PIN code instead.');
      return;
    }
    setGeoState('locating');
    // One-off reading (no watchPosition): we never track the user in the background.
    navigator.geolocation.getCurrentPosition(
      pos => {
        setGeoState('idle');
        chooseLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, label: 'Your current location' });
      },
      err => { setGeoState('idle'); setLocationError(geolocationMessage(err)); },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  };

  const searchPlace = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (q.length < 3) { setLocationError('Enter at least 3 characters: a city, locality or 6-digit PIN code.'); return; }
    setSearchingPlace(true);
    setLocationError(null);
    try {
      const r = await ConnectApi.geocode(q);
      if (r.results.length === 0) setLocationError('No matching place found. Try a nearby city or a PIN code.');
      else if (r.results.length === 1) chooseLocation({ lat: r.results[0].latitude, lng: r.results[0].longitude, label: r.results[0].label });
      else setGeoResults(r.results);
    } catch (err: any) {
      setLocationError(err.message);
    } finally {
      setSearchingPlace(false);
    }
  };

  const selectedLawyer = useMemo(() => lawyers.find(l => l.id === selectedId) || null, [lawyers, selectedId]);
  const activeFilterCount = ['specialization', 'experience', 'mode', 'language', 'availability'].filter(k => (filters as any)[k]).length + (filters.verification !== 'VERIFIED_ONLY' ? 1 : 0);
  const openProfile = (id: string) => navigate(`/connect/lawyers/${id}`);

  const filterPanel = (
    <div className="lb-filters">
      <div>
        <label className="label" htmlFor="f-spec">Legal specialization</label>
        <select id="f-spec" className="input" value={filters.specialization} onChange={e => updateFilter('specialization', e.target.value)}>
          <option value="">All specializations</option>
          {specializations.map(s => <option key={s.id} value={s.slug}>{s.name}</option>)}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="f-exp">Experience</label>
        <select id="f-exp" className="input" value={filters.experience} onChange={e => updateFilter('experience', e.target.value)}>
          <option value="">Any experience</option>
          <option value="0-2">0–2 years</option>
          <option value="3-5">3–5 years</option>
          <option value="6-10">6–10 years</option>
          <option value="10+">More than 10 years</option>
        </select>
      </div>
      <div>
        <label className="label" htmlFor="f-mode">Consultation type</label>
        <select id="f-mode" className="input" value={filters.mode} onChange={e => updateFilter('mode', e.target.value)}>
          <option value="">In-person or online</option>
          <option value="IN_PERSON">In-person</option>
          <option value="ONLINE">Online</option>
          <option value="BOTH">Offers both</option>
        </select>
      </div>
      <div>
        <label className="label" htmlFor="f-lang">Language</label>
        <select id="f-lang" className="input" value={filters.language} onChange={e => updateFilter('language', e.target.value)}>
          <option value="">Any language</option>
          {languages.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="f-avail">Availability</label>
        <select id="f-avail" className="input" value={filters.availability} onChange={e => updateFilter('availability', e.target.value)}>
          <option value="">Any availability</option>
          <option value="ACCEPTING">Accepting consultation requests</option>
          <option value="UNAVAILABLE">Currently unavailable</option>
        </select>
      </div>
      <div>
        <label className="label" htmlFor="f-ver">Verification</label>
        <select id="f-ver" className="input" value={filters.verification} onChange={e => updateFilter('verification', e.target.value as SearchFilters['verification'])}>
          <option value="VERIFIED_ONLY">Legal Buddy verified only</option>
          <option value="ALL_APPROVED">All approved listings</option>
        </select>
      </div>
      <div>
        <label className="label" htmlFor="f-sort">Sort by</label>
        <select id="f-sort" className="input" value={filters.sort} onChange={e => updateFilter('sort', e.target.value as SearchFilters['sort'])}>
          <option value="NEAREST">Nearest first</option>
          <option value="EXPERIENCE">Most experienced</option>
          <option value="RECENTLY_VERIFIED">Recently verified</option>
        </select>
      </div>
      {activeFilterCount > 0 && (
        <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: 'end' }} onClick={() => { setFilters(f => ({ ...DEFAULT_FILTERS, radiusKm: f.radiusKm, sort: f.sort })); setPage(1); }}>
          <X size={14} /> Clear filters
        </button>
      )}
    </div>
  );

  return (
    <div className="page-wrapper animate-fade-in lb-connect">
      <div className="page-header">
        <div className="page-header-text">
          <h1>Find a Lawyer</h1>
          <p>Discover legal professionals near you and connect with the right expert for your legal needs.</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => navigate('/connect/consultations')}>My consultation requests</button>
      </div>

      {params.get('specialization') && (
        <div className="alert alert-info" style={{ marginBottom: 16 }}>
          <Info size={16} style={{ flexShrink: 0 }} />
          <span>
            The specialization filter was pre-selected from your document analysis. It is only a suggestion — you can change or clear it at any time.
          </span>
        </div>
      )}

      {/* Location */}
      <section className="card lb-location-card" aria-label="Search location">
        <div className="lb-location-row">
          <form onSubmit={searchPlace} className="lb-place-form">
            <label htmlFor="place" className="sr-only">City, locality or PIN code</label>
            <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input id="place" className="input" style={{ paddingLeft: 36 }} value={query} onChange={e => setQuery(e.target.value)}
                placeholder={geocodingEnabled ? 'City, area or PIN code (e.g. Pune, Kothrud or 411038)' : 'Place search is not configured — use your location or the map'}
                disabled={!geocodingEnabled} autoComplete="off" />
            </div>
            <button type="submit" className="btn btn-primary" disabled={!geocodingEnabled || searchingPlace}>
              {searchingPlace ? 'Searching…' : 'Search'}
            </button>
          </form>
          <div className="lb-location-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setGeoState('explain')} disabled={geoState === 'locating'}>
              <LocateFixed size={16} /> {geoState === 'locating' ? 'Locating…' : 'Use my location'}
            </button>
            <button type="button" className={`btn ${pickMode ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setPickMode(p => !p); setMobileView('map'); }}>
              <MousePointerClick size={16} /> {pickMode ? 'Click on the map…' : 'Pick on map'}
            </button>
            <label htmlFor="radius" className="sr-only">Search radius</label>
            <select id="radius" className="input" style={{ width: 'auto' }} value={filters.radiusKm} onChange={e => updateFilter('radiusKm', Number(e.target.value))}>
              {RADII.map(r => <option key={r} value={r}>Within {r} km</option>)}
            </select>
          </div>
        </div>

        {geoState === 'explain' && (
          <div className="alert alert-info" style={{ marginTop: 12 }} role="dialog" aria-label="Location permission">
            <Info size={16} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <p style={{ color: 'inherit', fontWeight: 600 }}>Why we ask for your location</p>
              <p style={{ color: 'inherit', fontSize: '0.875rem', marginTop: 2 }}>
                Your browser will ask for permission. We read your position once to show lawyers near you. It is sent only with this search,
                never saved to your account, and we do not track you in the background.
              </p>
              <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-primary btn-sm" onClick={requestBrowserLocation}>Continue</button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setGeoState('idle')}>Not now</button>
              </div>
            </div>
          </div>
        )}

        {locationError && <div style={{ marginTop: 12 }}><InlineError message={locationError} /></div>}

        {geoResults && (
          <div style={{ marginTop: 12 }}>
            <p className="section-label" style={{ marginBottom: 6 }}>Choose a place</p>
            <ul className="lb-place-results">
              {geoResults.map((r, i) => (
                <li key={`${r.latitude},${r.longitude},${i}`}>
                  <button type="button" onClick={() => chooseLocation({ lat: r.latitude, lng: r.longitude, label: r.label })}>
                    <MapPin size={14} /> <span>{r.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {location && (
          <p style={{ marginTop: 10, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: 6 }}>
            <MapPin size={14} /> Searching within {filters.radiusKm} km of <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{location.label}</strong>
          </p>
        )}
      </section>

      {/* Filters: always visible on desktop, collapsible on mobile */}
      <div className="lb-filter-toggle">
        <button type="button" className="btn btn-secondary" onClick={() => setFiltersOpen(o => !o)} aria-expanded={filtersOpen}>
          <SlidersHorizontal size={16} /> Filters{activeFilterCount ? ` (${activeFilterCount})` : ''}
        </button>
        <div className="lb-view-toggle" role="tablist" aria-label="Results view">
          <button type="button" role="tab" aria-selected={mobileView === 'list'} className={mobileView === 'list' ? 'active' : ''} onClick={() => setMobileView('list')}><List size={15} /> List</button>
          <button type="button" role="tab" aria-selected={mobileView === 'map'} className={mobileView === 'map' ? 'active' : ''} onClick={() => setMobileView('map')}><MapIcon size={15} /> Map</button>
        </div>
      </div>
      <section className={`card lb-filter-card${filtersOpen ? ' is-open' : ''}`} aria-label="Filters">{filterPanel}</section>

      {/* Results + map */}
      <div className="lb-split" data-view={mobileView}>
        <section className="lb-results" aria-label="Lawyer results" aria-busy={loading}>
          {!location ? (
            <div className="card empty-state">
              <div className="empty-state-icon"><MapPin size={22} /></div>
              <h3>Choose a location to begin</h3>
              <p>Use your current location, search by city, locality or PIN code, or pick a point on the map.</p>
            </div>
          ) : error ? (
            <InlineError message={error} />
          ) : loading && lawyers.length === 0 ? (
            <div className="card" style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="spinner" /></div>
          ) : lawyers.length === 0 ? (
            <div className="card empty-state">
              <div className="empty-state-icon"><Search size={22} /></div>
              <h3>No lawyers found here</h3>
              <p>No verified lawyers match these filters within {filters.radiusKm} km. Try a larger radius, fewer filters, or a different location.</p>
              {filters.radiusKm < 100 && (
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => updateFilter('radiusKm', RADII[RADII.indexOf(filters.radiusKm) + 1] || 100)}>
                  Expand to {RADII[RADII.indexOf(filters.radiusKm) + 1] || 100} km
                </button>
              )}
            </div>
          ) : (
            <>
              <p style={{ fontSize: '0.875rem', marginBottom: 10 }}>{total} {total === 1 ? 'lawyer' : 'lawyers'} found{loading ? ' · updating…' : ''}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {lawyers.map(l => (
                  <LawyerResultCard key={l.id} lawyer={l} selected={l.id === selectedId} onClick={() => setSelectedId(l.id)} onOpen={() => openProfile(l.id)} />
                ))}
              </div>
              {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
                  <button type="button" className="btn btn-secondary btn-sm" disabled={page <= 1 || loading} onClick={() => setPage(p => p - 1)}>Previous</button>
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Page {page} of {totalPages}</span>
                  <button type="button" className="btn btn-secondary btn-sm" disabled={page >= totalPages || loading} onClick={() => setPage(p => p + 1)}>Next</button>
                </div>
              )}
            </>
          )}
          <div style={{ marginTop: 16 }}><LegalDisclaimer /></div>
        </section>

        <section className="lb-map-panel" aria-label="Map">
          <LawyerMap
            location={location}
            radiusKm={filters.radiusKm}
            lawyers={lawyers}
            selectedId={selectedId}
            onSelect={setSelectedId}
            pickMode={pickMode}
            onPick={(lat, lng) => chooseLocation({ lat, lng, label: 'the point selected on the map' })}
            onSearchArea={(lat, lng) => chooseLocation({ lat, lng, label: 'the map area' })}
          />
          {pickMode && <div className="lb-map-hint">Click anywhere on the map to search around that point.</div>}
          {selectedLawyer && (
            <div className="lb-map-preview">
              <button type="button" className="lb-map-preview-close" aria-label="Close preview" onClick={() => setSelectedId(null)}><X size={16} /></button>
              <LawyerResultCard lawyer={selectedLawyer} compact onOpen={() => openProfile(selectedLawyer.id)} />
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
