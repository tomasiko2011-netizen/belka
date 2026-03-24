'use client';

import { useEffect, useState } from 'react';

type LeaderboardRow = {
  userId: string;
  name: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  eyes: number;
  updatedAt: number;
};

export default function LeaderboardPage() {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/leaderboard');
        const data = await res.json();
        setRows(data.leaderboard || []);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'radial-gradient(ellipse at center, #1a3d22 0%, #0a1f0d 100%)' }}>
      <div className="w-full max-w-2xl modal-box">
        <div className="flex items-center justify-between mb-4">
          <h1 style={{ fontFamily: 'Playfair Display, serif', color: '#d4a843', fontSize: '2rem' }}>🏆 Топ игроков</h1>
          <a className="btn-secondary px-3 py-1 rounded text-sm" href="/">← В лобби</a>
        </div>

        {loading ? (
          <p style={{ color: '#a0b09a' }}>Загрузка...</p>
        ) : rows.length === 0 ? (
          <p style={{ color: '#a0b09a' }}>Пока нет результатов</p>
        ) : (
          <div className="space-y-2">
            {rows.map((row, i) => (
              <div key={row.userId} className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="flex items-center gap-3">
                  <div style={{ width: 28, height: 28, borderRadius: 14, background: 'rgba(212,168,67,0.2)', color: '#d4a843', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                    {i + 1}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700 }}>{row.name}</div>
                    <div style={{ color: '#6b7c6b', fontSize: '0.75rem' }}>Игр: {row.gamesPlayed}</div>
                  </div>
                </div>
                <div className="text-right" style={{ fontSize: '0.85rem' }}>
                  <div>Победы: <strong style={{ color: '#93c5fd' }}>{row.wins}</strong></div>
                  <div>Поражения: <strong style={{ color: '#fca5a5' }}>{row.losses}</strong></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
