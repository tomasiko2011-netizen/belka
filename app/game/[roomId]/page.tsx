'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getPusherClient, EVENTS } from '@/lib/pusher';
import { GameState, ChatMessage, Card as CardType } from '@/lib/types';
import GameBoard from '@/components/GameBoard';

export default function GamePage({ params }: { params: { roomId: string } }) {
  const router = useRouter();
  const { roomId } = params;

  const [playerId, setPlayerId] = useState<string>('');
  const [playerName, setPlayerName] = useState<string>('');
  const [isHost, setIsHost] = useState(false);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [myHand, setMyHand] = useState<CardType[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pusherChannel, setPusherChannel] = useState<any>(null);
  const pusherClient = useRef<any>(null);

  useEffect(() => {
    const pid = localStorage.getItem('belka_player_id') || '';
    const pname = localStorage.getItem('belka_player_name') || 'Игрок';
    setPlayerId(pid);
    setPlayerName(pname);

    if (!pid) {
      router.push('/');
      return;
    }

    loadRoom(pid, pname);
  }, [roomId]);

  useEffect(() => {
    if (!playerId || !roomId) return;
    const payload = JSON.stringify({ roomId, playerId, action: 'player_left' });

    const sendLeave = () => {
      try {
        if (navigator.sendBeacon) {
          const blob = new Blob([payload], { type: 'application/json' });
          navigator.sendBeacon('/api/game/action', blob);
          return;
        }
        fetch('/api/game/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true,
        }).catch(() => {});
      } catch {}
    };

    window.addEventListener('pagehide', sendLeave);
    window.addEventListener('beforeunload', sendLeave);
    return () => {
      window.removeEventListener('pagehide', sendLeave);
      window.removeEventListener('beforeunload', sendLeave);
    };
  }, [playerId, roomId]);

  async function loadRoom(pid: string, pname: string) {
    try {
      // Fetch room state
      const res = await fetch(`/api/rooms?roomId=${roomId}`);
      // Actually use the GET to list rooms then find ours... 
      // Better: fetch game state directly
      await refreshState(pid);

      // Load chat history
      const chatRes = await fetch(`/api/chat?roomId=${roomId}`);
      if (chatRes.ok) {
        const chatData = await chatRes.json();
        setMessages(chatData.messages || []);
      }

      // Setup Pusher
      setupPusher(pid, pname);
    } catch (e) {
      console.error(e);
      setError('Ошибка подключения к комнате');
    } finally {
      setLoading(false);
    }
  }

  async function refreshState(pidOverride?: string) {
    const pid = pidOverride || playerId;
    if (!pid) return;
    const stateRes = await fetch(`/api/game/state?roomId=${roomId}&playerId=${pid}`);
    if (stateRes.ok) {
      const data = await stateRes.json();
      setGameState(data.gameState);
      setMyHand(data.hand || []);
      setIsHost(data.isHost);
    }
  }

  // Poll game state to avoid UI stalls if realtime events drop
  useEffect(() => {
    if (!playerId || !roomId) return;
    const interval = setInterval(() => {
      refreshState();
    }, 3000);
    return () => clearInterval(interval);
  }, [playerId, roomId]);

  function setupPusher(pid: string, pname: string) {
    const client = getPusherClient({
      'x-player-id': pid,
      'x-player-name': pname,
    });
    pusherClient.current = client;

    const channel = client.subscribe(`presence-room-${roomId}`);
    const privateChannel = client.subscribe(`private-player-${pid}`);

    channel.bind(EVENTS.GAME_STATE, (data: { gameState: GameState }) => {
      setGameState(data.gameState);
    });

    channel.bind(EVENTS.CHAT_MESSAGE, (msg: ChatMessage) => {
      setMessages(prev => [...prev.slice(-99), msg]);
    });

    channel.bind(EVENTS.PLAYER_JOINED, (data: { playerName: string }) => {
      const sysMsg: ChatMessage = {
        id: Date.now().toString(),
        playerId: 'system',
        playerName: 'Система',
        text: `${data.playerName} присоединился к игре`,
        timestamp: Date.now(),
        type: 'system',
      };
      setMessages(prev => [...prev, sysMsg]);
    });

    channel.bind(EVENTS.MOD_ACTION, (data: { type: string; targetPlayerId: string }) => {
      if (data.targetPlayerId === pid && data.type === 'ban') {
        alert('Вы были забанены администратором комнаты');
        router.push('/');
      }
    });

    // Private channel for hand updates
    privateChannel.bind('hand-update', (data: { hand: CardType[] }) => {
      setMyHand(data.hand);
    });

    privateChannel.bind('banned', () => {
      alert('Вы были исключены из комнаты');
      router.push('/');
    });

    // Video signaling
    privateChannel.bind('video-offer', (data: any) => {
      // Handled in VideoChat component
      window.dispatchEvent(new CustomEvent('webrtc-signal', { detail: { ...data, signalType: 'offer' } }));
    });

    privateChannel.bind('video-answer', (data: any) => {
      window.dispatchEvent(new CustomEvent('webrtc-signal', { detail: { ...data, signalType: 'answer' } }));
    });

    privateChannel.bind('video-ice-candidate', (data: any) => {
      window.dispatchEvent(new CustomEvent('webrtc-signal', { detail: { ...data, signalType: 'ice-candidate' } }));
    });

    setPusherChannel(channel);
  }

  async function handleGameAction(action: string, cardId?: string, payload?: Record<string, any>) {
    try {
      const res = await fetch('/api/game/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, playerId, action, cardId, ...(payload || {}) }),
      });
      const data = await res.json();
      if (!res.ok) {
        console.error(data.error);
        alert(data.error || 'Ошибка действия');
        return;
      }
      if (data.gameState) setGameState(data.gameState);
    } catch (e) {
      console.error(e);
    }
  }

  async function handleSendChat(text: string) {
    try {
      await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, playerId, playerName, text }),
      });
    } catch (e) {
      console.error(e);
    }
  }

  async function handleModAction(type: string, targetId: string) {
    try {
      const res = await fetch('/api/mod', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, moderatorId: playerId, targetPlayerId: targetId, action: type }),
      });
      if (!res.ok) {
        const d = await res.json();
        alert(d.error);
      }
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => {
    return () => {
      if (pusherClient.current) {
        pusherClient.current.unsubscribe(`presence-room-${roomId}`);
        pusherClient.current.unsubscribe(`private-player-${playerId}`);
      }
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div style={{ fontSize: '3rem', animation: 'spin 1s linear infinite', display: 'inline-block' }}>🃏</div>
          <p style={{ color: '#d4a843', marginTop: 12, fontFamily: 'Playfair Display, serif' }}>Загрузка игры...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="modal-box text-center">
          <p style={{ color: '#e74c3c', fontSize: '1.1rem' }}>⚠️ {error}</p>
          <button className="btn-primary mt-4" onClick={() => router.push('/')}>← В лобби</button>
        </div>
      </div>
    );
  }

  if (!gameState) return null;

  // Pass myHand to GameBoard via a wrapper
  return (
    <GameBoardWrapper
      roomId={roomId}
      playerId={playerId}
      playerName={playerName}
      isHost={isHost}
      gameState={gameState}
      myHand={myHand}
      messages={messages}
      pusherChannel={pusherChannel}
      onGameAction={handleGameAction}
      onSendChat={handleSendChat}
      onModAction={handleModAction}
    />
  );
}

// Wrapper to pass myHand into GameBoard
function GameBoardWrapper({
  roomId, playerId, playerName, isHost, gameState, myHand,
  messages, pusherChannel, onGameAction, onSendChat, onModAction,
}: {
  roomId: string;
  playerId: string;
  playerName: string;
  isHost: boolean;
  gameState: GameState;
  myHand: CardType[];
  messages: ChatMessage[];
  pusherChannel: any;
  onGameAction: (action: string, cardId?: string, payload?: Record<string, any>) => Promise<void>;
  onSendChat: (text: string) => void;
  onModAction: (type: string, targetId: string) => Promise<void>;
}) {
  // Inject myHand into gameState for the current player
  const enrichedState: GameState = {
    ...gameState,
    players: gameState.players.map(p =>
      p.id === playerId ? { ...p, hand: myHand } : p
    ),
  };

  return (
    <GameBoard
      roomId={roomId}
      playerId={playerId}
      playerName={playerName}
      isHost={isHost}
      initialState={enrichedState}
      initialMessages={messages}
      onGameAction={onGameAction}
      onSendChat={onSendChat}
      onModAction={onModAction}
      pusherChannel={pusherChannel}
    />
  );
}
