import React, { useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { useOpenRequests } from '../hooks/useRequests';
import { useAcceptRequest } from '../hooks/useMatches';
import { useSetDuty } from '../hooks/useGuide';
import OnDutyToggle from '../components/OnDutyToggle';
import RequestCard from '../components/RequestCard';

export default function GuideScreen() {
  const [isOnDuty, setIsOnDuty] = useState(false);
  const [acceptedIds, setAcceptedIds] = useState<Set<number>>(new Set());
  const [acceptingId, setAcceptingId] = useState<number | null>(null);

  const setDuty = useSetDuty();
  const { data: requestsPage, isLoading: requestsLoading } = useOpenRequests({
    enabled: isOnDuty,
    refetchInterval: isOnDuty ? 10000 : false,
  });
  const acceptRequest = useAcceptRequest();

  async function handleToggle(onDuty: boolean, location?: { lat: number; lng: number }) {
    await setDuty.mutateAsync({ onDuty, lat: location?.lat, lng: location?.lng });
    setIsOnDuty(onDuty);
  }

  async function handleAccept(requestId: number) {
    setAcceptingId(requestId);
    try {
      await acceptRequest.mutateAsync({ requestId });
      setAcceptedIds((prev) => new Set([...prev, requestId]));
    } finally {
      setAcceptingId(null);
    }
  }

  const openRequests = requestsPage?.items ?? [];
  const hasAccepted = acceptedIds.size > 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <OnDutyToggle
        isOnDuty={isOnDuty}
        onToggle={handleToggle}
        isLoading={setDuty.isPending}
      />

      {isOnDuty && (
        <>
          <Text style={styles.sectionLabel}>주변 도움 요청</Text>

          {requestsLoading ? (
            <ActivityIndicator color="#f59e0b" style={styles.loader} />
          ) : openRequests.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>주변에 요청이 없습니다</Text>
            </View>
          ) : (
            openRequests.map((req) => (
              <RequestCard
                key={req.id}
                request={req}
                onAccept={handleAccept}
                isAccepting={acceptingId === req.id}
                isAccepted={acceptedIds.has(req.id)}
              />
            ))
          )}

          {hasAccepted && (
            <View style={styles.chatHint}>
              <Text style={styles.chatHintText}>
                수락한 요청이 확정되면 채팅 탭에서 대화를 시작할 수 있습니다.
              </Text>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  content: {
    padding: 16,
  },
  sectionLabel: {
    color: '#a3a3a3',
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  loader: {
    marginVertical: 24,
  },
  emptyBox: {
    padding: 32,
    alignItems: 'center',
    backgroundColor: '#141414',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#262626',
  },
  emptyText: {
    color: '#525252',
    fontSize: 14,
  },
  chatHint: {
    backgroundColor: '#1c1c1c',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#262626',
    padding: 16,
    marginTop: 8,
  },
  chatHintText: {
    color: '#a3a3a3',
    fontSize: 13,
    lineHeight: 20,
  },
});
