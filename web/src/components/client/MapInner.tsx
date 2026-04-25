'use client';

import { useLayoutEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

interface Props {
  lat: number;
  lng: number;
  guides?: Array<{ id: number; lat: number; lng: number }>;
}

function mapInstanceId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `map-${Date.now()}-${Math.random()}`;
}

/**
 * Leaflet 는 동일 div 에 Map 을 두 번 올릴 수 없다. next/dynamic(ssr:false) 와 달리
 * React 19 dev 의 이중 effect(reappearLayout) 에서도 안전하도록, 마운트 직후에만
 * MapContainer 를 띄운다(placeholder → 지도). next.config 의 reactStrictMode 는 false.
 */
export default function MapInner({ lat, lng, guides = [] }: Props) {
  const [ready, setReady] = useState(false);
  const [mapKey] = useState(mapInstanceId);

  useLayoutEffect(() => {
    setReady(true);
  }, []);

  if (!ready) {
    return <div className="h-full w-full min-h-64 bg-neutral-900" aria-hidden />;
  }

  return (
    <MapContainer
      key={mapKey}
      center={[lat, lng]}
      zoom={14}
      style={{ height: '100%', width: '100%', background: '#0a0a0a' }}
      zoomControl={false}
    >
      <TileLayer
        url="https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
      />
      <CircleMarker
        center={[lat, lng]}
        radius={8}
        pathOptions={{ color: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 1 }}
      />
      {guides.map((g) => (
        <CircleMarker
          key={g.id}
          center={[g.lat, g.lng]}
          radius={6}
          pathOptions={{ color: '#ffffff', fillColor: '#ffffff', fillOpacity: 0.9 }}
        />
      ))}
    </MapContainer>
  );
}
