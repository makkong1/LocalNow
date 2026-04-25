'use client';

import { MapContainer, TileLayer, CircleMarker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

interface Props {
  lat: number;
  lng: number;
  guides?: Array<{ id: number; lat: number; lng: number }>;
}

export default function MapInner({ lat, lng, guides = [] }: Props) {
  return (
    <MapContainer
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
