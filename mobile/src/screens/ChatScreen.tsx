import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useMyRequests } from '../hooks/useRequests';
import { useChatRoom } from '../hooks/useChat';
import type { HelpRequestResponse } from '../types/api';

function getMatchedRequest(items: HelpRequestResponse[]): HelpRequestResponse | null {
  return items.find((r) => r.status === 'MATCHED' || r.status === 'IN_PROGRESS') ?? null;
}

// Sub-component: 매칭된 요청이 있을 때만 채팅방 쿼리 실행
function ChatRoomView({ requestId }: { requestId: number }) {
  const { data: room, isLoading } = useChatRoom(requestId);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#f59e0b" />
      </View>
    );
  }

  if (!room) {
    return (
      <View style={styles.center}>
        <Text style={styles.placeholder}>채팅방을 불러오는 중...</Text>
      </View>
    );
  }

  // step 5에서 실제 채팅 UI 구현 예정
  return (
    <View style={styles.center}>
      <Text style={styles.roomInfo}>채팅방 #{room.id}</Text>
      <Text style={styles.placeholder}>step 5에서 채팅 기능이 구현됩니다.</Text>
    </View>
  );
}

export default function ChatScreen() {
  const { data: page, isLoading } = useMyRequests();
  const matchedRequest = page ? getMatchedRequest(page.items) : null;

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#f59e0b" size="large" />
      </View>
    );
  }

  if (!matchedRequest) {
    return (
      <View style={styles.center}>
        <Text style={styles.placeholder}>매칭 확정 후 채팅이 열립니다</Text>
      </View>
    );
  }

  return <ChatRoomView requestId={matchedRequest.id} />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
    padding: 24,
  },
  placeholder: {
    color: '#525252',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
  roomInfo: {
    color: '#f59e0b',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
});
