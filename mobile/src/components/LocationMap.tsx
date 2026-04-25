import React, { useEffect } from 'react';
import { Alert, StyleSheet } from 'react-native';
import MapView, { Marker, UrlTile, MapPressEvent } from 'react-native-maps';
import * as Location from 'expo-location';

const DEFAULT_LAT = 37.5665;
const DEFAULT_LNG = 126.978;

interface LocationMapProps {
  lat: number;
  lng: number;
  onLocationChange?: (lat: number, lng: number) => void;
  markers?: Array<{ id: string; lat: number; lng: number; title: string }>;
}

export default function LocationMap({ lat, lng, onLocationChange, markers }: LocationMapProps) {
  useEffect(() => {
    if (!onLocationChange) return;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          '위치 권한 필요',
          '위치 권한이 거부되었습니다. 지도를 탭하여 위치를 선택하세요.',
        );
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      onLocationChange(pos.coords.latitude, pos.coords.longitude);
    })();
  // onLocationChange ref는 마운트 시 한 번만 실행
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

export { DEFAULT_LAT, DEFAULT_LNG };

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
});
