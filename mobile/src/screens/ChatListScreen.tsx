import React from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { useChatRooms } from '../hooks/useChat';
import type { ChatRoomSummaryResponse } from '../types/api';
import type { AppStackParamList } from '../navigation/AppNavigator';

type TFunction = (key: string, opts?: Record<string, unknown>) => string;

function formatTime(iso: string | null, t: TFunction): string {
  if (!iso) return '';
  const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return t('chat.justNow');
  if (diffMin < 60) return t('chat.minutesAgo', { n: diffMin });
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return t('chat.hoursAgo', { n: diffHr });
  return t('chat.daysAgo', { n: Math.floor(diffHr / 24) });
}

function ChatRoomRow({
  room,
  onPress,
}: {
  room: ChatRoomSummaryResponse;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  return (
    <TouchableOpacity
      testID={`chat-room-row-${room.roomId}`}
      style={styles.row}
      onPress={onPress}
    >
      <View style={styles.rowLeft}>
        <View style={styles.rowHeader}>
          <Text style={styles.partnerName}>{room.partnerName}</Text>
          <Text style={styles.typeBadge}>{room.requestType}</Text>
        </View>
        <Text style={styles.preview} numberOfLines={1}>
          {room.lastMessagePreview ?? t('chat.empty')}
        </Text>
      </View>
      {room.lastMessageAt && (
        <Text style={styles.time}>{formatTime(room.lastMessageAt, t)}</Text>
      )}
    </TouchableOpacity>
  );
}

export default function ChatListScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const { data: rooms, isLoading, isError, refetch } = useChatRooms();

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator testID="chat-list-loading" color="#f59e0b" />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.center}>
        <Text testID="chat-list-error" style={styles.errorText}>
          {t('chat.listError')}
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
          <Text style={styles.retryText}>{t('common.retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!rooms || rooms.length === 0) {
    return (
      <View style={styles.center}>
        <Text testID="empty-chat-list" style={styles.emptyText}>
          {t('chat.noChats')}
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      data={rooms}
      keyExtractor={(item) => String(item.roomId)}
      renderItem={({ item }) => (
        <ChatRoomRow
          room={item}
          onPress={() =>
            navigation.navigate('ChatRoom', {
              roomId: item.roomId,
              requestId: item.requestId,
            })
          }
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
  },
  emptyText: { color: '#525252', fontSize: 14 },
  errorText: { color: '#ef4444', fontSize: 14, marginBottom: 12 },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#1c1c1c',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#262626',
  },
  retryText: { color: '#f59e0b', fontSize: 13, fontWeight: '500' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1c1c1c',
  },
  rowLeft: { flex: 1, marginRight: 8 },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  partnerName: { color: '#fff', fontSize: 14, fontWeight: '600' },
  typeBadge: { color: '#f59e0b', fontSize: 10, fontWeight: '500' },
  preview: { color: '#a3a3a3', fontSize: 13 },
  time: { color: '#525252', fontSize: 11 },
});
