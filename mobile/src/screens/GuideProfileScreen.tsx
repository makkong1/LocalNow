import React from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import type { AppStackParamList } from '../navigation/AppNavigator';
import { usePublicProfile } from '../hooks/usePublicProfile';

type Props = StackScreenProps<AppStackParamList, 'GuideProfile'>;

function StarRating({ rating, count }: { rating: number; count: number }) {
  const full = Math.floor(rating);
  const stars = Array.from({ length: 5 }, (_, i) => (i < full ? '★' : '☆'));
  return (
    <Text style={styles.rating}>
      {stars.join('')} {rating.toFixed(1)} ({count})
    </Text>
  );
}

export default function GuideProfileScreen({ route, navigation }: Props) {
  const { userId } = route.params;
  const { data: profile, isLoading, isError } = usePublicProfile(userId);

  const currentYear = new Date().getFullYear();

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#f59e0b" size="large" />
      </View>
    );
  }

  if (isError || !profile) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>프로필을 불러올 수 없습니다</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backLink}>← 돌아가기</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const initials = profile.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const hasCertification = profile.certifications.length > 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* 뒤로 가기 */}
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
        <Text style={styles.backLink}>← 뒤로</Text>
      </TouchableOpacity>

      {/* 헤더 섹션 */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={styles.headerInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{profile.name}</Text>
            {hasCertification && (
              <View style={styles.certBadge}>
                <Text style={styles.certBadgeText}>인증됨</Text>
              </View>
            )}
          </View>
          {profile.birthYear != null && (
            <Text style={styles.age}>만 {currentYear - profile.birthYear}세</Text>
          )}
          <StarRating rating={profile.avgRating} count={profile.ratingCount} />
          <Text style={styles.completedCount}>{profile.completedCount}회 완료</Text>
        </View>
      </View>

      {/* 자기소개 섹션 */}
      {profile.bio != null && profile.bio.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>자기소개</Text>
          <Text style={styles.bio}>{profile.bio}</Text>
        </View>
      )}

      {/* 언어 능력 섹션 */}
      {profile.languages.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>언어 능력</Text>
          <View style={styles.badges}>
            {profile.languages.map((lang) => (
              <View key={lang} style={styles.langBadge}>
                <Text style={styles.langBadgeText}>{lang}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* 자격증 섹션 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>자격증</Text>
        {profile.certifications.length === 0 ? (
          <Text style={styles.emptyText}>등록된 자격증 없음</Text>
        ) : (
          profile.certifications.map((cert) => (
            <View key={cert.id} style={styles.certRow}>
              <Text style={styles.certIcon}>📄</Text>
              <Text style={styles.certName}>{cert.name}</Text>
              <View style={styles.pdfBadge}>
                <Text style={styles.pdfBadgeText}>PDF</Text>
              </View>
            </View>
          ))
        )}
      </View>

      {/* 후기 섹션 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>최근 후기</Text>
        {profile.recentReviews.length === 0 ? (
          <Text style={styles.emptyText}>아직 후기가 없습니다</Text>
        ) : (
          profile.recentReviews.slice(0, 5).map((review) => (
            <View key={review.id} style={styles.reviewCard}>
              <Text style={styles.reviewRating}>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</Text>
              {review.comment != null && (
                <Text style={styles.reviewComment}>{review.comment}</Text>
              )}
              <Text style={styles.reviewDate}>
                {new Date(review.createdAt).toLocaleDateString('ko-KR')}
              </Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { padding: 16, paddingBottom: 40 },
  centered: { flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center', gap: 12 },
  errorText: { color: '#a3a3a3', fontSize: 14 },
  backButton: { marginBottom: 16 },
  backLink: { color: '#f59e0b', fontSize: 14 },
  header: { flexDirection: 'row', gap: 16, marginBottom: 24 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#262626',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: '#f59e0b', fontSize: 24, fontWeight: '700' },
  headerInfo: { flex: 1, gap: 4, justifyContent: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { color: '#fafafa', fontSize: 20, fontWeight: '700' },
  certBadge: { backgroundColor: '#16a34a', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  certBadgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  age: { color: '#a3a3a3', fontSize: 13 },
  rating: { color: '#f59e0b', fontSize: 14 },
  completedCount: { color: '#a3a3a3', fontSize: 13 },
  section: {
    backgroundColor: '#141414',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#262626',
  },
  sectionTitle: { color: '#fafafa', fontSize: 15, fontWeight: '600', marginBottom: 10 },
  bio: { color: '#d4d4d4', fontSize: 14, lineHeight: 22 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  langBadge: {
    backgroundColor: '#78350f',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  langBadgeText: { color: '#fde68a', fontSize: 13, fontWeight: '500' },
  emptyText: { color: '#525252', fontSize: 13 },
  certRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  certIcon: { fontSize: 16 },
  certName: { flex: 1, color: '#d4d4d4', fontSize: 14 },
  pdfBadge: {
    backgroundColor: '#1e3a5f',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  pdfBadgeText: { color: '#93c5fd', fontSize: 11 },
  reviewCard: {
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#262626',
    gap: 4,
  },
  reviewRating: { color: '#f59e0b', fontSize: 13 },
  reviewComment: { color: '#d4d4d4', fontSize: 13, lineHeight: 20 },
  reviewDate: { color: '#525252', fontSize: 12 },
});
