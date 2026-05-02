import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useNavigation, type NavigationProp } from "@react-navigation/native";
import * as Location from "expo-location";
import { useOpenRequests } from "../hooks/useRequests";
import { useAcceptRequest, useStartService } from "../hooks/useMatches";
import { useChatRoom } from "../hooks/useChat";
import { useAuth } from "../hooks/useAuth";
import { useSetDuty, useGuideActiveOffer, useGuideBaseLocation } from "../hooks/useGuide";
import OnDutyToggle from "../components/OnDutyToggle";
import RequestCard from "../components/RequestCard";
import StatusBadge from "../components/StatusBadge";
import type { GuideActiveOfferResponse, RequestType } from "../types/api";
import type { AppStackParamList } from "../navigation/AppNavigator";

function OnDutyOffView({
  onToggle,
  isLoading,
}: {
  onToggle: (onDuty: boolean, location?: { lat: number; lng: number }) => void;
  isLoading: boolean;
}) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <OnDutyToggle
        isOnDuty={false}
        onToggle={onToggle}
        isLoading={isLoading}
      />
    </ScrollView>
  );
}

type SortOption = 'budgetAsc' | 'budgetDesc' | null;

function nextSort(current: SortOption): SortOption {
  if (current === null) return 'budgetAsc';
  if (current === 'budgetAsc') return 'budgetDesc';
  return null;
}

function OpenRequestsView({
  onToggle,
  isTogglerLoading,
}: {
  onToggle: (onDuty: boolean, location?: { lat: number; lng: number }) => void;
  isTogglerLoading: boolean;
}) {
  const { t } = useTranslation();
  const [acceptingId, setAcceptingId] = useState<number | null>(null);
  const [selectedType, setSelectedType] = useState<RequestType | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>(null);
  const [gpsLoc, setGpsLoc] = useState<{ lat: number; lng: number } | null>(null);
  const acceptRequest = useAcceptRequest();
  const { data: baseLoc } = useGuideBaseLocation();

  const FILTER_CHIPS: { label: string; value: RequestType | null }[] = [
    { label: t('guide.filterAll'), value: null },
    { label: t('requestType.GUIDE'), value: 'GUIDE' },
    { label: t('requestType.TRANSLATION'), value: 'TRANSLATION' },
    { label: t('requestType.FOOD'), value: 'FOOD' },
    { label: t('requestType.EMERGENCY'), value: 'EMERGENCY' },
  ];

  function sortLabel(s: SortOption): string {
    if (s === 'budgetAsc') return t('guide.sortPriceAsc');
    if (s === 'budgetDesc') return t('guide.sortPriceDesc');
    return t('guide.sortDefault');
  }

  useEffect(() => {
    if (baseLoc) return;
    Location.requestForegroundPermissionsAsync().then(({ status }) => {
      if (status !== "granted") return;
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      }).then((pos) => {
        setGpsLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      });
    });
  }, [baseLoc]);

  const searchLoc = baseLoc ?? gpsLoc ?? null;

  const { data: requestsPage, isLoading } = useOpenRequests({
    enabled: true,
    refetchInterval: 10000,
    requestType: selectedType,
    sortBy,
    lat: searchLoc?.lat,
    lng: searchLoc?.lng,
    radiusKm: 5.0,
  });
  const openRequests = requestsPage?.items ?? [];

  function handleAccept(requestId: number) {
    setAcceptingId(requestId);
    acceptRequest.mutate(
      { requestId },
      {
        onSuccess: () => {
          Alert.alert(t('guide.acceptConfirmTitle'), t('guide.acceptConfirmMsg'));
          setAcceptingId(null);
        },
        onError: () => setAcceptingId(null),
      }
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <OnDutyToggle
        isOnDuty={true}
        onToggle={onToggle}
        isLoading={isTogglerLoading}
      />
      <View style={styles.filterRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipList}
          style={styles.chipScroll}
        >
          {FILTER_CHIPS.map((chip) => {
            const active = selectedType === chip.value;
            return (
              <TouchableOpacity
                key={chip.label}
                testID={`filter-chip-${chip.label}`}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setSelectedType(chip.value)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {chip.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <TouchableOpacity
          testID="sort-toggle"
          style={styles.sortButton}
          onPress={() => setSortBy(nextSort(sortBy))}
        >
          <Text style={styles.sortButtonText}>{sortLabel(sortBy)}</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.sectionLabel}>{t('guide.nearbyRequests')}</Text>
      {isLoading ? (
        <ActivityIndicator color="#f59e0b" style={styles.loader} />
      ) : openRequests.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>{t('guide.noRequests')}</Text>
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
  const { t } = useTranslation();
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <View style={styles.cardRow}>
          <Text style={styles.cardTitle}>{offer.requestType}</Text>
          <StatusBadge status="OPEN" />
        </View>
        <Text style={styles.cardDesc}>{offer.description}</Text>
        <Text style={styles.cardMeta}>
          {offer.budgetKrw.toLocaleString()}{t('common.won')} · {offer.durationMin}{t('common.min')}
        </Text>
      </View>
      <View style={styles.hintBox}>
        <Text style={styles.hintText}>
          {t('guide.acceptDone')}. {t('guide.acceptConfirmMsg')}
        </Text>
      </View>
    </ScrollView>
  );
}

function MatchedView({ offer }: { offer: GuideActiveOfferResponse }) {
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const { data: room } = useChatRoom(offer.requestId);
  const startService = useStartService();

  function goToChat() {
    if (room)
      navigation.navigate("ChatRoom", {
        roomId: room.id,
        requestId: offer.requestId,
      });
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
          {offer.budgetKrw.toLocaleString()}{t('common.won')} · {offer.durationMin}{t('common.min')}
        </Text>
      </View>
      <Text style={styles.sectionLabel}>{t('guide.nextStep')}</Text>
      <TouchableOpacity
        testID="guide-go-to-chat-button"
        style={styles.secondaryButton}
        onPress={goToChat}
        disabled={!room}
      >
        <Text style={styles.secondaryButtonText}>
          {room ? t('guide.goToChat') : t('guide.creatingChatRoom')}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        testID="start-service-button"
        style={[
          styles.primaryButton,
          startService.isPending && styles.primaryButtonDisabled,
        ]}
        onPress={() => startService.mutate({ requestId: offer.requestId })}
        disabled={startService.isPending}
      >
        <Text style={styles.primaryButtonText}>
          {startService.isPending ? t('common.processing') : t('guide.startService')}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function InProgressView({ offer }: { offer: GuideActiveOfferResponse }) {
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const { data: room } = useChatRoom(offer.requestId);

  function goToChat() {
    if (room)
      navigation.navigate("ChatRoom", {
        roomId: room.id,
        requestId: offer.requestId,
      });
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
          {offer.budgetKrw.toLocaleString()}{t('common.won')} · {offer.durationMin}{t('common.min')}
        </Text>
      </View>
      <TouchableOpacity
        testID="guide-go-to-chat-button"
        style={[styles.primaryButton, !room && styles.primaryButtonDisabled]}
        onPress={goToChat}
        disabled={!room}
      >
        <Text style={styles.primaryButtonText}>
          {room ? t('guide.goToChat') : t('guide.creatingChatRoom')}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function GuideRoleRequiredView() {
  const { t } = useTranslation();
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.roleTitle}>{t('guide.roleRequiredTitle')}</Text>
      <Text style={styles.roleBody}>{t('guide.roleRequiredBody')}</Text>
    </ScrollView>
  );
}

export default function GuideScreen() {
  const { t } = useTranslation();
  const { role } = useAuth();
  const [isOnDuty, setIsOnDuty] = useState(false);
  const setDuty = useSetDuty();
  const { data: activeOffer, isLoading: offerLoading } = useGuideActiveOffer({
    enabled: role === "GUIDE",
  });

  async function handleToggle(
    onDuty: boolean,
    location?: { lat: number; lng: number }
  ) {
    try {
      await setDuty.mutateAsync({
        onDuty,
        lat: location?.lat,
        lng: location?.lng,
      });
      setIsOnDuty(onDuty);
    } catch (e: unknown) {
      const msg =
        e &&
        typeof e === "object" &&
        "message" in e &&
        typeof (e as { message: unknown }).message === "string"
          ? (e as { message: string }).message
          : t('guide.dutyToggleError');
      const code =
        e && typeof e === "object" && "code" in e
          ? String((e as { code: unknown }).code)
          : "";
      const hint =
        code === "AUTH_FORBIDDEN"
          ? t('guide.notGuideHint')
          : msg;
      Alert.alert(t('guide.dutyAlertTitle'), hint);
    }
  }

  if (role !== "GUIDE") {
    return <GuideRoleRequiredView />;
  }

  if (!isOnDuty) {
    return (
      <OnDutyOffView onToggle={handleToggle} isLoading={setDuty.isPending} />
    );
  }

  if (offerLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#f59e0b" size="large" />
      </View>
    );
  }

  if (!activeOffer) {
    return (
      <OpenRequestsView
        onToggle={handleToggle}
        isTogglerLoading={setDuty.isPending}
      />
    );
  }

  if (activeOffer.offerStatus === "PENDING") {
    return <AcceptedView offer={activeOffer} />;
  }

  if (
    activeOffer.offerStatus === "CONFIRMED" &&
    activeOffer.requestStatus === "MATCHED"
  ) {
    return <MatchedView offer={activeOffer} />;
  }

  if (
    activeOffer.offerStatus === "CONFIRMED" &&
    activeOffer.requestStatus === "IN_PROGRESS"
  ) {
    return <InProgressView offer={activeOffer} />;
  }

  return (
    <OpenRequestsView
      onToggle={handleToggle}
      isTogglerLoading={setDuty.isPending}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a" },
  content: { padding: 16 },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0a0a0a",
  },
  sectionLabel: {
    color: "#a3a3a3",
    fontSize: 11,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  chipScroll: {
    flex: 1,
  },
  chipList: {
    gap: 8,
    paddingRight: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#1c1c1c",
    borderWidth: 1,
    borderColor: "#262626",
  },
  chipActive: {
    backgroundColor: "#f59e0b",
    borderColor: "#f59e0b",
  },
  chipText: {
    color: "#a3a3a3",
    fontSize: 13,
    fontWeight: "500",
  },
  chipTextActive: {
    color: "#000",
  },
  sortButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#1c1c1c",
    borderWidth: 1,
    borderColor: "#262626",
    marginLeft: 8,
  },
  sortButtonText: {
    color: "#a3a3a3",
    fontSize: 13,
    fontWeight: "500",
  },
  loader: { marginVertical: 24 },
  emptyBox: {
    padding: 32,
    alignItems: "center",
    backgroundColor: "#141414",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#262626",
  },
  emptyText: { color: "#525252", fontSize: 14 },
  card: {
    backgroundColor: "#141414",
    borderWidth: 1,
    borderColor: "#262626",
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  cardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  cardTitle: { color: "#fff", fontSize: 15, fontWeight: "600" },
  cardDesc: { color: "#d4d4d4", fontSize: 13, lineHeight: 20, marginBottom: 8 },
  cardMeta: { color: "#525252", fontSize: 11 },
  hintBox: {
    backgroundColor: "#1c1c1c",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#262626",
    padding: 16,
  },
  hintText: { color: "#a3a3a3", fontSize: 13, lineHeight: 20 },
  primaryButton: {
    backgroundColor: "#f59e0b",
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 12,
  },
  primaryButtonDisabled: { backgroundColor: "#404040" },
  primaryButtonText: { color: "#000", fontWeight: "600", fontSize: 15 },
  secondaryButton: {
    backgroundColor: "#1c1c1c",
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#262626",
  },
  secondaryButtonText: { color: "#fff", fontSize: 15 },
  roleTitle: {
    color: "#f59e0b",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
  },
  roleBody: { color: "#a3a3a3", fontSize: 14, lineHeight: 22 },
});
