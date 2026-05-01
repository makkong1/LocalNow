import React, { useState } from 'react';
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
} from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import type { CreateRequestBody, RequestType } from '../types/api';

interface RequestFormProps {
  initialLat: number;
  initialLng: number;
  onSubmit: (body: CreateRequestBody) => void;
  isLoading: boolean;
}

const REQUEST_TYPES: RequestType[] = ['GUIDE', 'TRANSLATION', 'FOOD', 'EMERGENCY'];
const DURATION_OPTIONS = [30, 60, 90, 120, 180, 240];

const TYPE_LABELS: Record<RequestType, string> = {
  GUIDE: '가이드',
  TRANSLATION: '통역',
  FOOD: '음식',
  EMERGENCY: '긴급',
};

function minutesFromNow(minutes: number): Date {
  return new Date(Date.now() + minutes * 60 * 1000);
}

function formatStartAt(d: Date): string {
  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(d);
}

export default function RequestForm({
  initialLat,
  initialLng,
  onSubmit,
  isLoading,
}: RequestFormProps) {
  const [requestType, setRequestType] = useState<RequestType>('GUIDE');
  const [description, setDescription] = useState('');
  /** 요청 시작 시각 (디바이스 로컬 → API는 ISO UTC) */
  const [startAt, setStartAt] = useState(() => minutesFromNow(30));
  const [durationMin, setDurationMin] = useState(60);
  const [budget, setBudget] = useState('');

  const [pickerOpen, setPickerOpen] = useState(false);

  const budgetNum = parseInt(budget, 10);
  const isValid = description.trim().length > 0 && !Number.isNaN(budgetNum) && budgetNum > 0;

  function handleSubmit() {
    if (!isValid || isLoading) return;
    onSubmit({
      requestType,
      lat: initialLat,
      lng: initialLng,
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
      <TouchableOpacity
        testID="start-at-picker-trigger"
        style={styles.datetimeRow}
        onPress={() => setPickerOpen(true)}
      >
        <Text style={styles.datetimeValue}>{formatStartAt(startAt)}</Text>
        <Text style={styles.datetimeHint}>탭해서 날짜·시간 선택</Text>
      </TouchableOpacity>

      {/* iOS: 바텀시트에서 스피너로 선택, 완료로 닫기 */}
      <Modal transparent visible={pickerOpen && Platform.OS === 'ios'} animationType="slide">
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalBackdrop} onPress={() => setPickerOpen(false)} accessibilityRole="button" />
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setPickerOpen(false)}>
                <Text style={styles.modalDone}>완료</Text>
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

      <Text style={styles.label}>소요 시간</Text>
      <View style={styles.row}>
        {DURATION_OPTIONS.map((d) => (
          <TouchableOpacity
            key={d}
            testID={`duration-${d}`}
            style={[styles.durationChip, durationMin === d && styles.chipButtonActive]}
            onPress={() => setDurationMin(d)}
          >
            <Text style={[styles.chipText, durationMin === d && styles.chipTextActive]}>{d}분</Text>
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
