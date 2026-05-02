import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import type { StackScreenProps } from '@react-navigation/stack';
import type { AppStackParamList } from '../navigation/AppNavigator';
import ReviewForm from '../components/ReviewForm';

type ReviewScreenProps = StackScreenProps<AppStackParamList, 'Review'>;

export default function ReviewScreen({ route, navigation }: ReviewScreenProps) {
  const { t } = useTranslation();
  const { requestId, guideId } = route.params;
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <View style={styles.successContainer}>
        <Text testID="review-success-message" style={styles.successTitle}>
          {t('review.done')}
        </Text>
        <TouchableOpacity
          testID="go-to-traveler-button"
          style={styles.button}
          onPress={() => navigation.navigate('MainTabs', { screen: 'Traveler' })}
        >
          <Text style={styles.buttonText}>{t('review.backToTraveler')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.pageTitle}>{t('review.title')}</Text>
      <ReviewForm
        requestId={requestId}
        guideId={guideId}
        onSubmit={() => setSubmitted(true)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
    padding: 24,
    gap: 20,
  },
  successTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#f59e0b',
    borderRadius: 6,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  buttonText: {
    color: '#000',
    fontWeight: '600',
    fontSize: 15,
  },
  pageTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '600',
    padding: 16,
    paddingBottom: 0,
  },
});
