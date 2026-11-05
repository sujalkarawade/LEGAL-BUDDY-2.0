import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { PublicLawyer, SearchLocation } from '../../types/connect.js';
import { MAP_TILE_URL, MAP_ATTRIBUTION, MAP_MAX_ZOOM, DEFAULT_VIEW } from './mapConfig.js';

interface LawyerMapProps {
  location: SearchLocation | null;
  radiusKm: number;
  lawyers: PublicLawyer[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** When true, a click on the map chooses the search location (manual selection). */
  pickMode?: boolean;
  onPick?: (lat: number, lng: number) => void;
  /** Called with the map centre when the user presses "Search this area" after panning. */
  onSearchArea?: (lat: number, lng: number) => void;
  height?: string;
}

interface Cluster { lat: number; lng: number; items: PublicLawyer[] }

const CLUSTER_CELL_PX = 56;

/** Grid-based clustering in screen space at the current zoom (no plugin dependency). */
export function clusterLawyers(map: L.Map, lawyers: PublicLawyer[]): Cluster[] {
  const zoom = map.getZoom();
  const cells = new Map<string, Cluster>();
  for (const lawyer of lawyers) {
    if (!lawyer.office) continue; // every marker must be a real office record with coordinates
    const point = map.project([lawyer.office.latitude, lawyer.office.longitude], zoom);
    const key = `${Math.floor(point.x / CLUSTER_CELL_PX)}:${Math.floor(point.y / CLUSTER_CELL_PX)}`;
    const cell = cells.get(key) || { lat: 0, lng: 0, items: [] };
    cell.items.push(lawyer);
    cells.set(key, cell);
  }
  return [...cells.values()].map(c => ({
    items: c.items,
    lat: c.items.reduce((s, l) => s + l.office!.latitude, 0) / c.items.length,
    lng: c.items.reduce((s, l) => s + l.office!.longitude, 0) / c.items.length,
  }));
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!));

export const LawyerMap: React.FC<LawyerMapProps> = ({ location, radiusKm, lawyers, selectedId, onSelect, pickMode, onPick, onSearchArea, height = '100%' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const searchLayerRef = useRef<L.LayerGroup | null>(null);
  const callbacks = useRef({ onSelect, onPick, onSearchArea, pickMode });
  callbacks.current = { onSelect, onPick, onSearchArea, pickMode };
  const [moved, setMoved] = useState(false);
  const programmaticMove = useRef(false);

  // Create the map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: true, attributionControl: true, minZoom: 4, maxZoom: MAP_MAX_ZOOM })
      .setView([DEFAULT_VIEW.lat, DEFAULT_VIEW.lng], DEFAULT_VIEW.zoom);
    L.tileLayer(MAP_TILE_URL, { attribution: MAP_ATTRIBUTION, maxZoom: MAP_MAX_ZOOM }).addTo(map);
    markersRef.current = L.layerGroup().addTo(map);
    searchLayerRef.current = L.layerGroup().addTo(map);
    map.on('click', (e: L.LeafletMouseEvent) => {
      if (callbacks.current.pickMode && callbacks.current.onPick) callbacks.current.onPick(e.latlng.lat, e.latlng.lng);
      else callbacks.current.onSelect(null);
    });
    map.on('movestart', () => { if (!programmaticMove.current) setMoved(true); });
    map.on('moveend', () => { programmaticMove.current = false; });
    mapRef.current = map;

    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(containerRef.current);
    return () => { observer.disconnect(); map.remove(); mapRef.current = null; };
  }, []);

  // Search location marker + radius circle; fit the view to the search circle.
  useEffect(() => {
    const map = mapRef.current;
    const layer = searchLayerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    if (!location) return;
    L.circle([location.lat, location.lng], {
      radius: radiusKm * 1000, color: '#2563eb', weight: 1, opacity: 0.6, fillOpacity: 0.04, interactive: false,
    }).addTo(layer);
    L.marker([location.lat, location.lng], {
      icon: L.divIcon({ className: 'lb-search-marker', html: '<span></span>', iconSize: [18, 18], iconAnchor: [9, 9] }),
      title: 'Your selected search location', keyboard: false, interactive: false,
    }).addTo(layer);
    programmaticMove.current = true;
    map.fitBounds(L.latLng(location.lat, location.lng).toBounds(radiusKm * 2000), { padding: [16, 16] });
    setMoved(false);
  }, [location?.lat, location?.lng, radiusKm]);

  // Lawyer markers with clustering, re-computed on zoom.
  useEffect(() => {
    const map = mapRef.current;
    const group = markersRef.current;
    if (!map || !group) return;
    const render = () => {
      group.clearLayers();
      for (const cluster of clusterLawyers(map, lawyers)) {
        if (cluster.items.length === 1) {
          const lawyer = cluster.items[0];
          const selected = lawyer.id === selectedId;
          const marker = L.marker([cluster.lat, cluster.lng], {
            icon: L.divIcon({
              className: `lb-lawyer-marker${selected ? ' is-selected' : ''}${lawyer.legalBuddyVerified ? ' is-verified' : ''}`,
              html: '<span></span>', iconSize: [30, 30], iconAnchor: [15, 30],
            }),
            title: lawyer.professionalName,
            alt: `Office of ${lawyer.professionalName}`,
            riseOnHover: true,
            zIndexOffset: selected ? 1000 : 0,
          });
          marker.on('click', () => callbacks.current.onSelect(lawyer.id));
          marker.addTo(group);
        } else {
          const marker = L.marker([cluster.lat, cluster.lng], {
            icon: L.divIcon({ className: 'lb-cluster-marker', html: `<span>${cluster.items.length}</span>`, iconSize: [38, 38], iconAnchor: [19, 19] }),
            title: `${cluster.items.length} lawyers`,
          });
          marker.on('click', () => {
            const bounds = L.latLngBounds(cluster.items.map(l => [l.office!.latitude, l.office!.longitude] as [number, number]));
            if (map.getZoom() >= map.getMaxZoom() - 1 || bounds.getNorthEast().equals(bounds.getSouthWest())) {
              // Same building: list the lawyers in a popup instead of zooming forever.
              const list = cluster.items.map(l => `<button type="button" class="lb-popup-item" data-id="${escapeHtml(l.id)}">${escapeHtml(l.professionalName)}</button>`).join('');
              const popup = L.popup({ closeButton: true }).setLatLng([cluster.lat, cluster.lng]).setContent(`<div class="lb-popup-list">${list}</div>`).openOn(map);
              popup.getElement()?.querySelectorAll<HTMLButtonElement>('.lb-popup-item').forEach(btn => {
                btn.addEventListener('click', () => { callbacks.current.onSelect(btn.dataset.id || null); map.closePopup(); });
              });
            } else {
              map.fitBounds(bounds, { padding: [48, 48] });
            }
          });
          marker.addTo(group);
        }
      }
    };
    render();
    // Without a search location (e.g. a single profile or office editor), frame the offices themselves.
    if (!location) {
      const points = lawyers.filter(l => l.office).map(l => [l.office!.latitude, l.office!.longitude] as [number, number]);
      if (points.length) {
        programmaticMove.current = true;
        map.fitBounds(L.latLngBounds(points), { padding: [32, 32], maxZoom: 15 });
      }
    }
    map.on('zoomend', render);
    return () => { map.off('zoomend', render); };
  }, [lawyers, selectedId]);

  // Pan to the selected lawyer when it is chosen from the list.
  useEffect(() => {
    const map = mapRef.current;
    const lawyer = lawyers.find(l => l.id === selectedId);
    if (!map || !lawyer?.office) return;
    if (!map.getBounds().contains([lawyer.office.latitude, lawyer.office.longitude])) {
      programmaticMove.current = true;
      map.panTo([lawyer.office.latitude, lawyer.office.longitude]);
    }
  }, [selectedId]);

  useEffect(() => {
    containerRef.current?.classList.toggle('lb-map-pick', Boolean(pickMode));
  }, [pickMode]);

  return (
    <div style={{ position: 'relative', width: '100%', height }}>
      <div ref={containerRef} className="lb-map" style={{ width: '100%', height: '100%' }} role="region" aria-label="Map of lawyer office locations" />
      {moved && onSearchArea && location && (
        <button
          type="button"
          className="btn btn-sm btn-primary"
          style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 500 }}
          onClick={() => {
            const c = mapRef.current?.getCenter();
            if (c) { setMoved(false); onSearchArea(c.lat, c.lng); }
          }}
        >
          Search this area
        </button>
      )}
    </div>
  );
};
