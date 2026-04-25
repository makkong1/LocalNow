'use client';

import dynamic from 'next/dynamic';

interface Props {
  lat: number;
  lng: number;
  guides?: Array<{ id: number; lat: number; lng: number }>;
}

const MapInner = dynamic(() => import('./MapInner'), { ssr: false });

export default function LocationMap(props: Props) {
  return (
    <div className="rounded-lg overflow-hidden border border-neutral-800 h-64">
      <MapInner {...props} />
    </div>
  );
}
