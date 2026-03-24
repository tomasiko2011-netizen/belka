'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { GameState, ChatMessage, Card as CardType, Player } from '@/lib/types';
import { getValidCards } from '@/lib/game-engine';
import CardComp from './Card';
import Chat from './Chat';
import VideoChat from './VideoChat';

interface GameBoardProps {
  roomId: string;
  playerId: string;
  playerName: string;
  isHost: boolean;
  initialState: GameState;
  initialMessages: ChatMessage[];
  onGameAction: (action: string, cardId?: string, payload?: Record<string, any>) => Promise<void>;
  onSendChat: (text: string) => void;
  onModAction: (type: string, targetId: string) => Promise<void>;
  pusherChannel: any;
}

const SEAT_POSITIONS = [
  { label: 'Юг (Вы)', posClass: 'bottom-2 left-1/2 -translate-x-1/2' },
  { label: 'Запад',   posClass: 'left-2 top-1/2 -translate-y-1/2' },
  { label: 'Север',   posClass: 'top-2 left-1/2 -translate-x-1/2' },
  { label: 'Восток',  posClass: 'right-2 top-1/2 -translate-y-1/2' },
];

const TRICK_CARD_OFFSETS = [
  { bottom: '50%', left: '50%', transform: 'translateX(-50%) translateY(60px)' },   // seat 0
  { bottom: '50%', left: '50%', transform: 'translateX(-70px) translateY(0px)' },  // seat 1
  { bottom: '50%', left: '50%', transform: 'translateX(-50%) translateY(-70px)' }, // seat 2
  { bottom: '50%', left: '50%', transform: 'translateX(20px) translateY(0px)' },   // seat 3
];

export default function GameBoard({
  roomId, playerId, playerName, isHost, initialState, initialMessages,
  onGameAction, onSendChat, onModAction, pusherChannel,
}: GameBoardProps) {
  const [gameState, setGameState] = useState<GameState>(initialState);
  const [myHand, setMyHand] = useState<CardType[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [lastTrick, setLastTrick] = useState<typeof gameState.currentTrick | null>(null);
  const [showLastTrick, setShowLastTrick] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showMod, setShowMod] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [turnLeft, setTurnLeft] = useState(0);
  const [showVideo, setShowVideo] = useState(true);
  const [showChat, setShowChat] = useState(true);
  const [presetOpen, setPresetOpen] = useState(false);
  const [rulesDraft, setRulesDraft] = useState(() => ({
    withSevens: initialState.rules?.withSevens ?? initialState.withSevens,
    winEyes: initialState.rules?.winEyes ?? 12,
    eggsEnabled: initialState.rules?.eggsEnabled ?? true,
    saveEnabled: initialState.rules?.saveEnabled ?? true,
    saveThreshold: initialState.rules?.saveThreshold ?? 30,
    turnTimerSec: initialState.rules?.turnTimerSec ?? 20,
  }));

  const myPlayer = gameState.players.find(p => p.id === playerId);
  const mySeatIndex = myPlayer?.seatIndex ?? 0;
  const isMyTurn = gameState.currentPlayerIndex === mySeatIndex && gameState.phase === 'playing';

  // Rotate players so I'm always at bottom (seat 0 in display)
  const displayPlayers = (() => {
    const result: Array<Player | null> = [null, null, null, null];
    for (const p of gameState.players) {
      const displaySeat = (p.seatIndex - mySeatIndex + 4) % 4;
      result[displaySeat] = p;
    }
    return result;
  })();

  const validCards = isMyTurn
    ? getValidCards(myHand, gameState.currentTrick, gameState.trumpSuit)
    : [];
  const validCardIds = new Set(validCards.map(c => c.id));

  const rulesSummary = (() => {
    const rules = gameState.rules || {
      withSevens: gameState.withSevens,
      winEyes: 12,
      eggsEnabled: true,
      saveEnabled: true,
      saveThreshold: 30,
      turnTimerSec: 20,
    };
    return `Глаза ${rules.winEyes} • ${rules.withSevens ? '36 карт' : '32 карты'} • Яйца ${rules.eggsEnabled ? 'вкл' : 'выкл'} • Спас ${rules.saveEnabled ? rules.saveThreshold : 'выкл'} • Таймер ${rules.turnTimerSec || 0}с`;
  })();

  // Subscribe to Pusher events
  useEffect(() => {
    if (!pusherChannel) return;

    pusherChannel.bind('game-state', (data: { gameState: GameState }) => {
      setGameState(data.gameState);
      // Check if trick just completed
      if (data.gameState.completedTricks.length > gameState.completedTricks.length) {
        const trick = data.gameState.completedTricks[data.gameState.completedTricks.length - 1];
        setLastTrick(trick);
      }
    });

    pusherChannel.bind('chat-message', (msg: ChatMessage) => {
      setMessages(prev => [...prev.slice(-99), msg]);
    });

    pusherChannel.bind('player-joined', (data: any) => {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        playerId: 'system',
        playerName: 'Система',
        text: `${data.playerName} присоединился к игре`,
        timestamp: Date.now(),
        type: 'system',
      }]);
    });

    return () => {
      pusherChannel.unbind_all();
    };
  }, [pusherChannel, gameState.completedTricks.length]);

  useEffect(() => {
    setRulesDraft({
      withSevens: gameState.rules?.withSevens ?? gameState.withSevens,
      winEyes: gameState.rules?.winEyes ?? 12,
      eggsEnabled: gameState.rules?.eggsEnabled ?? true,
      saveEnabled: gameState.rules?.saveEnabled ?? true,
      saveThreshold: gameState.rules?.saveThreshold ?? 30,
      turnTimerSec: gameState.rules?.turnTimerSec ?? 0,
    });
  }, [gameState.rules, gameState.withSevens]);

  useEffect(() => {
    const stored = localStorage.getItem('belka_show_video');
    if (stored === '0') setShowVideo(false);
  }, []);

  useEffect(() => {
    localStorage.setItem('belka_show_video', showVideo ? '1' : '0');
  }, [showVideo]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setShowVideo(false);
        setShowChat(false);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const timer = gameState.rules?.turnTimerSec ?? 0;
    if (!timer || gameState.phase !== 'playing') {
      setTurnLeft(0);
      return;
    }
    setTurnLeft(timer);
    const interval = setInterval(() => {
      setTurnLeft(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [gameState.currentPlayerIndex, gameState.phase, gameState.rules?.turnTimerSec]);

  // Subscribe to private channel for hand updates
  useEffect(() => {
    // This is handled in the page component via pusher private channel
  }, []);

  async function handlePlayCard(cardId: string) {
    if (!isMyTurn) return;
    if (selectedCard === cardId) {
      // Double click = confirm play
      setSelectedCard(null);
      await onGameAction('play_card', cardId);
    } else {
      setSelectedCard(cardId);
    }
  }

  async function handleStartGame() {
    await onGameAction('start_game');
  }

  async function handleSaveRules() {
    await onGameAction('update_rules', undefined, { rules: rulesDraft });
    setShowSettings(false);
  }
  async function handleNextRound() {
    await onGameAction('next_round');
  }

  const SUIT_COLORS: Record<string, string> = { '♣': '#1a1a2e', '♠': '#1a1a2e', '♥': '#c0392b', '♦': '#c0392b' };

  const renderPlayerSeat = (player: Player | null, displaySeat: number) => {
    if (!player) {
      return (
        <div className="player-seat">
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            border: '2px dashed rgba(255,255,255,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'rgba(255,255,255,0.2)', fontSize: '1.2rem'
          }}>?</div>
          <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.2)' }}>Ожидание...</span>
        </div>
      );
    }

    const isActive = gameState.currentPlayerIndex === player.seatIndex && gameState.phase === 'playing';
    const teamClass = player.teamId === 0 ? 'team-0' : 'team-1';
    const isMe = player.id === playerId;
    const cardCount = player.hand?.length ?? 0;

    return (
      <div className={`player-seat ${teamClass}`}>
        <div className={`player-avatar ${isActive ? 'active' : ''}`} style={{ position: 'relative' }}>
          {isActive && <span style={{ position: 'absolute', top: -8, fontSize: '0.8rem' }}>▼</span>}
          <span>{player.name.charAt(0).toUpperCase()}</span>
          {!isMe && isHost && (
            <button
              onClick={() => setShowMod(player.id)}
              style={{
                position: 'absolute', bottom: -2, right: -2,
                background: 'rgba(0,0,0,0.7)', borderRadius: '50%',
                width: 16, height: 16, fontSize: '0.5rem', border: 'none',
                cursor: 'pointer', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
            >⚙</button>
          )}
        </div>
        <span style={{ fontSize: '0.7rem', color: player.teamId === 0 ? '#93c5fd' : '#fca5a5', fontWeight: 600 }}>
          {player.name}
          {player.isBot && ' 🤖'}
          {isMe && ' (Вы)'}
        </span>
        {/* Show card backs for other players */}
        {!isMe && displaySeat !== 0 && cardCount > 0 && (
          <div className="flex gap-0.5">
            {Array.from({ length: Math.min(cardCount, 8) }).map((_, i) => (
              <div key={i} className="card-back" style={{ width: 10, height: 16, borderRadius: 2 }} />
            ))}
          </div>
        )}
        {isActive && (
          <div style={{
            fontSize: '0.6rem', padding: '2px 6px', borderRadius: 8,
            background: 'rgba(255,215,0,0.2)', color: '#ffd700', fontWeight: 700
          }}>
            Ходит
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="game-layout flex h-screen overflow-hidden" style={{ background: '#1a1b1f' }}>
      {/* Main game area */}
      <div className="game-main flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="topbar flex items-center justify-between px-4 py-2" style={{ background: 'rgba(0,0,0,0.4)', borderBottom: '1px solid rgba(212,168,67,0.2)' }}>
          <div className="topbar-left flex items-center gap-3">
            <span style={{ fontFamily: 'Playfair Display, serif', color: '#d4a843', fontSize: '1.2rem' }}>🐿️ Белка</span>
            <span style={{ fontSize: '0.75rem', color: '#6b7c6b' }}>Комната: {roomId.slice(0, 8)}</span>
            <span className="rules-summary" style={{ fontSize: '0.7rem', color: '#a0b09a' }}>{rulesSummary}</span>
          </div>
          <div className="topbar-right flex items-center gap-3">
            {/* Trump display */}
            {gameState.phase === 'playing' && (
              <div className="trump-badge flex items-center gap-1" style={{ fontSize: '0.8rem' }}>
                Козырь:
                <span style={{ fontSize: '1.1rem', color: SUIT_COLORS[gameState.trumpSuit] || '#1a1a2e' }}>
                  {gameState.trumpSuit}
                </span>
              </div>
            )}
            {/* Round */}
            <span style={{ fontSize: '0.75rem', color: '#6b7c6b' }}>Кон {gameState.round}</span>
            {turnLeft > 0 && (
              <span className="trump-badge" style={{ fontSize: '0.75rem' }}>⏱ {turnLeft}s</span>
            )}
            <button className="btn-secondary topbar-btn text-xs px-2 py-1 rounded" onClick={() => setShowRules(true)}>
              ? Правила
            </button>
            <button className="btn-secondary topbar-btn text-xs px-2 py-1 rounded" onClick={() => setShowVideo(v => !v)}>
              {showVideo ? '📹 Видео' : '📷 Видео'}
            </button>
            <button className="btn-secondary topbar-btn text-xs px-2 py-1 rounded" onClick={() => setShowChat(v => !v)}>
              {showChat ? '💬 Чат' : '🗨 Чат'}
            </button>
            <div className="relative">
              <button className="btn-secondary topbar-btn text-xs px-2 py-1 rounded" onClick={() => setPresetOpen(o => !o)}>
                🎛 Режимы
              </button>
              {presetOpen && (
                <div className="absolute right-0 mt-2 p-2 rounded-lg" style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.08)', zIndex: 10 }}>
                  <button className="btn-secondary text-xs w-full mb-1" onClick={() => { setShowVideo(false); setShowChat(false); setPresetOpen(false); }}>
                    Только поле
                  </button>
                  <button className="btn-secondary text-xs w-full mb-1" onClick={() => { setShowVideo(false); setShowChat(true); setPresetOpen(false); }}>
                    Поле + чат
                  </button>
                  <button className="btn-secondary text-xs w-full" onClick={() => { setShowVideo(true); setShowChat(true); setPresetOpen(false); }}>
                    Поле + видео
                  </button>
                </div>
              )}
            </div>
            <button
              className="btn-secondary topbar-btn text-xs px-2 py-1 rounded"
              onClick={() => {
                const ok = confirm('Выйти из комнаты?');
                if (ok) {
                  onGameAction('player_left');
                  window.location.href = '/';
                }
              }}
            >
              ⏏ Выйти
            </button>
          </div>
        </div>

        {/* Score bar */}
        <div className="scorebar flex justify-center gap-6 py-1.5 px-4" style={{ background: 'rgba(0,0,0,0.3)' }}>
          {[0, 1].map(teamId => (
            <div key={teamId} className="flex items-center gap-2">
              <span style={{ fontSize: '0.7rem', color: teamId === 0 ? '#93c5fd' : '#fca5a5', fontWeight: 700 }}>
                Команда {teamId + 1}
              </span>
              <div className="flex gap-0.5">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      width: 8, height: 12, borderRadius: 1,
                      background: i < gameState.teams[teamId].eyes
                        ? (teamId === 0 ? '#93c5fd' : '#fca5a5')
                        : 'rgba(255,255,255,0.1)',
                      border: `1px solid ${i < gameState.teams[teamId].eyes ? 'transparent' : 'rgba(255,255,255,0.1)'}`,
                      transition: 'background 0.3s',
                    }}
                  />
                ))}
              </div>
              <span style={{ fontSize: '0.7rem', color: '#a0b09a' }}>
                {gameState.teams[teamId].roundPoints > 0 && `(${gameState.teams[teamId].roundPoints} очк.)`}
              </span>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="table-area flex-1 relative felt-bg mx-3 my-2 rounded-2xl overflow-hidden" style={{ minHeight: 0 }}>
          {/* Players at positions */}
          {/* Top (seat 2 display = opposite) */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2">
            {renderPlayerSeat(displayPlayers[2], 2)}
          </div>
          {/* Left (seat 1 display) */}
          <div className="absolute left-3 top-1/2 -translate-y-1/2">
            {renderPlayerSeat(displayPlayers[1], 1)}
          </div>
          {/* Right (seat 3 display) */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {renderPlayerSeat(displayPlayers[3], 3)}
          </div>

          {/* Center trick area */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div style={{ position: 'relative', width: 220, height: 180 }}>
              {gameState.currentTrick.cards.map(({ card, seatIndex }) => {
                const displaySeat = (seatIndex - mySeatIndex + 4) % 4;
                const offsets = TRICK_CARD_OFFSETS[displaySeat];
                return (
                  <div
                    key={card.id}
                    className="trick-card"
                    style={{
                      position: 'absolute',
                      ...offsets,
                      zIndex: 1,
                    }}
                  >
                    <CardComp card={card} size="sm" />
                  </div>
                );
              })}
              {gameState.currentTrick.cards.length === 0 && gameState.phase === 'playing' && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div style={{ width: 60, height: 80, borderRadius: 8, border: '2px dashed rgba(212,168,67,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ color: 'rgba(212,168,67,0.3)', fontSize: '1.5rem' }}>🃏</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Status messages */}
          <div className="absolute top-1/2 right-4 -translate-y-1/2">
            {gameState.lastAction && (
              <div style={{
                background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
                border: '1px solid rgba(212,168,67,0.2)',
                borderRadius: 8, padding: '6px 10px', maxWidth: 150,
                fontSize: '0.7rem', color: '#d4a843', textAlign: 'center'
              }}>
                {gameState.lastAction}
              </div>
            )}
          </div>

          {/* Bottom player (me) */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
            {renderPlayerSeat(myPlayer || null, 0)}
          </div>

          {/* Waiting state */}
          {gameState.phase === 'waiting' && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <p style={{ color: '#d4a843', fontSize: '1.1rem', fontWeight: 700, fontFamily: 'Playfair Display, serif' }}>
                  Ожидание игроков...
                </p>
                <p style={{ color: '#6b7c6b', fontSize: '0.8rem', margin: '8px 0' }}>
                  {gameState.players.length}/4 игроков
                </p>
                <p style={{ color: '#a0b09a', fontSize: '0.7rem', margin: '6px 0' }}>
                  Правила: {rulesSummary}
                </p>
                <p style={{ color: '#4a5a4a', fontSize: '0.7rem', marginBottom: 12 }}>
                  Поделитесь ID: <strong style={{ color: '#a0b09a' }}>{roomId.slice(0, 8)}</strong>
                </p>
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  {gameState.players.length >= 2 && (
                    <button className="btn-primary" onClick={handleStartGame}>
                      🎮 Начать игру ({gameState.players.length} игроков)
                    </button>
                  )}
                  {isHost && (
                    <button className="btn-secondary px-3 py-2 rounded" onClick={() => setShowSettings(true)}>
                      ⚙ Настройки
                    </button>
                  )}
                  {isHost && gameState.players.length < 4 && (
                    <button className="btn-secondary px-3 py-2 rounded" onClick={() => onGameAction('add_bot')}>
                      🤖 Добавить бота
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Scoring phase */}
          {gameState.phase === 'scoring' && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="modal-box text-center" style={{ maxWidth: 280 }}>
                <h2 style={{ fontFamily: 'Playfair Display, serif', color: '#d4a843', fontSize: '1.3rem' }}>Кон завершён!</h2>
                <div className="my-4 space-y-2">
                  {[0, 1].map(t => (
                    <div key={t} className="flex justify-between" style={{ fontSize: '0.85rem' }}>
                      <span style={{ color: t === 0 ? '#93c5fd' : '#fca5a5' }}>Команда {t + 1}</span>
                      <span>{gameState.teams[t].roundPoints} очков • {gameState.teams[t].eyes} 👁</span>
                    </div>
                  ))}
                </div>
                {gameState.lastAction && (
                  <p style={{ color: '#d4a843', fontSize: '0.8rem', margin: '8px 0' }}>{gameState.lastAction}</p>
                )}
                {isHost && (
                  <button className="btn-primary mt-3" onClick={handleNextRound}>
                    ▶ Следующий кон
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Game finished */}
          {gameState.phase === 'finished' && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="modal-box text-center">
                <div style={{ fontSize: '3rem' }}>🏆</div>
                <h2 style={{ fontFamily: 'Playfair Display, serif', color: '#d4a843', fontSize: '1.8rem' }}>
                  {gameState.lastAction}
                </h2>
                <div className="my-4 space-y-2">
                  {[0, 1].map(t => (
                    <div key={t} className="flex justify-between" style={{ fontSize: '0.9rem' }}>
                      <span style={{ color: t === 0 ? '#93c5fd' : '#fca5a5' }}>Команда {t + 1}</span>
                      <span>{gameState.teams[t].eyes}/12 глаз</span>
                    </div>
                  ))}
                </div>
                {isHost && (
                  <button className="btn-primary mt-3" onClick={handleStartGame}>
                    🔄 Новая партия
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* My hand */}
        {gameState.phase === 'playing' && myHand.length > 0 && (
          <div className="px-4 pb-3">
            <div className="flex justify-center gap-1 flex-wrap">
              {myHand.map(card => (
                <CardComp
                  key={card.id}
                  card={card}
                  isValid={validCardIds.has(card.id)}
                  isSelected={selectedCard === card.id}
                  isDisabled={!isMyTurn || !validCardIds.has(card.id)}
                  onClick={() => handlePlayCard(card.id)}
                />
              ))}
            </div>
            {isMyTurn && (
              <p className="text-center text-xs mt-1" style={{ color: '#d4a843' }}>
                Ваш ход! {selectedCard ? 'Нажмите снова для подтверждения' : 'Выберите карту'}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Right sidebar: Video + Chat */}
      <div className={`game-sidebar flex flex-col gap-2 p-2 ${!showVideo && !showChat ? 'is-collapsed' : ''}`} style={{ background: 'rgba(0,0,0,0.3)' }}>
        <div className="sidebar-handle">
          <button className="btn-secondary text-xs px-2 py-1 rounded" onClick={() => { setShowVideo(false); setShowChat(false); }}>
            ⮜ Скрыть
          </button>
        </div>
        {showVideo && (
          <VideoChat
            roomId={roomId}
            playerId={playerId}
            players={gameState.players}
            isHost={isHost}
            onMutePlayer={(id, muted) => onModAction(muted ? 'mute' : 'unmute', id)}
            onBanPlayer={id => { if (confirm('Забанить игрока?')) onModAction('ban', id); }}
          />
        )}
        {showChat && (
          <div className="flex-1" style={{ minHeight: 0 }}>
            <Chat
              roomId={roomId}
              playerId={playerId}
              playerName={playerName}
              messages={messages}
              onSend={onSendChat}
              isMuted={myPlayer?.isMuted}
            />
          </div>
        )}
      </div>

      {!showVideo && !showChat && (
        <button
          className="sidebar-float btn-secondary text-xs px-3 py-2 rounded"
          onClick={() => { setShowVideo(true); setShowChat(true); }}
        >
          ⮞ Панель
        </button>
      )}

      {/* Mod modal */}
      {showMod && (
        <div className="modal-overlay" onClick={() => setShowMod(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3 style={{ color: '#d4a843', fontFamily: 'Playfair Display, serif', fontSize: '1.2rem' }}>Управление игроком</h3>
            {(() => {
              const target = gameState.players.find(p => p.id === showMod);
              if (!target) return null;
              return (
                <div className="mt-4 space-y-2">
                  <p style={{ color: '#a0b09a' }}>{target.name}</p>
                  <button
                    className="btn-secondary w-full py-2 rounded-lg text-sm"
                    onClick={() => { onModAction(target.isMuted ? 'unmute' : 'mute', showMod); setShowMod(null); }}
                  >
                    {target.isMuted ? '🔊 Размутить' : '🔇 Мутить в чате'}
                  </button>
                  <button
                    className="btn-danger btn-primary w-full py-2 rounded-lg text-sm"
                    onClick={() => { if (confirm(`Забанить ${target.name}?`)) { onModAction('ban', showMod); setShowMod(null); } }}
                  >
                    🚫 Забанить и исключить
                  </button>
                </div>
              );
            })()}
            <button className="btn-secondary w-full mt-3 py-2 rounded-lg text-sm" onClick={() => setShowMod(null)}>Отмена</button>
          </div>
        </div>
      )}

      {/* Rules modal */}
      {showRules && (
        <div className="modal-overlay" onClick={() => setShowRules(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 500, maxHeight: '80vh', overflowY: 'auto' }}>
            <h2 style={{ fontFamily: 'Playfair Display, serif', color: '#d4a843', fontSize: '1.5rem', marginBottom: 12 }}>Правила Белки</h2>
            <div style={{ fontSize: '0.82rem', lineHeight: 1.6, color: '#c0d0c0' }}>
              <p><strong style={{ color: '#d4a843' }}>Колода:</strong> 36 карт (с семёрками) или 32 (без)</p>
              <p><strong style={{ color: '#d4a843' }}>Команды:</strong> Сидящие напротив — одна команда</p>
              <p><strong style={{ color: '#d4a843' }}>Козыри:</strong></p>
              <ul style={{ marginLeft: 16 }}>
                <li>Постоянные козыри — Валеты: ♣В &gt; ♠В &gt; ♥В &gt; ♦В</li>
                <li>Козырная масть — назначается каждый кон тем, у кого ♣В</li>
              </ul>
              <p><strong style={{ color: '#d4a843' }}>Номинал карт:</strong> Туз=11, 10=10, Король=4, Дама=3, Валет=2</p>
              <p><strong style={{ color: '#d4a843' }}>Победа в коне:</strong> Команда с &gt;60 очков открывает "глаза"</p>
              <p><strong style={{ color: '#d4a843' }}>Победа в партии:</strong> 12 глаз!</p>
              <p><strong style={{ color: '#d4a843' }}>Яйца:</strong> По 60 очков — глаза удваиваются следующий кон</p>
            </div>
            <button className="btn-primary mt-4 w-full" onClick={() => setShowRules(false)}>Понятно!</button>
          </div>
        </div>
      )}

      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <h2 style={{ fontFamily: 'Playfair Display, serif', color: '#d4a843', fontSize: '1.5rem', marginBottom: 16 }}>
              Настройки игры
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg settings-tile">
                <div style={{ fontSize: '0.8rem', color: '#a0b09a', marginBottom: 6 }}>Семёрки</div>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={rulesDraft.withSevens} onChange={e => setRulesDraft(r => ({ ...r, withSevens: e.target.checked }))} />
                  <span>Играть с семёрками</span>
                </label>
              </div>
              <div className="p-3 rounded-lg settings-tile">
                <div style={{ fontSize: '0.8rem', color: '#a0b09a', marginBottom: 6 }}>Победа по глазам</div>
                <div className="flex gap-2">
                  {[12, 24].map(v => (
                    <button key={v} className={`btn-secondary px-3 py-1 rounded ${rulesDraft.winEyes === v ? 'btn-primary' : ''}`} onClick={() => setRulesDraft(r => ({ ...r, winEyes: v }))}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>
              <div className="p-3 rounded-lg settings-tile">
                <div style={{ fontSize: '0.8rem', color: '#a0b09a', marginBottom: 6 }}>Яйца</div>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={rulesDraft.eggsEnabled} onChange={e => setRulesDraft(r => ({ ...r, eggsEnabled: e.target.checked }))} />
                  <span>Удваивать следующий кон</span>
                </label>
              </div>
              <div className="p-3 rounded-lg settings-tile">
                <div style={{ fontSize: '0.8rem', color: '#a0b09a', marginBottom: 6 }}>Правило “Спас”</div>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={rulesDraft.saveEnabled} onChange={e => setRulesDraft(r => ({ ...r, saveEnabled: e.target.checked }))} />
                  <span>Включено</span>
                </label>
                <div className="mt-2">
                  <input
                    type="number"
                    min={0}
                    max={60}
                    value={rulesDraft.saveThreshold}
                    onChange={e => setRulesDraft(r => ({ ...r, saveThreshold: Number(e.target.value) || 0 }))}
                    className="w-full px-2 py-1 rounded"
                    style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
                  />
                  <div style={{ fontSize: '0.7rem', color: '#6b7c6b' }}>Очки для “спаса”</div>
                </div>
              </div>
              <div className="p-3 rounded-lg settings-tile">
                <div style={{ fontSize: '0.8rem', color: '#a0b09a', marginBottom: 6 }}>Таймер хода</div>
                <input
                  type="number"
                  min={0}
                  max={120}
                  value={rulesDraft.turnTimerSec}
                  onChange={e => setRulesDraft(r => ({ ...r, turnTimerSec: Number(e.target.value) || 0 }))}
                  className="w-full px-2 py-1 rounded"
                  style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
                />
                <div style={{ fontSize: '0.7rem', color: '#6b7c6b' }}>0 = без таймера</div>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button className="btn-secondary w-full" onClick={() => setShowSettings(false)}>Отмена</button>
              <button className="btn-primary w-full" onClick={handleSaveRules}>Сохранить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
