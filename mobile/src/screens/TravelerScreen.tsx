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
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  return (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        <Text style={styles.cardTitle}>{request.requestType}</Text>
        <StatusBadge status={request.status} />
      </View>
      <Text style={styles.cardDesc}>{request.description}</Text>
      <Text style={styles.cardMeta}>
        {t('traveler.budgetLabel')} {request.budgetKrw.toLocaleString()}{t('common.won')} · {request.durationMin}{t('common.min')}
      </Text>
    </View>
  );
}

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

function OpenView({ request }: { request: HelpRequestResponse }) {
  const { t } = useTranslation();
  const { data: offers } = useOffers(request.id);
  const confirmGuide = useConfirmGuide();
  const pendingOffers = offers?.filter((o) => o.status === 'PENDING') ?? [];

  function handleConfirm(guideId: number, guideName: string) {
    Alert.alert(
      t('traveler.confirmGuideTitle'),
      `${guideName} ${t('traveler.confirmGuideMsg')}`,
      [
        { text: t('traveler.confirmNo'), style: 'cancel' },
        {
          text: t('traveler.confirmYes'),
          onPress: () =>
            confirmGuide.mutate(
              { requestId: request.id, guideId },
              { onSuccess: () => Alert.alert(t('traveler.confirmedTitle'), t('traveler.confirmedMsg')) },
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
          <Text style={styles.emptyText}>{t('traveler.waitingOffers')}</Text>
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

function paymentCta(
  intent: PaymentIntentResponse | null | undefined,
  t: (key: string) => string,
) {
  if (intent == null) {
    return { label: t('payment.cta'), disabled: false };
  }
  switch (intent.status) {
    case 'CAPTURED':
      return { label: t('payment.paid'), disabled: true };
    case 'AUTHORIZED':
      return { label: t('payment.authorized'), disabled: false };
    case 'REFUNDED':
      return { label: t('payment.refunded'), disabled: true };
    case 'FAILED':
      return { label: t('payment.failed'), disabled: false };
    default:
      return { label: t('payment.cta'), disabled: false };
  }
}

function MatchedView({ request }: { request: HelpRequestResponse }) {
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const { data: room } = useChatRoom(request.id);
  const { data: offers } = useOffers(request.id);
  const { data: intent } = usePaymentIntent(request.id);

  const guideId =
    room?.guideId ?? offers?.find((o) => o.status === 'CONFIRMED')?.guideId ?? undefined;

  const pay = paymentCta(intent, t);

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
          <Text style={styles.profileLinkText}>{t('traveler.viewGuideProfile')}</Text>
        </TouchableOpacity>
      )}
      <Text style={styles.sectionLabel}>{t('guide.nextStep')}</Text>
      <TouchableOpacity
        testID="go-to-chat-button"
        style={styles.secondaryButton}
        onPress={goToChat}
        disabled={!room}
      >
        <Text style={styles.secondaryButtonText}>
          {room ? t('traveler.goToChat') : t('traveler.creatingChatRoom')}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        testID="go-to-payment-button"
        style={[styles.primaryButton, pay.disabled && styles.primaryButtonDisabled]}
        onPress={goToPayment}
        disabled={pay.disabled || guideId == null}
      >
        <Text style={styles.primaryButtonText}>
          {guideId == null ? t('traveler.loadingGuideInfo') : pay.label}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function CompletedView({ request }: { request: HelpRequestResponse }) {
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const { data: room } = useChatRoom(request.id);
  const { data: offers } = useOffers(request.id);
  const guideId =
    room?.guideId ?? offers?.find((o) => o.status === 'CONFIRMED')?.guideId ?? undefined;

  return (
    <ScrollView style={styles.scrollContainer}>
      <TravelerRequestCard request={request} />
      <Text style={styles.sectionLabel}>{t('traveler.serviceCompleted')}</Text>
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
        <Text style={styles.primaryButtonText}>{t('traveler.writeReview')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

export default function TravelerScreen() {
  const { t } = useTranslation();
  const [showForm, setShowForm] = useState(false);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      if (status !== 'granted') {
        Alert.alert(t('traveler.locationPermTitle'), t('traveler.locationPermMsg'));
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
            <Text style={styles.primaryButtonText}>{t('traveler.createRequest')}</Text>
          </TouchableOpacity>
        </View>
        <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet">
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('traveler.createRequestTitle')}</Text>
              <TouchableOpacity testID="close-form-button" onPress={() => setShowForm(false)}>
                <Text style={styles.closeText}>{t('common.close')}</Text>
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

  if (activeRequest.status === 'OPEN') {
    return <OpenView request={activeRequest} />;
  }

  if (activeRequest.status === 'MATCHED' || activeRequest.status === 'IN_PROGRESS') {
    return <MatchedView request={activeRequest} />;
  }

  if (activeRequest.status === 'COMPLETED') {
    return <CompletedView request={activeRequest} />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.center}>
        <Text style={styles.emptyText}>{t('traveler.cancelled')}</Text>
        <TouchableOpacity
          testID="new-request-button"
          style={[styles.primaryButton, { marginTop: 16 }]}
          onPress={() => setShowForm(true)}
        >
          <Text style={styles.primaryButtonText}>{t('traveler.newRequest')}</Text>
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
