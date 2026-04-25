import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { useOpenRequests } from '../hooks/useRequests';
import { useAcceptRequest } from '../hooks/useMatches';
import { useChatRoom } from '../hooks/useChat';
import { useSetDuty } from '../hooks/useGuide';
import { useAuth } from '../hooks/useAuth';
import { stompClient } from '../lib/stomp-client';
import OnDutyToggle from '../components/OnDutyToggle';
import RequestCard from '../components/RequestCard';
import type { StompEvent } from '../types/api';
import type { AppStackParamList } from '../navigation/AppNavigator';

// Sub-component: 확정된 요청의 채팅 버튼
function ConfirmedChatButton({ requestId }: { requestId: number }) {
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const { data: room } = useChatRoom(requestId);

  if (!room) return null;

  return (
    <TouchableOpacity
      testID="guide-go-to-chat-button"
      style={styles.chatButton}
      onPress={() => navigation.navigate('ChatRoom', { roomId: room.id, requestId })}
    >
      <Text style={styles.chatButtonText}>채팅 시작하기</Text>
    </TouchableOpacity>
  );
}

export default function GuideScreen() {
  const { userId } = useAuth();
  const [isOnDuty, setIsOnDuty] = useState(false);
  const [acceptedIds, setAcceptedIds] = useState<Set<number>>(new Set());
  const [acceptingId, setAcceptingId] = useState<number | null>(null);
  const [confirmedRequestId, setConfirmedRequestId] = useState<number | null>(null);

  // Subscribe to MATCH_CONFIRMED on the guide topic (shares the singleton STOMP connection)
  useEffect(() => {
    if (!userId) return;
    const sub = stompClient.subscribe(`/topic/guides/${userId}`, (body) => {
      try {
        const event = JSON.parse(body) as StompEvent;
        if (event.type === 'MATCH_CONFIRMED') {
          setConfirmedRequestId(event.requestId);
        }
      } catch {
        // ignore malformed frames
      }
    });
    return () => sub.unsubscribe();
  }, [userId]);

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

          {confirmedRequestId != null && (
            <View style={styles.chatHint}>
              <Text style={styles.chatHintText}>요청이 확정되었습니다. 채팅을 시작하세요.</Text>
              <ConfirmedChatButton requestId={confirmedRequestId} />
            </View>
          )}

          {hasAccepted && confirmedRequestId == null && (
            <View style={styles.chatHint}>
              <Text style={styles.chatHintText}>
                수락한 요청이 확정되면 채팅이 열립니다.
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
    gap: 12,
  },
  chatHintText: {
    color: '#a3a3a3',
    fontSize: 13,
    lineHeight: 20,
  },
  chatButton: {
    backgroundColor: '#f59e0b',
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: 'center',
  },
  chatButtonText: {
    color: '#000',
    fontWeight: '600',
    fontSize: 14,
  },
});
