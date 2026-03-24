'use client';

import { useState, useEffect, useRef } from 'react';
import { ChatMessage } from '@/lib/types';

interface ChatProps {
  roomId: string;
  playerId: string;
  playerName: string;
  messages: ChatMessage[];
  onSend: (text: string) => void;
  isMuted?: boolean;
}

export default function Chat({ roomId, playerId, playerName, messages, onSend, isMuted }: ChatProps) {
  const [text, setText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || isMuted) return;
    onSend(trimmed);
    setText('');
  }

  function formatTime(ts: number) {
    return new Date(ts).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div className="chat-container flex flex-col h-full" style={{ minHeight: 0 }}>
      <div className="px-3 py-2 border-b" style={{ borderColor: 'rgba(212,168,67,0.2)' }}>
        <h3 style={{ color: '#d4a843', fontSize: '0.85rem', fontWeight: 700 }}>💬 Чат</h3>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1" style={{ minHeight: 0 }}>
        {messages.length === 0 && (
          <p className="text-center text-xs py-4" style={{ color: '#4a5a4a' }}>Нет сообщений</p>
        )}
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`chat-message ${msg.type === 'system' ? 'system' : msg.playerId === playerId ? 'own' : 'other'}`}
          >
            {msg.type !== 'system' && (
              <span style={{ fontWeight: 700, fontSize: '0.75rem', color: msg.playerId === playerId ? '#86efac' : '#93c5fd' }}>
                {msg.playerName}
                <span style={{ color: '#4a5a4a', fontWeight: 400, marginLeft: 4 }}>{formatTime(msg.timestamp)}</span>
              </span>
            )}
            <p style={{ margin: 0, marginTop: msg.type !== 'system' ? 2 : 0 }}>{msg.text}</p>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-2 py-2 border-t" style={{ borderColor: 'rgba(212,168,67,0.2)' }}>
        {isMuted ? (
          <p className="text-center text-xs py-1" style={{ color: '#e74c3c' }}>🔇 Вы заблокированы в чате</p>
        ) : (
          <div className="flex gap-1">
            <input
              ref={inputRef}
              className="flex-1 px-2 py-1.5 rounded-lg text-white text-sm"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(212,168,67,0.2)', outline: 'none', minWidth: 0 }}
              placeholder="Напишите..."
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              maxLength={200}
            />
            <button
              className="btn-primary px-3 py-1.5 text-sm rounded-lg"
              onClick={handleSend}
              disabled={!text.trim()}
            >
              ➤
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
