import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { ChatMessageResponse } from '../types/api';

interface ChatBubbleProps {
  message: ChatMessageResponse;
  isMine: boolean;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

export default function ChatBubble({ message, isMine }: ChatBubbleProps) {
  return (
    <View style={[styles.container, isMine ? styles.myContainer : styles.theirContainer]}>
      <View
        testID="chat-bubble"
        style={[styles.bubble, isMine ? styles.myBubble : styles.theirBubble]}
      >
        <Text style={[styles.content, isMine ? styles.myContent : styles.theirContent]}>
          {message.content}
        </Text>
      </View>
      <Text style={styles.time}>{formatTime(message.sentAt)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
    maxWidth: '80%',
  },
  myContainer: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  theirContainer: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  bubble: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  myBubble: {
    backgroundColor: '#f59e0b',
  },
  theirBubble: {
    backgroundColor: '#262626',
  },
  content: {
    fontSize: 14,
    lineHeight: 20,
  },
  myContent: {
    color: '#000',
  },
  theirContent: {
    color: '#fff',
  },
  time: {
    color: '#525252',
    fontSize: 11,
    marginTop: 2,
  },
});
