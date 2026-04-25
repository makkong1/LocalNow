import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { MatchOfferResponse } from '../types/api';

interface GuideOfferCardProps {
  offer: MatchOfferResponse;
  onConfirm: (guideId: number) => void;
  isConfirming: boolean;
}

function StarRating({ rating }: { rating: number }) {
  const filled = Math.round(rating);
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Text key={i} style={i <= filled ? styles.starFilled : styles.starEmpty}>
          ★
        </Text>
      ))}
      <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
    </View>
  );
}

export default function GuideOfferCard({ offer, onConfirm, isConfirming }: GuideOfferCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.guideName}>{offer.guideName}</Text>
        <StarRating rating={offer.guideAvgRating} />
      </View>
      {offer.message ? <Text style={styles.message}>{offer.message}</Text> : null}
      <Text style={styles.meta}>
        {new Date(offer.createdAt).toLocaleTimeString('ko-KR', {
          hour: '2-digit',
          minute: '2-digit',
        })}{' '}
        수락
      </Text>
      <TouchableOpacity
        testID="confirm-button"
        style={[styles.confirmButton, isConfirming && styles.confirmButtonDisabled]}
        onPress={() => onConfirm(offer.guideId)}
        disabled={isConfirming}
      >
        <Text style={styles.confirmText}>{isConfirming ? '처리 중...' : '이 가이드로 확정'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#262626',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  guideName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  starRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  starFilled: {
    color: '#f59e0b',
    fontSize: 14,
  },
  starEmpty: {
    color: '#404040',
    fontSize: 14,
  },
  ratingText: {
    color: '#a3a3a3',
    fontSize: 12,
    marginLeft: 4,
  },
  message: {
    color: '#d4d4d4',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 8,
  },
  meta: {
    color: '#525252',
    fontSize: 11,
    marginBottom: 12,
  },
  confirmButton: {
    backgroundColor: '#f59e0b',
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    backgroundColor: '#404040',
  },
  confirmText: {
    color: '#000',
    fontWeight: '600',
    fontSize: 14,
  },
});
