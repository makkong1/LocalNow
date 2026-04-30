import React from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { useChatRooms } from '../hooks/useChat';
import type { ChatRoomSummaryResponse } from '../types/api';
import type { AppStackParamList } from '../navigation/AppNavigator';

function formatTime(iso: string | null): string {
  if (!iso) return '';
  const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return '방금';
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}시간 전`;
  return `${Math.floor(diffHr / 24)}일 전`;
}

function ChatRoomRow({
  room,
  onPress,
}: {
  room: ChatRoomSummaryResponse;
  onPress: () => void;
}) {
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
          {room.lastMessagePreview ?? '대화를 시작해보세요'}
        </Text>
      </View>
      {room.lastMessageAt && (
        <Text style={styles.time}>{formatTime(room.lastMessageAt)}</Text>
      )}
    </TouchableOpacity>
  );
}

export default function ChatListScreen() {
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
          채팅 목록을 불러오지 못했습니다
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
          <Text style={styles.retryText}>다시 시도</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!rooms || rooms.length === 0) {
    return (
      <View style={styles.center}>
        <Text testID="empty-chat-list" style={styles.emptyText}>
          확정된 매칭이 없습니다
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
