import React from 'react';
import { StyleSheet } from 'react-native';
import MapView, { Marker, UrlTile, MapPressEvent } from 'react-native-maps';

interface LocationMapProps {
  lat: number;
  lng: number;
  onLocationChange?: (lat: number, lng: number) => void;
  markers?: Array<{ id: string; lat: number; lng: number; title: string }>;
}

export default function LocationMap({ lat, lng, onLocationChange, markers }: LocationMapProps) {
  function handlePress(e: MapPressEvent) {
    if (onLocationChange) {
      const { latitude, longitude } = e.nativeEvent.coordinate;
      onLocationChange(latitude, longitude);
    }
  }

  return (
    <MapView
      style={styles.map}
      region={{
        latitude: lat,
        longitude: lng,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }}
      onPress={onLocationChange ? handlePress : undefined}
    >
      <UrlTile
        urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maximumZ={19}
        flipY={false}
      />
      <Marker coordinate={{ latitude: lat, longitude: lng }} pinColor="#f59e0b" />
      {markers?.map((m) => (
        <Marker
          key={m.id}
          coordinate={{ latitude: m.lat, longitude: m.lng }}
          title={m.title}
          pinColor="white"
        />
      ))}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
});
