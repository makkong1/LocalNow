import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useCreateReview } from '../hooks/useReview';
import type { ApiError } from '../types/api';

interface ReviewFormProps {
  requestId: number;
  guideId: number;
  onSubmit: () => void;
}

export default function ReviewForm({ requestId, onSubmit }: ReviewFormProps) {
  const { t } = useTranslation();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const createReview = useCreateReview();

  const isValid = rating >= 1 && rating <= 5;

  async function handleSubmit() {
    if (!isValid || createReview.isPending) return;
    await createReview.mutateAsync({
      requestId,
      rating,
      comment: comment.trim() || undefined,
    });
    onSubmit();
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{t('review.rating')}</Text>
      <View style={styles.starRow}>
        {[1, 2, 3, 4, 5].map((i) => (
          <TouchableOpacity key={i} testID={`star-${i}`} onPress={() => setRating(i)}>
            <Text style={i <= rating ? styles.starFilled : styles.starEmpty}>★</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>{t('review.comment')}</Text>
      <TextInput
        testID="comment-input"
        style={[styles.input, styles.inputMultiline]}
        value={comment}
        onChangeText={setComment}
        placeholder={t('review.commentPlaceholder')}
        placeholderTextColor="#525252"
        multiline
        numberOfLines={3}
      />

      <TouchableOpacity
        testID="review-submit-button"
        style={[styles.submitButton, (!isValid || createReview.isPending) && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={!isValid || createReview.isPending}
      >
        <Text style={styles.submitText}>
          {createReview.isPending ? t('review.submitting') : t('review.submit')}
        </Text>
      </TouchableOpacity>

      {createReview.isError && (
        <Text testID="review-error-message" style={styles.errorText}>
          {(createReview.error as ApiError | null)?.message ?? t('review.submitError')}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
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
  starRow: {
    flexDirection: 'row',
    gap: 8,
  },
  starFilled: {
    color: '#f59e0b',
    fontSize: 28,
  },
  starEmpty: {
    color: '#404040',
    fontSize: 28,
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
  errorText: {
    color: '#ef4444',
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
  },
});
