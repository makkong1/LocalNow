import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { useOpenRequests } from '../hooks/useRequests';
import { useAcceptRequest, useStartService } from '../hooks/useMatches';
import { useChatRoom } from '../hooks/useChat';
import { useSetDuty, useGuideActiveOffer } from '../hooks/useGuide';
import OnDutyToggle from '../components/OnDutyToggle';
import RequestCard from '../components/RequestCard';
import StatusBadge from '../components/StatusBadge';
import type { GuideActiveOfferResponse } from '../types/api';
import type { AppStackParamList } from '../navigation/AppNavigator';

function OnDutyOffView({
  onToggle,
  isLoading,
}: {
  onToggle: (onDuty: boolean, location?: { lat: number; lng: number }) => void;
  isLoading: boolean;
}) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <OnDutyToggle isOnDuty={false} onToggle={onToggle} isLoading={isLoading} />
    </ScrollView>
  );
}

function OpenRequestsView({
  onToggle,
  isTogglerLoading,
}: {
  onToggle: (onDuty: boolean, location?: { lat: number; lng: number }) => void;
  isTogglerLoading: boolean;
}) {
  const [acceptingId, setAcceptingId] = useState<number | null>(null);
  const acceptRequest = useAcceptRequest();
  const { data: requestsPage, isLoading } = useOpenRequests({
    enabled: true,
    refetchInterval: 10000,
  });
  const openRequests = requestsPage?.items ?? [];

  function handleAccept(requestId: number) {
    setAcceptingId(requestId);
    acceptRequest.mutate(
      { requestId },
      {
        onSuccess: () => {
          Alert.alert('수락 완료', '여행자가 확정하면 알림이 옵니다.');
          setAcceptingId(null);
        },
        onError: () => setAcceptingId(null),
      },
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <OnDutyToggle isOnDuty={true} onToggle={onToggle} isLoading={isTogglerLoading} />
      <Text style={styles.sectionLabel}>주변 도움 요청</Text>
      {isLoading ? (
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
            isAccepted={false}
          />
        ))
      )}
    </ScrollView>
  );
}

function AcceptedView({ offer }: { offer: GuideActiveOfferResponse }) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <View style={styles.cardRow}>
          <Text style={styles.cardTitle}>{offer.requestType}</Text>
          <StatusBadge status="OPEN" />
        </View>
        <Text style={styles.cardDesc}>{offer.description}</Text>
        <Text style={styles.cardMeta}>
          {offer.budgetKrw.toLocaleString()}원 · {offer.durationMin}분
        </Text>
      </View>
      <View style={styles.hintBox}>
        <Text style={styles.hintText}>수락 완료. 여행자가 확정하면 알림이 옵니다.</Text>
      </View>
    </ScrollView>
  );
}

function MatchedView({ offer }: { offer: GuideActiveOfferResponse }) {
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const { data: room } = useChatRoom(offer.requestId);
  const startService = useStartService();

  function goToChat() {
    if (room) navigation.navigate('ChatRoom', { roomId: room.id, requestId: offer.requestId });
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <View style={styles.cardRow}>
          <Text style={styles.cardTitle}>{offer.requestType}</Text>
          <StatusBadge status="MATCHED" />
        </View>
        <Text style={styles.cardDesc}>{offer.description}</Text>
        <Text style={styles.cardMeta}>
          {offer.budgetKrw.toLocaleString()}원 · {offer.durationMin}분
        </Text>
      </View>
      <Text style={styles.sectionLabel}>다음 단계</Text>
      <TouchableOpacity
        testID="guide-go-to-chat-button"
        style={styles.secondaryButton}
        onPress={goToChat}
        disabled={!room}
      >
        <Text style={styles.secondaryButtonText}>
          {room ? '채팅하기' : '채팅방 생성 중...'}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        testID="start-service-button"
        style={[styles.primaryButton, startService.isPending && styles.primaryButtonDisabled]}
        onPress={() => startService.mutate({ requestId: offer.requestId })}
        disabled={startService.isPending}
      >
        <Text style={styles.primaryButtonText}>
          {startService.isPending ? '처리 중...' : '서비스 시작'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function InProgressView({ offer }: { offer: GuideActiveOfferResponse }) {
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const { data: room } = useChatRoom(offer.requestId);

  function goToChat() {
    if (room) navigation.navigate('ChatRoom', { roomId: room.id, requestId: offer.requestId });
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <View style={styles.cardRow}>
          <Text style={styles.cardTitle}>{offer.requestType}</Text>
          <StatusBadge status="IN_PROGRESS" />
        </View>
        <Text style={styles.cardDesc}>{offer.description}</Text>
        <Text style={styles.cardMeta}>
          {offer.budgetKrw.toLocaleString()}원 · {offer.durationMin}분
        </Text>
      </View>
      <TouchableOpacity
        testID="guide-go-to-chat-button"
        style={[styles.primaryButton, !room && styles.primaryButtonDisabled]}
        onPress={goToChat}
        disabled={!room}
      >
        <Text style={styles.primaryButtonText}>
          {room ? '채팅하기' : '채팅방 생성 중...'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

export default function GuideScreen() {
  const [isOnDuty, setIsOnDuty] = useState(false);
  const setDuty = useSetDuty();
  const { data: activeOffer, isLoading: offerLoading } = useGuideActiveOffer();

  async function handleToggle(onDuty: boolean, location?: { lat: number; lng: number }) {
    await setDuty.mutateAsync({ onDuty, lat: location?.lat, lng: location?.lng });
    setIsOnDuty(onDuty);
  }

  if (!isOnDuty) {
    return <OnDutyOffView onToggle={handleToggle} isLoading={setDuty.isPending} />;
  }

  if (offerLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#f59e0b" size="large" />
      </View>
    );
  }

  if (!activeOffer) {
    return <OpenRequestsView onToggle={handleToggle} isTogglerLoading={setDuty.isPending} />;
  }

  if (activeOffer.offerStatus === 'PENDING') {
    return <AcceptedView offer={activeOffer} />;
  }

  if (activeOffer.offerStatus === 'CONFIRMED' && activeOffer.requestStatus === 'MATCHED') {
    return <MatchedView offer={activeOffer} />;
  }

  if (activeOffer.offerStatus === 'CONFIRMED' && activeOffer.requestStatus === 'IN_PROGRESS') {
    return <InProgressView offer={activeOffer} />;
  }

  return <OpenRequestsView onToggle={handleToggle} isTogglerLoading={setDuty.isPending} />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0a' },
  sectionLabel: {
    color: '#a3a3a3',
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  loader: { marginVertical: 24 },
  emptyBox: {
    padding: 32,
    alignItems: 'center',
    backgroundColor: '#141414',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#262626',
  },
  emptyText: { color: '#525252', fontSize: 14 },
  card: {
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#262626',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: { color: '#fff', fontSize: 15, fontWeight: '600' },
  cardDesc: { color: '#d4d4d4', fontSize: 13, lineHeight: 20, marginBottom: 8 },
  cardMeta: { color: '#525252', fontSize: 11 },
  hintBox: {
    backgroundColor: '#1c1c1c',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#262626',
    padding: 16,
  },
  hintText: { color: '#a3a3a3', fontSize: 13, lineHeight: 20 },
  primaryButton: {
    backgroundColor: '#f59e0b',
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonDisabled: { backgroundColor: '#404040' },
  primaryButtonText: { color: '#000', fontWeight: '600', fontSize: 15 },
  secondaryButton: {
    backgroundColor: '#1c1c1c',
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#262626',
  },
  secondaryButtonText: { color: '#fff', fontSize: 15 },
});
