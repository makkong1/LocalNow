import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { useMyRequests, useCreateRequest } from '../hooks/useRequests';
import { useOffers, useConfirmGuide } from '../hooks/useMatches';
import { usePublicProfile } from '../hooks/usePublicProfile';
import { useChatRoom } from '../hooks/useChat';
import { usePaymentIntent } from '../hooks/usePayment';
import type { PaymentIntentResponse } from '../types/api';
import * as Location from 'expo-location';
import LocationMap from '../components/LocationMap';
import RequestForm from '../components/RequestForm';
import GuideOfferCard from '../components/GuideOfferCard';
import StatusBadge from '../components/StatusBadge';
import type { CreateRequestBody, HelpRequestResponse } from '../types/api';
import type { AppStackParamList } from '../navigation/AppNavigator';

/** 권한 거부 등으로 GPS를 못 쓸 때만 지도 초기 중심용 */
const FALLBACK_LAT = 37.5665;
const FALLBACK_LNG = 126.978;

function getActiveRequest(items: HelpRequestResponse[]): HelpRequestResponse | null {
  return (
    items.find(
      (r) =>
        r.status === 'OPEN' ||
        r.status === 'MATCHED' ||
        r.status === 'IN_PROGRESS' ||
        r.status === 'COMPLETED',
    ) ?? null
  );
}

function TravelerRequestCard({ request }: { request: HelpRequestResponse }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        <Text style={styles.cardTitle}>{request.requestType}</Text>
        <StatusBadge status={request.status} />
      </View>
      <Text style={styles.cardDesc}>{request.description}</Text>
      <Text style={styles.cardMeta}>
        예산 {request.budgetKrw.toLocaleString()}원 · {request.durationMin}분
      </Text>
    </View>
  );
}

// 오퍼 카드 래퍼 — 공개 프로필 조회 후 자격증 여부 전달 (로딩 중엔 false)
function OfferCardItem({
  offer,
  onConfirm,
  isConfirming,
}: {
  offer: import('../types/api').MatchOfferResponse;
  onConfirm: (guideId: number) => void;
  isConfirming: boolean;
}) {
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const { data: profile } = usePublicProfile(offer.guideId);
  const hasCertification = (profile?.certifications?.length ?? 0) > 0;

  return (
    <GuideOfferCard
      offer={offer}
      hasCertification={hasCertification}
      onConfirm={onConfirm}
      onPressProfile={() => navigation.navigate('GuideProfile', { userId: offer.guideId })}
      isConfirming={isConfirming}
    />
  );
}

// Sub-component: OPEN 상태 (오퍼 목록)
function OpenView({ request }: { request: HelpRequestResponse }) {
  const { data: offers } = useOffers(request.id);
  const confirmGuide = useConfirmGuide();
  const pendingOffers = offers?.filter((o) => o.status === 'PENDING') ?? [];

  function handleConfirm(guideId: number, guideName: string) {
    Alert.alert(
      '가이드를 선택하시겠습니까?',
      `${guideName} 가이드로 매칭을 확정합니다.`,
      [
        { text: '아니오', style: 'cancel' },
        {
          text: '예, 확정합니다',
          onPress: () =>
            confirmGuide.mutate(
              { requestId: request.id, guideId },
              { onSuccess: () => Alert.alert('확정 완료', '가이드가 확정되었습니다.') },
            ),
        },
      ],
    );
  }

  return (
    <ScrollView style={styles.scrollContainer}>
      <TravelerRequestCard request={request} />
      {pendingOffers.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>가이드 오퍼를 기다리는 중...</Text>
        </View>
      ) : (
        pendingOffers.map((offer) => (
          <OfferCardItem
            key={offer.id}
            offer={offer}
            onConfirm={(guideId) => handleConfirm(guideId, offer.guideName)}
            isConfirming={confirmGuide.isPending}
          />
        ))
      )}
    </ScrollView>
  );
}

function paymentCta(intent: PaymentIntentResponse | null | undefined) {
  if (intent == null) {
    return { label: '결제하기', disabled: false };
  }
  switch (intent.status) {
    case 'CAPTURED':
      return { label: '결제 완료 ✓', disabled: true };
    case 'AUTHORIZED':
      return { label: '결제 대기중', disabled: false };
    case 'REFUNDED':
      return { label: '환불됨', disabled: true };
    case 'FAILED':
      return { label: '결제 실패 — 다시 시도', disabled: false };
    default:
      return { label: '결제하기', disabled: false };
  }
}

// Sub-component: MATCHED / IN_PROGRESS 상태 (채팅 + 결제)
function MatchedView({ request }: { request: HelpRequestResponse }) {
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const { data: room } = useChatRoom(request.id);
  const { data: offers } = useOffers(request.id);
  const { data: intent } = usePaymentIntent(request.id);

  const guideId =
    room?.guideId ?? offers?.find((o) => o.status === 'CONFIRMED')?.guideId ?? undefined;

  const pay = paymentCta(intent);

  function goToChat() {
    if (room) {
      navigation.navigate('ChatRoom', { roomId: room.id, requestId: request.id });
    }
  }

  function goToPayment() {
    if (guideId == null) return;
    if (pay.disabled) return;
    navigation.navigate('Payment', { requestId: request.id, guideId });
  }

  return (
    <ScrollView style={styles.scrollContainer}>
      <TravelerRequestCard request={request} />
      {guideId != null && (
        <TouchableOpacity
          testID="guide-profile-button"
          onPress={() => navigation.navigate('GuideProfile', { userId: guideId })}
          style={styles.profileLinkRow}
        >
          <Text style={styles.profileLinkText}>가이드 프로필 보기 →</Text>
        </TouchableOpacity>
      )}
      <Text style={styles.sectionLabel}>다음 단계</Text>
      <TouchableOpacity
        testID="go-to-chat-button"
        style={styles.secondaryButton}
        onPress={goToChat}
        disabled={!room}
      >
        <Text style={styles.secondaryButtonText}>
          {room ? '채팅하기' : '채팅방 생성 중...'}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        testID="go-to-payment-button"
        style={[styles.primaryButton, pay.disabled && styles.primaryButtonDisabled]}
        onPress={goToPayment}
        disabled={pay.disabled || guideId == null}
      >
        <Text style={styles.primaryButtonText}>
          {guideId == null ? '가이드 정보를 불러오는 중...' : pay.label}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// COMPLETED: 리뷰 (guideId — 채팅방 또는 확정 오퍼)
function CompletedView({ request }: { request: HelpRequestResponse }) {
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const { data: room } = useChatRoom(request.id);
  const { data: offers } = useOffers(request.id);
  const guideId =
    room?.guideId ?? offers?.find((o) => o.status === 'CONFIRMED')?.guideId ?? undefined;

  return (
    <ScrollView style={styles.scrollContainer}>
      <TravelerRequestCard request={request} />
      <Text style={styles.sectionLabel}>서비스가 완료되었습니다</Text>
      <TouchableOpacity
        testID="go-to-review-button"
        style={[styles.primaryButton, guideId == null && styles.primaryButtonDisabled]}
        onPress={() => {
          if (guideId != null) {
            navigation.navigate('Review', { requestId: request.id, guideId });
          }
        }}
        disabled={guideId == null}
      >
        <Text style={styles.primaryButtonText}>리뷰 작성하기</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

export default function TravelerScreen() {
  const [showForm, setShowForm] = useState(false);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      if (status !== 'granted') {
        Alert.alert(
          '위치 권한',
          '현재 위치를 쓸 수 없습니다. 지도에서 탭하여 요청 위치를 선택할 수 있습니다.',
        );
        setLat(FALLBACK_LAT);
        setLng(FALLBACK_LNG);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      if (!cancelled) {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const { data: requestsPage, isLoading } = useMyRequests();
  const createRequest = useCreateRequest();

  const activeRequest = requestsPage ? getActiveRequest(requestsPage.items) : null;

  async function handleCreateRequest(body: CreateRequestBody) {
    await createRequest.mutateAsync(body);
    setShowForm(false);
  }

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#f59e0b" size="large" />
      </View>
    );
  }

  // 활성 요청 없음 → 지도 + 요청 생성
  if (!activeRequest) {
    if (lat == null || lng == null) {
      return (
        <View style={styles.center}>
          <ActivityIndicator color="#f59e0b" size="large" />
        </View>
      );
    }
    return (
      <View style={styles.container}>
        <View style={styles.mapContainer}>
          <LocationMap
            lat={lat}
            lng={lng}
            onLocationChange={(newLat, newLng) => {
              setLat(newLat);
              setLng(newLng);
            }}
          />
        </View>
        <View style={styles.bottomPanel}>
          <TouchableOpacity
            testID="create-request-button"
            style={styles.primaryButton}
            onPress={() => setShowForm(true)}
          >
            <Text style={styles.primaryButtonText}>도움 요청하기</Text>
          </TouchableOpacity>
        </View>
        <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet">
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>도움 요청 생성</Text>
              <TouchableOpacity testID="close-form-button" onPress={() => setShowForm(false)}>
                <Text style={styles.closeText}>닫기</Text>
              </TouchableOpacity>
            </View>
            <RequestForm
              initialLat={lat}
              initialLng={lng}
              onSubmit={handleCreateRequest}
              isLoading={createRequest.isPending}
            />
          </View>
        </Modal>
      </View>
    );
  }

  // OPEN → 오퍼 목록
  if (activeRequest.status === 'OPEN') {
    return <OpenView request={activeRequest} />;
  }

  // MATCHED / IN_PROGRESS → 채팅 + 결제 이동
  if (activeRequest.status === 'MATCHED' || activeRequest.status === 'IN_PROGRESS') {
    return <MatchedView request={activeRequest} />;
  }

  // COMPLETED → 리뷰
  if (activeRequest.status === 'COMPLETED') {
    return <CompletedView request={activeRequest} />;
  }

  // CANCELLED 또는 기타
  return (
    <View style={styles.container}>
      <View style={styles.center}>
        <Text style={styles.emptyText}>취소된 요청입니다.</Text>
        <TouchableOpacity
          testID="new-request-button"
          style={[styles.primaryButton, { marginTop: 16 }]}
          onPress={() => setShowForm(true)}
        >
          <Text style={styles.primaryButtonText}>새 요청하기</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  scrollContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    padding: 16,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
  },
  mapContainer: {
    flex: 1,
    margin: 16,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#262626',
  },
  bottomPanel: {
    padding: 16,
    paddingBottom: 24,
  },
  primaryButton: {
    backgroundColor: '#f59e0b',
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    backgroundColor: '#404040',
  },
  primaryButtonText: {
    color: '#000',
    fontWeight: '600',
    fontSize: 15,
  },
  secondaryButton: {
    backgroundColor: '#1c1c1c',
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#262626',
  },
  secondaryButtonText: {
    color: '#fff',
    fontSize: 15,
  },
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
  cardTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  cardDesc: {
    color: '#d4d4d4',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 8,
  },
  cardMeta: {
    color: '#525252',
    fontSize: 11,
  },
  emptyBox: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    color: '#525252',
    fontSize: 14,
  },
  sectionLabel: {
    color: '#a3a3a3',
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
    marginTop: 4,
  },
  profileLinkRow: {
    paddingVertical: 10,
    marginBottom: 12,
  },
  profileLinkText: {
    color: '#f59e0b',
    fontSize: 14,
    fontWeight: '500',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#262626',
    backgroundColor: '#141414',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  closeText: {
    color: '#a3a3a3',
    fontSize: 14,
  },
});
