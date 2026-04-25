'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { StompClient } from '@/lib/stomp-client';
import type { ChatMessageResponse, ApiResponse, PageResponse } from '@/types/api';

interface Props {
  roomId: number;
  currentUserId: number;
}

function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

type ConnectionState = 'connecting' | 'connected' | 'disconnected';

export default function ChatPanel({ roomId, currentUserId }: Props) {
  const [messages, setMessages] = useState<ChatMessageResponse[]>([]);
  const [input, setInput] = useState('');
  const [connState, setConnState] = useState<ConnectionState>('disconnected');
  const stompRef = useRef<StompClient | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      // load history
      const histRes = await fetch(`/api/rooms/${roomId}/messages`);
      const histData: ApiResponse<PageResponse<ChatMessageResponse>> = await histRes.json();
      if (!cancelled && histData.success && histData.data) {
        setMessages(histData.data.items);
      }

      // get socket token
      const tokenRes = await fetch('/api/chat/socket-token');
      const { token } = await tokenRes.json();
      if (!token || cancelled) return;

      setConnState('connecting');
      const stomp = new StompClient();
      stompRef.current = stomp;

      try {
        await stomp.connect(token);
        if (cancelled) { stomp.disconnect(); return; }
        setConnState('connected');

        unsubRef.current = stomp.subscribe(`/topic/rooms/${roomId}`, (body) => {
          const msg = body as ChatMessageResponse;
          setMessages((prev) => {
            if (prev.some((m) => m.clientMessageId === msg.clientMessageId)) return prev;
            return [...prev, msg];
          });
        });
      } catch {
        if (!cancelled) setConnState('disconnected');
      }
    }

    init();

    return () => {
      cancelled = true;
      unsubRef.current?.();
      stompRef.current?.disconnect();
      setConnState('disconnected');
    };
  }, [roomId]);

  // auto scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(() => {
    const content = input.trim();
    if (!content || !stompRef.current || connState !== 'connected') return;

    stompRef.current.send(`/app/rooms/${roomId}/messages`, {
      content,
      clientMessageId: uuidv4(),
    });
    setInput('');
  }, [input, roomId, connState]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const connDot =
    connState === 'connected'
      ? 'bg-green-500'
      : connState === 'connecting'
      ? 'bg-yellow-500 animate-pulse'
      : 'bg-red-500';
  const connLabel =
    connState === 'connected' ? 'connected' : connState === 'connecting' ? 'reconnecting...' : 'disconnected';

  return (
    <div className="rounded-lg bg-[#141414] border border-neutral-800 flex flex-col h-96">
      {/* header */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-neutral-800">
        <span className={`h-2 w-2 rounded-full ${connDot}`} />
        <span className="text-xs text-neutral-400">{connLabel}</span>
      </div>

      {/* messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.map((msg) => {
          const isMine = msg.senderId === currentUserId;
          return (
            <div key={msg.clientMessageId} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-xs rounded-lg px-3 py-2 text-sm ${
                  isMine ? 'bg-amber-500/20 text-white' : 'bg-neutral-800 text-neutral-200'
                }`}
              >
                <p>{msg.content}</p>
                <p className="text-xs text-neutral-500 tabular-nums mt-1 text-right">
                  {new Date(msg.sentAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* input */}
      <div className="flex gap-2 p-3 border-t border-neutral-800">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="메시지를 입력하세요..."
          className="flex-1 rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2 text-white text-sm placeholder:text-neutral-500 focus:outline-none focus:border-amber-500"
        />
        <button
          onClick={sendMessage}
          disabled={connState !== 'connected'}
          className="rounded-md bg-amber-500 text-black font-medium px-4 py-2 hover:bg-amber-400 disabled:bg-neutral-700 disabled:text-neutral-500 text-sm"
        >
          전송
        </button>
      </div>
    </div>
  );
}
