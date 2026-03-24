#!/usr/bin/env node
/*
  API playthrough: create room, join 3 players, start game, play some turns.
  Usage: BASE_URL=https://belka.truest.kz node scripts/api-playthrough.js 2
*/

const BASE_URL = (process.env.BASE_URL || 'https://belka.truest.kz').replace(/\/$/, '');

async function api(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok) {
    throw new Error(`${path} ${res.status}: ${data.error || text}`);
  }
  return data;
}

async function getState(roomId, playerId) {
  return api(`/api/game/state?roomId=${roomId}&playerId=${playerId}`, { method: 'GET' });
}

async function startGame(roomId, playerId) {
  return api('/api/game/action', {
    method: 'POST',
    body: JSON.stringify({ roomId, playerId, action: 'start_game' }),
  });
}

async function playCard(roomId, playerId, cardId) {
  return api('/api/game/action', {
    method: 'POST',
    body: JSON.stringify({ roomId, playerId, action: 'play_card', cardId }),
  });
}

async function brutePlayTurn(roomId, playerId) {
  const state = await getState(roomId, playerId);
  const hand = state.hand || [];
  for (const c of hand) {
    try {
      await playCard(roomId, playerId, c.id);
      return true;
    } catch (e) {
      // try next card
    }
  }
  return false;
}

async function runOnce(index) {
  const host = await api('/api/rooms', {
    method: 'POST',
    body: JSON.stringify({ name: `Test Room ${index}`, playerName: `Host${index}`, withSevens: true }),
  });

  const roomId = host.roomId;
  const players = [
    { id: host.playerId, name: `Host${index}` },
  ];

  for (let i = 2; i <= 4; i += 1) {
    const join = await api('/api/rooms', {
      method: 'PUT',
      body: JSON.stringify({ roomId, playerName: `P${index}-${i}` }),
    });
    players.push({ id: join.playerId, name: `P${index}-${i}` });
  }

  await startGame(roomId, players[0].id);

  // Play 20 turns max
  for (let turn = 0; turn < 20; turn += 1) {
    const state = await getState(roomId, players[0].id);
    if (state.gameState.phase !== 'playing') {
      return { roomId, phase: state.gameState.phase, turn };
    }
    const currentIndex = state.gameState.currentPlayerIndex;
    const current = players.find(p => p.id === state.gameState.players[currentIndex].id);
    if (!current) {
      throw new Error('Current player not found in list');
    }
    const ok = await brutePlayTurn(roomId, current.id);
    if (!ok) {
      throw new Error(`Could not play any card for ${current.name}`);
    }
  }

  return { roomId, phase: 'playing', turn: 20 };
}

async function main() {
  const runs = Number(process.argv[2] || 2);
  for (let i = 1; i <= runs; i += 1) {
    const result = await runOnce(i);
    console.log(`Run ${i}: room=${result.roomId} phase=${result.phase} after ${result.turn} turns`);
  }
}

main().catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
