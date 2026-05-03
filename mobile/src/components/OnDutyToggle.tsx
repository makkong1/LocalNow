import React from 'react';
import { View, Text, Switch, Alert, StyleSheet } from 'react-native';
import * as Location from 'expo-location';
import { useTranslation } from 'react-i18next';

interface OnDutyToggleProps {
  isOnDuty: boolean;
  onToggle: (onDuty: boolean, location?: { lat: number; lng: number }) => void;
  isLoading: boolean;
}

export default function OnDutyToggle({ isOnDuty, onToggle, isLoading }: OnDutyToggleProps) {
  const { t } = useTranslation();

  async function handleToggle() {
    if (isOnDuty) {
      onToggle(false);
      return;
    }

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('guide.locationPermTitle'), t('guide.locationPermMsg'));
        return;
      }

      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      onToggle(true, { lat: pos.coords.latitude, lng: pos.coords.longitude });
    } catch {
      Alert.alert(t('guide.locationErrorTitle'), t('guide.locationErrorMsg'));
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View>
          <Text style={styles.label}>{isOnDuty ? t('guide.onDutyLabel') : t('guide.offDutyLabel')}</Text>
          <Text style={styles.sub}>
            {isOnDuty ? t('guide.onDutyHint') : t('guide.offDutyHint')}
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
