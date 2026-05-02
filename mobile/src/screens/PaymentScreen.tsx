import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import type { StackScreenProps } from '@react-navigation/stack';
import type { AppStackParamList } from '../navigation/AppNavigator';
import { usePaymentIntent, useCreatePaymentIntent, useCapturePayment } from '../hooks/usePayment';
import { useMyRequests } from '../hooks/useRequests';

type PaymentScreenProps = StackScreenProps<AppStackParamList, 'Payment'>;

export default function PaymentScreen({ route, navigation }: PaymentScreenProps) {
  const { t } = useTranslation();
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
    if (capturePayment.isPending) return t('common.processing');
    if (isCaptured) return t('payment.paid');
    if (isRefunded) return t('payment.refunded');
    if (isFailed) return t('payment.failed');
    if (currentIntent?.status === 'AUTHORIZED') {
      return isServiceStarted ? t('payment.pay') : t('payment.waitingStart');
    }
    return t('payment.mockPaid');
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
        <Text style={styles.errorText}>{t('payment.loadError')}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.pageTitle}>{t('payment.title')}</Text>

      {isEmergency && (
        <View style={styles.emergencyBanner}>
          <Text style={styles.emergencyText}>{t('payment.emergencyFeeNotice')}</Text>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>{t('payment.breakdown')}</Text>

        <View style={styles.row}>
          <Text style={styles.rowLabel}>{t('payment.total')}</Text>
          <Text testID="amount-krw" style={styles.rowValue}>
            {currentIntent.amountKrw.toLocaleString()}{t('common.won')}
          </Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.row}>
          <Text style={styles.rowLabel}>
            {isEmergency ? t('payment.feeRate25') : t('payment.feeRate15')}
          </Text>
          <Text testID="platform-fee-krw" style={styles.rowValueMuted}>
            -{currentIntent.platformFeeKrw.toLocaleString()}{t('common.won')}
          </Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.rowLabel}>{t('payment.guideAmount')}</Text>
          <Text testID="guide-payout" style={styles.rowValueAccent}>
            {currentIntent.guidePayout.toLocaleString()}{t('common.won')}
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
        <Text style={styles.pendingNote}>{t('payment.waitingGuide')}</Text>
      )}

      {isCaptured && (
        <Text style={styles.capturedNote}>{t('payment.alreadyPaid')}</Text>
      )}

      {capturePayment.isError && (
        <Text style={styles.errorText}>{t('payment.payFailed')}</Text>
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
