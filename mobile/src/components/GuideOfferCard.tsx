import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { MatchOfferResponse } from '../types/api';

function offerTimeLocale(lang: string): string {
  const b = lang.split('-')[0];
  if (b === 'ko') return 'ko-KR';
  if (b === 'ja') return 'ja-JP';
  if (b === 'zh') return 'zh-CN';
  return 'en-US';
}

interface GuideOfferCardProps {
  offer: MatchOfferResponse;
  hasCertification: boolean;
  onConfirm: (guideId: number) => void;
  onPressProfile: () => void;
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

export default function GuideOfferCard({
  offer,
  hasCertification,
  onConfirm,
  onPressProfile,
  isConfirming,
}: GuideOfferCardProps) {
  const { t, i18n } = useTranslation();
  const locale = offerTimeLocale(i18n.language);

  return (
    <View style={styles.card}>
      <TouchableOpacity style={styles.cardHeader} onPress={onPressProfile} activeOpacity={0.7}>
        <View style={styles.nameRow}>
          <Text style={styles.guideName}>{offer.guideName}</Text>
          {hasCertification && (
            <View style={styles.certBadge}>
              <Text style={styles.certBadgeText}>{t('offer.verified')}</Text>
            </View>
          )}
        </View>
        <View style={styles.headerRight}>
          <StarRating rating={offer.guideAvgRating} />
          <Text style={styles.profileLink}>{t('offer.viewProfile')}</Text>
        </View>
      </TouchableOpacity>
      {offer.message ? <Text style={styles.message}>{offer.message}</Text> : null}
      <Text style={styles.meta}>
        {new Date(offer.createdAt).toLocaleTimeString(locale, {
          hour: '2-digit',
          minute: '2-digit',
        })}{' '}
        {t('guide.accepted')}
      </Text>
      <TouchableOpacity
        testID="confirm-button"
        style={[styles.confirmButton, isConfirming && styles.confirmButtonDisabled]}
        onPress={() => onConfirm(offer.guideId)}
        disabled={isConfirming}
      >
        <Text style={styles.confirmText}>
          {isConfirming ? t('common.processing') : t('offer.confirm')}
        </Text>
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
    marginBottom: 8,
    gap: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  guideName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  certBadge: {
    backgroundColor: '#16a34a',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  certBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  headerRight: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  profileLink: {
    color: '#f59e0b',
    fontSize: 12,
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
