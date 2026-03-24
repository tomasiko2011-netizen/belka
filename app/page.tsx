'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface RoomInfo {
  id: string;
  name: string;
  playerCount: number;
  isStarted: boolean;
  createdAt: number;
}

export default function LobbyPage() {
  const router = useRouter();
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [playerName, setPlayerName] = useState('');
  const [roomName, setRoomName] = useState('');
  const [withSevens, setWithSevens] = useState(true);
  const [showVideoDefault, setShowVideoDefault] = useState(true);
  const [joinRoomId, setJoinRoomId] = useState('');
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'create' | 'join'>('create');
  const [error, setError] = useState('');

  useEffect(() => {
    // Load saved name
    const saved = localStorage.getItem('belka_player_name');
    if (saved) setPlayerName(saved);
    const v = localStorage.getItem('belka_show_video');
    if (v === '0') setShowVideoDefault(false);
    // Ensure persistent user id for рейтинга
    let uid = localStorage.getItem('belka_user_id');
    if (!uid) {
      const newUid = (crypto as any).randomUUID ? (crypto as any).randomUUID() : `${Date.now()}-${Math.random()}`;
      localStorage.setItem('belka_user_id', newUid);
      uid = newUid;
    }
    fetchRooms();
    const interval = setInterval(fetchRooms, 5000);
    return () => clearInterval(interval);
  }, []);

  async function fetchRooms() {
    try {
      const res = await fetch('/api/rooms');
      const data = await res.json();
      setRooms(data.rooms || []);
    } catch {}
  }

  function saveName(name: string) {
    setPlayerName(name);
    localStorage.setItem('belka_player_name', name);
  }

  function saveVideoPref(next: boolean) {
    setShowVideoDefault(next);
    localStorage.setItem('belka_show_video', next ? '1' : '0');
  }

  async function createRoom() {
    if (!playerName.trim()) { setError('Введите ваше имя'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: roomName || `Комната ${playerName}`,
          playerName: playerName.trim(),
          withSevens,
          userId: localStorage.getItem('belka_user_id'),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      localStorage.setItem('belka_player_id', data.playerId);
      localStorage.setItem('belka_player_name', playerName.trim());
      router.push(`/game/${data.roomId}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function joinRoom(id: string) {
    if (!playerName.trim()) { setError('Введите ваше имя'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/rooms', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: id, playerName: playerName.trim(), userId: localStorage.getItem('belka_user_id') }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      localStorage.setItem('belka_player_id', data.playerId);
      localStorage.setItem('belka_player_name', playerName.trim());
      router.push(`/game/${id}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ background: 'radial-gradient(ellipse at center, #1a3d22 0%, #0a1f0d 100%)' }}>
      {/* Header */}
      <div className="text-center mb-8">
        <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: '4rem', color: '#d4a843', textShadow: '0 0 30px rgba(212,168,67,0.3)', lineHeight: 1 }} className="mb-2">
          🐿️ БЕЛКА
        </h1>
        <p style={{ color: '#a0b09a', fontSize: '1rem' }}>Казахстанская карточная игра онлайн</p>
        <div className="mt-4 flex items-center justify-center gap-2">
          <a className="btn-primary px-4 py-2 rounded" href="/download">Скачать приложение</a>
          <a className="btn-secondary px-4 py-2 rounded" href="/">Играть в браузере</a>
        </div>
      </div>

      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left panel: Create / Join */}
        <div className="modal-box">
          {/* Name input */}
          <div className="mb-5">
            <label className="block text-sm mb-1" style={{ color: '#a0b09a' }}>Ваше имя</label>
            <input
              className="w-full px-3 py-2 rounded-lg text-white"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(212,168,67,0.3)', outline: 'none' }}
              placeholder="Введите имя..."
              value={playerName}
              onChange={e => saveName(e.target.value)}
              maxLength={20}
            />
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-5">
            {(['create', 'join'] as const).map(t => (
              <button
                key={t}
                className={`flex-1 py-2 rounded-lg font-semibold text-sm transition-all ${tab === t ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setTab(t)}
              >
                {t === 'create' ? '+ Создать комнату' : '🚪 Войти по ID'}
              </button>
            ))}
          </div>

          {tab === 'create' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm mb-1" style={{ color: '#a0b09a' }}>Название комнаты</label>
                <input
                  className="w-full px-3 py-2 rounded-lg text-white"
                  style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(212,168,67,0.3)', outline: 'none' }}
                  placeholder={`Комната ${playerName || 'игрока'}`}
                  value={roomName}
                  onChange={e => setRoomName(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-3">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={withSevens} onChange={e => setWithSevens(e.target.checked)} className="sr-only peer" />
                  <div className="w-10 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-600"></div>
                </label>
                <span className="text-sm" style={{ color: '#a0b09a' }}>Играть с семёрками (36 карт)</span>
              </div>
              <div className="flex items-center gap-3">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={showVideoDefault} onChange={e => saveVideoPref(e.target.checked)} className="sr-only peer" />
                  <div className="w-10 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-600"></div>
                </label>
                <span className="text-sm" style={{ color: '#a0b09a' }}>Видео по умолчанию</span>
              </div>
              <button
                className="btn-primary w-full py-3"
                onClick={createRoom}
                disabled={loading}
              >
                {loading ? '⌛ Создание...' : '🎮 Создать и играть'}
              </button>
            </div>
          )}

          {tab === 'join' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm mb-1" style={{ color: '#a0b09a' }}>ID комнаты</label>
                <input
                  className="w-full px-3 py-2 rounded-lg text-white"
                  style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(212,168,67,0.3)', outline: 'none' }}
                  placeholder="Вставьте ID комнаты..."
                  value={joinRoomId}
                  onChange={e => setJoinRoomId(e.target.value)}
                />
              </div>
              <button
                className="btn-primary w-full py-3"
                onClick={() => joinRoom(joinRoomId)}
                disabled={loading || !joinRoomId}
              >
                {loading ? '⌛ Подключение...' : '🚀 Войти в комнату'}
              </button>
            </div>
          )}

          {error && (
            <p className="mt-3 text-sm text-center" style={{ color: '#e74c3c' }}>⚠️ {error}</p>
          )}

          <div className="mt-4 text-xs" style={{ color: '#a0b09a' }}>
            Правила по умолчанию: 12 глаз, семёрки включены, яйца включены, спас 30, таймер 0с
          </div>
        </div>

        {/* Right panel: Room list */}
        <div className="modal-box">
          <div className="flex items-center justify-between mb-4">
            <h2 style={{ fontFamily: 'Playfair Display, serif', color: '#d4a843', fontSize: '1.3rem' }}>
              🎴 Активные комнаты
            </h2>
            <a className="btn-secondary px-2 py-1 rounded text-xs" href="/leaderboard">🏆 Топ</a>
          </div>
          {rooms.length === 0 ? (
            <div className="text-center py-8" style={{ color: '#6b7c6b' }}>
              <div style={{ fontSize: '3rem' }}>🃏</div>
              <p className="mt-2 text-sm">Нет активных комнат</p>
              <p className="text-xs mt-1">Создайте первую!</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {rooms.map(room => (
                <div
                  key={room.id}
                  className="flex items-center justify-between p-3 rounded-lg"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <div>
                    <p className="font-semibold text-sm">{room.name}</p>
                    <p className="text-xs" style={{ color: '#6b7c6b' }}>
                      {room.playerCount}/4 игроков
                      {room.isStarted && ' · Игра идёт'}
                    </p>
                  </div>
                  <button
                    className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all ${
                      room.playerCount >= 4 || room.isStarted
                        ? 'btn-secondary opacity-50 cursor-not-allowed'
                        : 'btn-primary'
                    }`}
                    onClick={() => !room.isStarted && room.playerCount < 4 && joinRoom(room.id)}
                    disabled={room.playerCount >= 4 || room.isStarted}
                  >
                    {room.isStarted ? 'Идёт игра' : room.playerCount >= 4 ? 'Полная' : 'Войти'}
                  </button>
                </div>
              ))}
            </div>
          )}
          <button
            onClick={fetchRooms}
            className="btn-secondary w-full mt-4 py-2 text-sm rounded-lg"
          >
            🔄 Обновить
          </button>
        </div>
      </div>

      {/* Rules summary */}
      <div className="mt-8 max-w-2xl text-center" style={{ color: '#6b7c6b', fontSize: '0.8rem' }}>
        <p>🃏 Белка — командная карточная игра для 4 игроков. Команды: сидящие напротив. Валеты — постоянные козыри (♣&gt;♠&gt;♥&gt;♦). Набери 12 глаз — победи!</p>
      </div>
    </div>
  );
}
