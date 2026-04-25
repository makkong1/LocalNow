import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { HelpRequestResponse } from '../types/api';
import StatusBadge from './StatusBadge';

interface RequestCardProps {
  request: HelpRequestResponse;
  onAccept: (requestId: number) => void;
  isAccepting: boolean;
  isAccepted?: boolean;
  distanceKm?: number;
}

export default function RequestCard({
  request,
  onAccept,
  isAccepting,
  isAccepted = false,
  distanceKm,
}: RequestCardProps) {
  const isEmergency = request.requestType === 'EMERGENCY';
  const canAccept = request.status === 'OPEN' && !isAccepted;

  return (
    <View style={[styles.card, isEmergency && styles.emergencyCard]}>
      <View style={styles.row}>
        <Text
          testID="request-type"
          style={[styles.type, isEmergency && styles.emergencyType]}
        >
          {request.requestType}
        </Text>
        <StatusBadge status={request.status} />
      </View>
      <Text style={styles.description}>{request.description}</Text>
      <View style={styles.metaRow}>
        <Text style={styles.meta}>
          {request.budgetKrw.toLocaleString()}원 · {request.durationMin}분
        </Text>
        {distanceKm != null && <Text style={styles.meta}>{distanceKm.toFixed(1)} km</Text>}
      </View>
      {canAccept ? (
        <TouchableOpacity
          testID="accept-button"
          style={[styles.acceptButton, isAccepting && styles.acceptButtonDisabled]}
          onPress={() => onAccept(request.id)}
          disabled={isAccepting}
        >
          <Text style={styles.acceptText}>{isAccepting ? '처리 중...' : '수락하기'}</Text>
        </TouchableOpacity>
      ) : isAccepted ? (
        <TouchableOpacity testID="accept-button" style={styles.acceptButtonDone} disabled>
          <Text style={styles.acceptDoneText}>수락 완료</Text>
        </TouchableOpacity>
      ) : null}
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
  emergencyCard: {
    borderColor: '#f59e0b',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  type: {
    color: '#d4d4d4',
    fontSize: 13,
    fontWeight: '600',
  },
  emergencyType: {
    color: '#f59e0b',
  },
  description: {
    color: '#d4d4d4',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  meta: {
    color: '#525252',
    fontSize: 11,
  },
  acceptButton: {
    backgroundColor: '#f59e0b',
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: 'center',
  },
  acceptButtonDisabled: {
    backgroundColor: '#404040',
  },
  acceptButtonDone: {
    backgroundColor: '#262626',
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#404040',
  },
  acceptText: {
    color: '#000',
    fontWeight: '600',
    fontSize: 14,
  },
  acceptDoneText: {
    color: '#525252',
    fontSize: 14,
  },
});
