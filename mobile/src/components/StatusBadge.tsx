import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { HelpRequestStatus, MatchOfferStatus } from '../types/api';

interface StatusBadgeProps {
  status: HelpRequestStatus | MatchOfferStatus;
  size?: 'sm' | 'md';
}

const STATUS_COLOR: Record<string, string> = {
  OPEN: '#eab308',
  MATCHED: '#22c55e',
  CONFIRMED: '#22c55e',
  IN_PROGRESS: '#3b82f6',
  COMPLETED: '#525252',
  CANCELLED: '#ef4444',
  REJECTED: '#ef4444',
  PENDING: '#eab308',
};

export default function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const { t } = useTranslation();
  const color = STATUS_COLOR[status] ?? '#525252';
  return (
    <View
      style={[
        styles.badge,
        size === 'md' && styles.badgeMd,
        { backgroundColor: color + '20', borderColor: color },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.label, size === 'md' && styles.labelMd, { color }]}>
        {t(`status.${status}`, { defaultValue: status })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
  },
  badgeMd: {
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
  },
  labelMd: {
    fontSize: 13,
  },
});
