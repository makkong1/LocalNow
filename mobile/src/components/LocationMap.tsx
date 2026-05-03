import React from 'react';
import { View, StyleSheet } from 'react-native';
import MapLibreGL from '@maplibre/maplibre-react-native';

const DARK_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

interface LocationMapProps {
  lat: number;
  lng: number;
  onLocationChange?: (lat: number, lng: number) => void;
  markers?: Array<{ id: string; lat: number; lng: number; title: string }>;
}

export default function LocationMap({ lat, lng, onLocationChange, markers }: LocationMapProps) {
  function handleMapPress(feature: GeoJSON.Feature<GeoJSON.Point>) {
    if (onLocationChange) {
      const [pressLng, pressLat] = feature.geometry.coordinates;
      onLocationChange(pressLat, pressLng);
    }
  }

  return (
    <MapLibreGL.MapView
      style={styles.map}
      styleURL={DARK_STYLE}
      onPress={onLocationChange ? handleMapPress : undefined}
    >
      <MapLibreGL.Camera
        centerCoordinate={[lng, lat]}
        zoomLevel={14}
        animationDuration={300}
      />
      <MapLibreGL.UserLocation visible={true} />
      <MapLibreGL.PointAnnotation id="selected-location" coordinate={[lng, lat]}>
        <View style={styles.amberMarker} />
      </MapLibreGL.PointAnnotation>
      {markers?.map((m) => (
        <MapLibreGL.PointAnnotation key={m.id} id={m.id} coordinate={[m.lng, m.lat]}>
          <View style={styles.whiteMarker} />
          <MapLibreGL.Callout title={m.title} />
        </MapLibreGL.PointAnnotation>
      ))}
    </MapLibreGL.MapView>
  );
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
  amberMarker: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#f59e0b',
    borderWidth: 2,
    borderColor: '#fff',
  },
  whiteMarker: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#a3a3a3',
  },
});
