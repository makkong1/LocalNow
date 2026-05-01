import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import type { AppStackParamList } from '../navigation/AppNavigator';
import { usePaymentIntent, useCreatePaymentIntent, useCapturePayment } from '../hooks/usePayment';
import { useMyRequests } from '../hooks/useRequests';

type PaymentScreenProps = StackScreenProps<AppStackParamList, 'Payment'>;

export default function PaymentScreen({ route, navigation }: PaymentScreenProps) {
  const { requestId, guideId } = route.params;
  const { data: intent, isLoading } = usePaymentIntent(requestId);
  const { data: requestsPage } = useMyRequests();
  const createIntent = useCreatePaymentIntent();
  const capturePayment = useCapturePayment();

  const request = requestsPage?.items.find((r) => r.id === requestId);
  const isEmergency = request?.requestType === 'EMERGENCY';

  useEffect(() => {
    if (!isLoading && intent === null) {
      createIntent.mutate({ requestId });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, intent, requestId]);

  const currentIntent = intent ?? createIntent.data;
  const isCaptured = currentIntent?.status === 'CAPTURED';
  const isRefunded = currentIntent?.status === 'REFUNDED';
  const isFailed = currentIntent?.status === 'FAILED';
  const isServiceStarted = request?.status === 'IN_PROGRESS';

  function handleCapture() {
    capturePayment.mutate(
      { requestId },
      {
        onSuccess: () => navigation.navigate('Review', { requestId, guideId }),
      },
    );
  }

  function getButtonLabel(): string {
    if (capturePayment.isPending) return '처리 중...';
    if (isCaptured) return '결제 완료 ✓';
    if (isRefunded) return '환불됨';
    if (isFailed) return '결제 실패 — 다시 시도';
    if (currentIntent?.status === 'AUTHORIZED') {
      return isServiceStarted ? '서비스 완료 확인 및 결제' : '가이드 서비스 시작 대기 중';
    }
    return '결제 완료 (Mock)';
  }

  const isButtonDisabled = isCaptured || isRefunded || capturePayment.isPending || !isServiceStarted;

  if (isLoading || createIntent.isPending) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#f59e0b" size="large" />
      </View>
    );
  }

  if (!currentIntent) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>결제 정보를 불러올 수 없습니다.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.pageTitle}>결제</Text>

      {isEmergency && (
        <View style={styles.emergencyBanner}>
          <Text style={styles.emergencyText}>EMERGENCY 요청 — 플랫폼 수수료 25%</Text>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>금액 내역</Text>

        <View style={styles.row}>
          <Text style={styles.rowLabel}>총 금액</Text>
          <Text testID="amount-krw" style={styles.rowValue}>
            {currentIntent.amountKrw.toLocaleString()}원
          </Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.row}>
          <Text style={styles.rowLabel}>
            플랫폼 수수료 {isEmergency ? '(25%)' : '(15%)'}
          </Text>
          <Text testID="platform-fee-krw" style={styles.rowValueMuted}>
            -{currentIntent.platformFeeKrw.toLocaleString()}원
          </Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.rowLabel}>가이드 수령액</Text>
          <Text testID="guide-payout" style={styles.rowValueAccent}>
            {currentIntent.guidePayout.toLocaleString()}원
          </Text>
        </View>
      </View>

      <TouchableOpacity
        testID="capture-button"
        style={[styles.captureButton, isButtonDisabled && styles.captureButtonDisabled]}
        onPress={handleCapture}
        disabled={isButtonDisabled}
      >
        <Text style={styles.captureButtonText}>{getButtonLabel()}</Text>
      </TouchableOpacity>

      {!isServiceStarted && !isCaptured && !isRefunded && (
        <Text style={styles.pendingNote}>가이드가 서비스를 시작하면 결제할 수 있습니다.</Text>
      )}

      {isCaptured && (
        <Text style={styles.capturedNote}>이미 결제가 완료되었습니다.</Text>
      )}

      {capturePayment.isError && (
        <Text style={styles.errorText}>결제 처리에 실패했습니다. 다시 시도해주세요.</Text>
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
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
  },
  pageTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 16,
  },
  emergencyBanner: {
    backgroundColor: '#f59e0b20',
    borderWidth: 1,
    borderColor: '#f59e0b',
    borderRadius: 6,
    padding: 10,
    marginBottom: 16,
  },
  emergencyText: {
    color: '#f59e0b',
    fontSize: 13,
    fontWeight: '500',
  },
  card: {
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#262626',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
  },
  sectionLabel: {
    color: '#a3a3a3',
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 6,
  },
  rowLabel: {
    color: '#d4d4d4',
    fontSize: 14,
  },
  rowValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  rowValueMuted: {
    color: '#a3a3a3',
    fontSize: 14,
  },
  rowValueAccent: {
    color: '#f59e0b',
    fontSize: 14,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#262626',
    marginVertical: 8,
  },
  captureButton: {
    backgroundColor: '#f59e0b',
    borderRadius: 6,
    paddingVertical: 14,
    alignItems: 'center',
  },
  captureButtonDisabled: {
    backgroundColor: '#404040',
  },
  captureButtonText: {
    color: '#000',
    fontWeight: '600',
    fontSize: 15,
  },
  pendingNote: {
    color: '#a3a3a3',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 12,
  },
  capturedNote: {
    color: '#22c55e',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 12,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 13,
    marginTop: 12,
    textAlign: 'center',
  },
});
