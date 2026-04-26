import React from 'react';
import { View, Text, Switch, Alert, StyleSheet } from 'react-native';
import * as Location from 'expo-location';

interface OnDutyToggleProps {
  isOnDuty: boolean;
  onToggle: (onDuty: boolean, location?: { lat: number; lng: number }) => void;
  isLoading: boolean;
}

export default function OnDutyToggle({ isOnDuty, onToggle, isLoading }: OnDutyToggleProps) {
  async function handleToggle() {
    if (isOnDuty) {
      onToggle(false);
      return;
    }

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('위치 권한 필요', '근무 시작에는 위치 권한이 필요합니다');
      return;
    }

    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    onToggle(true, { lat: pos.coords.latitude, lng: pos.coords.longitude });
  }

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View>
          <Text style={styles.label}>{isOnDuty ? '근무 중' : '근무 대기'}</Text>
          <Text style={styles.sub}>
            {isOnDuty ? '주변 요청을 수신 중입니다' : '토글을 켜면 근무를 시작합니다'}
          </Text>
        </View>
        <Switch
          testID="duty-switch"
          value={isOnDuty}
          onValueChange={handleToggle}
          disabled={isLoading}
          trackColor={{ false: '#262626', true: '#f59e0b' }}
          thumbColor={isOnDuty ? '#000' : '#525252'}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#141414',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#262626',
    padding: 16,
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  sub: {
    color: '#525252',
    fontSize: 12,
    marginTop: 2,
  },
});
