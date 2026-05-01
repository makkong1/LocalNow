import React from 'react';
import { View, StyleSheet } from 'react-native';
import MapboxGL from '@rnmapbox/maps';

MapboxGL.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '');

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
    <MapboxGL.MapView
      style={styles.map}
      styleURL="mapbox://styles/mapbox/dark-v11"
      onPress={onLocationChange ? handleMapPress : undefined}
    >
      <MapboxGL.Camera
        centerCoordinate={[lng, lat]}
        zoomLevel={14}
        animationDuration={300}
      />
      <MapboxGL.UserLocation visible={true} />
      <MapboxGL.PointAnnotation id="selected-location" coordinate={[lng, lat]}>
        <View style={styles.amberMarker} />
      </MapboxGL.PointAnnotation>
      {markers?.map((m) => (
        <MapboxGL.PointAnnotation key={m.id} id={m.id} coordinate={[m.lng, m.lat]}>
          <View style={styles.whiteMarker} />
          <MapboxGL.Callout title={m.title} />
        </MapboxGL.PointAnnotation>
      ))}
    </MapboxGL.MapView>
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
