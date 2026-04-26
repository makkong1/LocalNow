import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import type { CreateRequestBody, RequestType } from '../types/api';

interface RequestFormProps {
  initialLat: number;
  initialLng: number;
  onSubmit: (body: CreateRequestBody) => void;
  isLoading: boolean;
}

const REQUEST_TYPES: RequestType[] = ['GUIDE', 'TRANSLATION', 'FOOD', 'EMERGENCY'];
const DURATION_OPTIONS = [30, 60, 90, 120, 180, 240];
const START_OFFSET_OPTIONS = [30, 60, 120];

const TYPE_LABELS: Record<RequestType, string> = {
  GUIDE: '가이드',
  TRANSLATION: '통역',
  FOOD: '음식',
  EMERGENCY: '긴급',
};

function addMinutes(minutes: number): string {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

export default function RequestForm({
  initialLat,
  initialLng,
  onSubmit,
  isLoading,
}: RequestFormProps) {
  const [requestType, setRequestType] = useState<RequestType>('GUIDE');
  const [description, setDescription] = useState('');
  const [startOffset, setStartOffset] = useState(30);
  const [durationMin, setDurationMin] = useState(60);
  const [budget, setBudget] = useState('');

  const budgetNum = parseInt(budget, 10);
  const isValid = description.trim().length > 0 && !Number.isNaN(budgetNum) && budgetNum > 0;

  function handleSubmit() {
    if (!isValid || isLoading) return;
    onSubmit({
      requestType,
      lat: initialLat,
      lng: initialLng,
      description: description.trim(),
      startAt: addMinutes(startOffset),
      durationMin,
      budgetKrw: budgetNum,
    });
  }

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.label}>요청 유형</Text>
      <View style={styles.row}>
        {REQUEST_TYPES.map((type) => (
          <TouchableOpacity
            key={type}
            testID={`type-${type}`}
            style={[styles.chipButton, requestType === type && styles.chipButtonActive]}
            onPress={() => setRequestType(type)}
          >
            <Text style={[styles.chipText, requestType === type && styles.chipTextActive]}>
              {TYPE_LABELS[type]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>설명</Text>
      <TextInput
        testID="description-input"
        style={[styles.input, styles.inputMultiline]}
        value={description}
        onChangeText={setDescription}
        placeholder="무엇이 필요하신가요?"
        placeholderTextColor="#525252"
        multiline
        numberOfLines={3}
      />

      <Text style={styles.label}>시작 시각</Text>
      <View style={styles.row}>
        {START_OFFSET_OPTIONS.map((mins) => (
          <TouchableOpacity
            key={mins}
            testID={`start-${mins}`}
            style={[styles.chipButton, startOffset === mins && styles.chipButtonActive]}
            onPress={() => setStartOffset(mins)}
          >
            <Text style={[styles.chipText, startOffset === mins && styles.chipTextActive]}>
              +{mins}분
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>소요 시간</Text>
      <View style={styles.row}>
        {DURATION_OPTIONS.map((d) => (
          <TouchableOpacity
            key={d}
            testID={`duration-${d}`}
            style={[styles.durationChip, durationMin === d && styles.chipButtonActive]}
            onPress={() => setDurationMin(d)}
          >
            <Text style={[styles.chipText, durationMin === d && styles.chipTextActive]}>
              {d}분
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>제안 금액 (KRW)</Text>
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
        <Text style={styles.submitText}>{isLoading ? '요청 중...' : '요청하기'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    padding: 16,
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
