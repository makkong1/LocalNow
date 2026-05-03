import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Modal,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as Location from 'expo-location';
import type { CreateRequestBody, RequestType } from '../types/api';
import LocationMap from './LocationMap';

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
}

interface RequestFormProps {
  initialLat: number;
  initialLng: number;
  onSubmit: (body: CreateRequestBody) => void;
  isLoading: boolean;
}

const REQUEST_TYPES: RequestType[] = ['GUIDE', 'TRANSLATION', 'FOOD', 'EMERGENCY'];
const DURATION_OPTIONS = [30, 60, 90, 120, 180, 240];
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

function minutesFromNow(minutes: number): Date {
  return new Date(Date.now() + minutes * 60 * 1000);
}

function formatStartAt(d: Date): string {
  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(d);
}

async function fetchAddressSuggestions(query: string): Promise<NominatimResult[]> {
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    limit: '5',
    'accept-language': 'ko,en',
  });
  const res = await fetch(`${NOMINATIM_URL}?${params}`, {
    headers: { 'User-Agent': 'LocalNow/1.0 (contact: localnow@example.com)' },
  });
  return res.json();
}

export default function RequestForm({
  initialLat,
  initialLng,
  onSubmit,
  isLoading,
}: RequestFormProps) {
  const { t } = useTranslation();
  const [lat, setLat] = useState(initialLat);
  const [lng, setLng] = useState(initialLng);
  const [locationLoading, setLocationLoading] = useState(false);

  const [requestType, setRequestType] = useState<RequestType>('GUIDE');
  const [description, setDescription] = useState('');
  const [startAt, setStartAt] = useState(() => minutesFromNow(30));
  const [durationMin, setDurationMin] = useState(60);
  const [budget, setBudget] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<NominatimResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // GPS auto-detect on mount; keep fallback coords on failure or permission denial
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLocationLoading(true);
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (cancelled || status !== 'granted') return;
        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (!cancelled) {
          setLat(position.coords.latitude);
          setLng(position.coords.longitude);
        }
      } catch {
        // keep initialLat/initialLng fallback
      } finally {
        if (!cancelled) setLocationLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Debounced Nominatim address search (500ms); clear results immediately when query is emptied
  useEffect(() => {
    const trimmed = searchQuery.trim();
    const delay = trimmed ? 500 : 0;
    const timer = setTimeout(async () => {
      if (!trimmed) {
        setSearchResults([]);
        return;
      }
      try {
        setIsSearching(true);
        const results = await fetchAddressSuggestions(trimmed);
        setSearchResults(results.slice(0, 5));
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, delay);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const budgetNum = parseInt(budget, 10);
  const isValid = description.trim().length > 0 && !Number.isNaN(budgetNum) && budgetNum > 0;

  function handleSubmit() {
    if (!isValid || isLoading) return;
    onSubmit({
      requestType,
      lat,
      lng,
      description: description.trim(),
      startAt: startAt.toISOString(),
      durationMin,
      budgetKrw: budgetNum,
    });
  }

  function onPickDate(event: DateTimePickerEvent, date?: Date) {
    if (Platform.OS === 'android') setPickerOpen(false);
    if (Platform.OS === 'android' && event.type === 'dismissed') return;
    if (!date) return;
    const minNow = Date.now();
    if (date.getTime() < minNow - 15000) return;
    setStartAt(date);
  }

  function handleSelectResult(result: NominatimResult) {
    setLat(parseFloat(result.lat));
    setLng(parseFloat(result.lon));
    setSearchQuery(result.display_name);
    setSearchResults([]);
  }

  return (
    <View style={styles.container}>
      {/* Search bar + map (non-scrolling) */}
      <View style={styles.searchAndMapSection}>
        <View style={styles.searchWrapper}>
          <TextInput
            testID="address-search-input"
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t('traveler.locationSearch')}
            placeholderTextColor="#525252"
          />
          {isSearching && (
            <ActivityIndicator style={styles.searchSpinner} size="small" color="#f59e0b" />
          )}
          {searchResults.length > 0 && (
            <View style={styles.dropdown}>
              {searchResults.map((result, index) => (
                <TouchableOpacity
                  key={index}
                  testID={`search-result-${index}`}
                  style={[
                    styles.dropdownItem,
                    index < searchResults.length - 1 && styles.dropdownItemBorder,
                  ]}
                  onPress={() => handleSelectResult(result)}
                >
                  <Text style={styles.dropdownText} numberOfLines={1}>
                    {result.display_name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
        <View style={styles.mapContainer}>
          {locationLoading && (
            <View style={styles.mapLoadingOverlay}>
              <ActivityIndicator color="#f59e0b" size="small" />
            </View>
          )}
          <LocationMap
            lat={lat}
            lng={lng}
            onLocationChange={(newLat, newLng) => {
              setLat(newLat);
              setLng(newLng);
            }}
          />
        </View>
      </View>

      {/* Form fields (scrolling) */}
      <ScrollView style={styles.formScroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>{t('traveler.requestType')}</Text>
        <View style={styles.row}>
          {REQUEST_TYPES.map((type) => (
            <TouchableOpacity
              key={type}
              testID={`type-${type}`}
              style={[styles.chipButton, requestType === type && styles.chipButtonActive]}
              onPress={() => setRequestType(type)}
            >
              <Text style={[styles.chipText, requestType === type && styles.chipTextActive]}>
                {t(`requestType.${type}`, { defaultValue: type })}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>{t('traveler.description')}</Text>
        <TextInput
          testID="description-input"
          style={[styles.input, styles.inputMultiline]}
          value={description}
          onChangeText={setDescription}
          placeholder={t('traveler.descriptionPlaceholder')}
          placeholderTextColor="#525252"
          multiline
          numberOfLines={3}
        />

        <Text style={styles.label}>{t('traveler.startAt')}</Text>
        <TouchableOpacity
          testID="start-at-picker-trigger"
          style={styles.datetimeRow}
          onPress={() => setPickerOpen(true)}
        >
          <Text style={styles.datetimeValue}>{formatStartAt(startAt)}</Text>
          <Text style={styles.datetimeHint}>{t('traveler.startAtPlaceholder')}</Text>
        </TouchableOpacity>

        <Modal transparent visible={pickerOpen && Platform.OS === 'ios'} animationType="slide">
          <View style={styles.modalRoot}>
            <Pressable style={styles.modalBackdrop} onPress={() => setPickerOpen(false)} accessibilityRole="button" />
            <View style={styles.modalSheet}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setPickerOpen(false)}>
                  <Text style={styles.modalDone}>{t('traveler.startAtDone')}</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                testID="start-at-picker-ios"
                value={startAt}
                mode="datetime"
                display="spinner"
                minimumDate={new Date()}
                onChange={(e, date) => onPickDate(e, date)}
                locale="ko-KR"
              />
            </View>
          </View>
        </Modal>

        {/* Android: 시스템 다이얼로그 */}
        {pickerOpen && Platform.OS === 'android' ? (
          <DateTimePicker
            testID="start-at-picker-android"
            value={startAt}
            mode="datetime"
            display="default"
            minimumDate={new Date()}
            onChange={(e, date) => onPickDate(e, date)}
            locale="ko-KR"
          />
        ) : null}

        <Text style={styles.label}>{t('traveler.duration')}</Text>
        <View style={styles.row}>
          {DURATION_OPTIONS.map((d) => (
            <TouchableOpacity
              key={d}
              testID={`duration-${d}`}
              style={[styles.durationChip, durationMin === d && styles.chipButtonActive]}
              onPress={() => setDurationMin(d)}
            >
              <Text style={[styles.chipText, durationMin === d && styles.chipTextActive]}>
                {`${d}${t('common.min')}`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>{t('traveler.budget')}</Text>
        <TextInput
          testID="budget-input"
          style={styles.input}
          value={budget}
          onChangeText={setBudget}
          placeholder="30000"
          placeholderTextColor="#525252"
          keyboardType="numeric"
        />

        <TouchableOpacity
          testID="submit-button"
          style={[styles.submitButton, (!isValid || isLoading) && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={!isValid || isLoading}
        >
          <Text style={styles.submitText}>{isLoading ? t('traveler.submitting') : t('traveler.submit')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  searchAndMapSection: {
    zIndex: 10,
  },
  searchWrapper: {
    position: 'relative',
    zIndex: 10,
    marginHorizontal: 16,
    marginTop: 12,
  },
  searchInput: {
    backgroundColor: '#1c1c1c',
    borderWidth: 1,
    borderColor: '#262626',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 14,
  },
  searchSpinner: {
    position: 'absolute',
    right: 10,
    top: 10,
  },
  dropdown: {
    position: 'absolute',
    top: 44,
    left: 0,
    right: 0,
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#262626',
    borderRadius: 6,
    zIndex: 20,
    elevation: 8,
  },
  dropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  dropdownItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#262626',
  },
  dropdownText: {
    color: '#d4d4d4',
    fontSize: 13,
  },
  mapContainer: {
    height: 200,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#262626',
  },
  mapLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(10,10,10,0.6)',
    zIndex: 1,
  },
  formScroll: {
    flex: 1,
    paddingHorizontal: 16,
  },
  label: {
    color: '#a3a3a3',
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 16,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chipButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#1c1c1c',
    borderWidth: 1,
    borderColor: '#262626',
  },
  chipButtonActive: {
    backgroundColor: '#f59e0b',
    borderColor: '#f59e0b',
  },
  chipText: {
    color: '#a3a3a3',
    fontSize: 13,
  },
  chipTextActive: {
    color: '#000',
    fontWeight: '600',
  },
  datetimeRow: {
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#262626',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  datetimeValue: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  datetimeHint: {
    color: '#737373',
    fontSize: 11,
    marginTop: 4,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  modalSheet: {
    backgroundColor: '#171717',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#262626',
  },
  modalDone: {
    color: '#f59e0b',
    fontSize: 17,
    fontWeight: '600',
  },
  durationChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#1c1c1c',
    borderWidth: 1,
    borderColor: '#262626',
  },
  input: {
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#262626',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 14,
  },
  inputMultiline: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  submitButton: {
    marginTop: 24,
    marginBottom: 16,
    backgroundColor: '#f59e0b',
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#404040',
  },
  submitText: {
    color: '#000',
    fontWeight: '600',
    fontSize: 15,
  },
});
