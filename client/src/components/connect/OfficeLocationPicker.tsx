import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MAP_TILE_URL, MAP_ATTRIBUTION, MAP_MAX_ZOOM, DEFAULT_VIEW } from './mapConfig.js';

/**
 * Lets a lawyer place (click) or fine-tune (drag) their office pin. Coordinates only change
 * through an explicit action by the lawyer: a geocoding result they chose, a click, or a drag.
 */
export const OfficeLocationPicker: React.FC<{
  value: { lat: number; lng: number } | null;
  onChange: (lat: number, lng: number) => void;
}> = ({ value, onChange }) => {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = L.map(ref.current, { minZoom: 4, maxZoom: MAP_MAX_ZOOM }).setView([DEFAULT_VIEW.lat, DEFAULT_VIEW.lng], DEFAULT_VIEW.zoom);
    L.tileLayer(MAP_TILE_URL, { attribution: MAP_ATTRIBUTION, maxZoom: MAP_MAX_ZOOM }).addTo(map);
    map.on('click', (e: L.LeafletMouseEvent) => onChangeRef.current(round(e.latlng.lat), round(e.latlng.lng)));
    mapRef.current = map;
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(ref.current);
    return () => { observer.disconnect(); map.remove(); mapRef.current = null; markerRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!value) { markerRef.current?.remove(); markerRef.current = null; return; }
    if (!markerRef.current) {
      markerRef.current = L.marker([value.lat, value.lng], {
        draggable: true,
        icon: L.divIcon({ className: 'lb-lawyer-marker is-selected', html: '<span></span>', iconSize: [30, 30], iconAnchor: [15, 30] }),
        title: 'Office location (drag to adjust)',
      }).addTo(map);
      markerRef.current.on('dragend', () => {
        const p = markerRef.current!.getLatLng();
        onChangeRef.current(round(p.lat), round(p.lng));
      });
      map.setView([value.lat, value.lng], Math.max(map.getZoom(), 16));
    } else {
      markerRef.current.setLatLng([value.lat, value.lng]);
      if (!map.getBounds().contains([value.lat, value.lng])) map.setView([value.lat, value.lng], Math.max(map.getZoom(), 16));
    }
  }, [value?.lat, value?.lng]);

  return <div ref={ref} className="lb-map" style={{ width: '100%', height: 320, borderRadius: 'var(--radius)', border: '1px solid var(--border)' }} aria-label="Office location map" role="region" />;
};

const round = (n: number) => Math.round(n * 1e6) / 1e6;
