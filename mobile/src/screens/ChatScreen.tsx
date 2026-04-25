import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import uuid from 'react-native-uuid';
import { useMessages } from '../hooks/useChat';
import { useAuth } from '../hooks/useAuth';
import { stompClient } from '../lib/stomp-client';
import ChatBubble from '../components/ChatBubble';
import type { ChatMessageResponse } from '../types/api';
import type { AppStackParamList } from '../navigation/AppNavigator';

type ChatScreenProps = StackScreenProps<AppStackParamList, 'ChatRoom'>;

export default function ChatScreen({ route }: ChatScreenProps) {
  const { roomId } = route.params;
  const { userId } = useAuth();
  const { data: historyMessages, isLoading } = useMessages(roomId);
  const [realtimeMessages, setRealtimeMessages] = useState<ChatMessageResponse[]>([]);
  const [text, setText] = useState('');
  const [isConnected, setIsConnected] = useState(() => stompClient.isConnected);
  const flatListRef = useRef<FlatList>(null);

  // Merge history + realtime, dedup by clientMessageId
  const allMessages: ChatMessageResponse[] = [
    ...(historyMessages ?? []),
    ...realtimeMessages.filter(
      (rm) => !(historyMessages ?? []).some((hm) => hm.clientMessageId === rm.clientMessageId),
    ),
  ];

  // Subscribe to room topic for realtime messages
  useEffect(() => {
    const sub = stompClient.subscribe(`/topic/rooms/${roomId}`, (body) => {
      try {
        const msg = JSON.parse(body) as ChatMessageResponse;
        setIsConnected(true);
        setRealtimeMessages((prev) => {
          if (prev.some((m) => m.clientMessageId === msg.clientMessageId)) return prev;
          return [...prev, msg];
        });
      } catch {
        // ignore malformed frames
      }
    });
    return () => sub.unsubscribe();
  }, [roomId]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (allMessages.length > 0) {
      flatListRef.current?.scrollToEnd({ animated: true });
    }
  }, [allMessages.length]);

  function sendMessage() {
    const content = text.trim();
    if (!content) return;
    const clientMessageId = uuid.v4() as string;
    stompClient.send(`/app/rooms/${roomId}/messages`, { content, clientMessageId });
    setText('');
  }

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#f59e0b" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={96}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>채팅방 #{roomId}</Text>
        <View style={styles.connStatus}>
          <View
            style={[styles.connDot, { backgroundColor: isConnected ? '#22c55e' : '#ef4444' }]}
          />
          <Text style={styles.connLabel}>{isConnected ? 'connected' : 'disconnected'}</Text>
        </View>
      </View>

      <FlatList
        ref={flatListRef}
        data={allMessages}
        keyExtractor={(item) => item.clientMessageId ?? String(item.messageId)}
        renderItem={({ item }) => (
          <ChatBubble message={item} isMine={item.senderId === userId} />
        )}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>대화를 시작해보세요</Text>
          </View>
        }
      />

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="메시지 입력..."
          placeholderTextColor="#525252"
          multiline
          testID="chat-input"
          onSubmitEditing={sendMessage}
        />
        <TouchableOpacity
          style={[styles.sendButton, !text.trim() && styles.sendButtonDisabled]}
          onPress={sendMessage}
          disabled={!text.trim()}
          testID="send-button"
        >
          <Text style={styles.sendText}>전송</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#262626',
    backgroundColor: '#141414',
  },
  headerTitle: {
    color: '#f59e0b',
    fontWeight: '600',
    fontSize: 15,
  },
  connStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  connDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  connLabel: {
    color: '#a3a3a3',
    fontSize: 11,
  },
  messageList: {
    padding: 16,
    paddingBottom: 8,
    flexGrow: 1,
  },
  emptyBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: '#525252',
    fontSize: 14,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#262626',
    backgroundColor: '#141414',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#1c1c1c',
    borderWidth: 1,
    borderColor: '#262626',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#fff',
    fontSize: 14,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: '#f59e0b',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sendButtonDisabled: {
    backgroundColor: '#404040',
  },
  sendText: {
    color: '#000',
    fontWeight: '600',
    fontSize: 14,
  },
});
