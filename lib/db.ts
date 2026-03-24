import { createClient } from '@libsql/client';
import { GameState, ChatMessage, Room } from './types';

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

let schemaReady: Promise<void> | null = null;

async function ensureSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      await db.executeMultiple(`
        CREATE TABLE IF NOT EXISTS player_stats (
          user_id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          games_played INTEGER DEFAULT 0,
          wins INTEGER DEFAULT 0,
          losses INTEGER DEFAULT 0,
          eyes INTEGER DEFAULT 0,
          updated_at INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_player_stats_wins ON player_stats(wins);
        CREATE INDEX IF NOT EXISTS idx_player_stats_updated ON player_stats(updated_at);
      `);

      try {
        await db.execute({ sql: `ALTER TABLE players ADD COLUMN user_id TEXT`, args: [] });
      } catch {}
      try {
        await db.execute({ sql: `ALTER TABLE players ADD COLUMN is_bot INTEGER DEFAULT 0`, args: [] });
      } catch {}
    })();
  }
  return schemaReady;
}

export async function initDb() {
  await ensureSchema();
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      host_id TEXT NOT NULL,
      game_state TEXT NOT NULL,
      is_started INTEGER DEFAULT 0,
      with_sevens INTEGER DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      name TEXT NOT NULL,
      seat_index INTEGER,
      is_ready INTEGER DEFAULT 0,
      is_banned INTEGER DEFAULT 0,
      is_muted INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (room_id) REFERENCES rooms(id)
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      player_id TEXT NOT NULL,
      player_name TEXT NOT NULL,
      text TEXT NOT NULL,
      type TEXT DEFAULT 'chat',
      timestamp INTEGER NOT NULL,
      FOREIGN KEY (room_id) REFERENCES rooms(id)
    );

    CREATE INDEX IF NOT EXISTS idx_players_room ON players(room_id);
    CREATE INDEX IF NOT EXISTS idx_chat_room ON chat_messages(room_id);
    CREATE INDEX IF NOT EXISTS idx_rooms_created ON rooms(created_at);
  `);
}

// ─── Room Operations ──────────────────────────────────────────────────────────

export async function createRoom(room: {
  id: string;
  name: string;
  hostId: string;
  gameState: GameState;
  withSevens: boolean;
}): Promise<void> {
  await db.execute({
    sql: `INSERT INTO rooms (id, name, host_id, game_state, with_sevens, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [
      room.id,
      room.name,
      room.hostId,
      JSON.stringify(room.gameState),
      room.withSevens ? 1 : 0,
      Date.now(),
      Date.now(),
    ],
  });
}

export async function getRoom(roomId: string): Promise<Room | null> {
  await ensureSchema();
  const result = await db.execute({
    sql: `SELECT r.*, 
          (SELECT json_group_array(json_object(
            'id', p.id, 'userId', p.user_id, 'name', p.name, 'seatIndex', p.seat_index, 'isBot', p.is_bot,
            'isReady', p.is_ready, 'isBanned', p.is_banned, 'isMuted', p.is_muted
          )) FROM players p WHERE p.room_id = r.id AND p.is_banned = 0) as players_json
          FROM rooms r WHERE r.id = ?`,
    args: [roomId],
  });

  if (result.rows.length === 0) return null;
  const row = result.rows[0];

  return {
    id: row.id as string,
    name: row.name as string,
    hostId: row.host_id as string,
    players: JSON.parse((row.players_json as string) || '[]'),
    gameState: JSON.parse(row.game_state as string),
    isStarted: row.is_started === 1,
    withSevens: row.with_sevens === 1,
    maxPlayers: 4,
    createdAt: row.created_at as number,
  };
}

export async function updateGameState(roomId: string, gameState: GameState): Promise<void> {
  await db.execute({
    sql: `UPDATE rooms SET game_state = ?, updated_at = ? WHERE id = ?`,
    args: [JSON.stringify(gameState), Date.now(), roomId],
  });
}

export async function setRoomStarted(roomId: string): Promise<void> {
  await db.execute({
    sql: `UPDATE rooms SET is_started = 1, updated_at = ? WHERE id = ?`,
    args: [Date.now(), roomId],
  });
}

export async function listRooms(): Promise<Array<{
  id: string; name: string; playerCount: number; isStarted: boolean; createdAt: number;
}>> {
  await ensureSchema();
  const result = await db.execute({
    sql: `
      SELECT r.id, r.name, r.is_started, r.created_at,
             COUNT(p.id) as player_count
      FROM rooms r
      LEFT JOIN players p ON p.room_id = r.id AND p.is_banned = 0
      WHERE r.created_at > ?
      GROUP BY r.id
      ORDER BY r.created_at DESC
      LIMIT 20
    `,
    args: [Date.now() - 24 * 60 * 60 * 1000], // Last 24h
  });

  return result.rows.map(row => ({
    id: row.id as string,
    name: row.name as string,
    playerCount: row.player_count as number,
    isStarted: row.is_started === 1,
    createdAt: row.created_at as number,
  }));
}

// ─── Player Operations ────────────────────────────────────────────────────────

export async function addPlayer(player: {
  id: string;
  userId?: string;
  roomId: string;
  name: string;
  seatIndex: number;
  isBot?: boolean;
}): Promise<void> {
  await ensureSchema();
  await db.execute({
    sql: `INSERT OR REPLACE INTO players (id, user_id, room_id, name, seat_index, is_bot, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [
      player.id,
      player.userId ?? null,
      player.roomId,
      player.name,
      player.seatIndex,
      player.isBot ? 1 : 0,
      Date.now(),
    ],
  });
}

export async function updatePlayer(playerId: string, updates: { name?: string; isBot?: boolean; userId?: string | null }) {
  await ensureSchema();
  const fields: string[] = [];
  const args: any[] = [];

  if (updates.name !== undefined) { fields.push('name = ?'); args.push(updates.name); }
  if (updates.userId !== undefined) { fields.push('user_id = ?'); args.push(updates.userId); }
  if (updates.isBot !== undefined) { fields.push('is_bot = ?'); args.push(updates.isBot ? 1 : 0); }

  if (fields.length === 0) return;
  args.push(playerId);

  await db.execute({
    sql: `UPDATE players SET ${fields.join(', ')} WHERE id = ?`,
    args,
  });
}

export async function removePlayer(playerId: string) {
  await ensureSchema();
  await db.execute({
    sql: `DELETE FROM players WHERE id = ?`,
    args: [playerId],
  });
}

export async function updateRoomHost(roomId: string, hostId: string) {
  await ensureSchema();
  await db.execute({
    sql: `UPDATE rooms SET host_id = ?, updated_at = ? WHERE id = ?`,
    args: [hostId, Date.now(), roomId],
  });
}

export async function recordGameResult(players: Array<{ userId?: string; name: string; teamId: 0 | 1 }>, winnerTeam: 0 | 1) {
  await ensureSchema();
  const now = Date.now();
  for (const p of players) {
    if (!p.userId) continue;
    const won = p.teamId === winnerTeam;
    await db.execute({
      sql: `
        INSERT INTO player_stats (user_id, name, games_played, wins, losses, eyes, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          name = excluded.name,
          games_played = player_stats.games_played + 1,
          wins = player_stats.wins + ?,
          losses = player_stats.losses + ?,
          eyes = player_stats.eyes + ?,
          updated_at = excluded.updated_at
      `,
      args: [
        p.userId,
        p.name,
        1,
        won ? 1 : 0,
        won ? 0 : 1,
        0,
        now,
        won ? 1 : 0,
        won ? 0 : 1,
        0,
      ],
    });
  }
}

export async function getLeaderboard(limit = 10) {
  await ensureSchema();
  const result = await db.execute({
    sql: `
      SELECT user_id, name, games_played, wins, losses, eyes, updated_at
      FROM player_stats
      ORDER BY wins DESC, eyes DESC, games_played DESC
      LIMIT ?
    `,
    args: [limit],
  });
  return result.rows.map(row => ({
    userId: row.user_id as string,
    name: row.name as string,
    gamesPlayed: row.games_played as number,
    wins: row.wins as number,
    losses: row.losses as number,
    eyes: row.eyes as number,
    updatedAt: row.updated_at as number,
  }));
}

export async function updatePlayerBan(playerId: string, isBanned: boolean): Promise<void> {
  await db.execute({
    sql: `UPDATE players SET is_banned = ? WHERE id = ?`,
    args: [isBanned ? 1 : 0, playerId],
  });
}

export async function updatePlayerMute(playerId: string, isMuted: boolean): Promise<void> {
  await db.execute({
    sql: `UPDATE players SET is_muted = ? WHERE id = ?`,
    args: [isMuted ? 1 : 0, playerId],
  });
}

// ─── Chat Operations ──────────────────────────────────────────────────────────

export async function saveMessage(msg: ChatMessage & { roomId: string }): Promise<void> {
  await db.execute({
    sql: `INSERT INTO chat_messages (id, room_id, player_id, player_name, text, type, timestamp)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [msg.id, msg.roomId, msg.playerId, msg.playerName, msg.text, msg.type, msg.timestamp],
  });
}

export async function getChatHistory(roomId: string, limit = 50): Promise<ChatMessage[]> {
  const result = await db.execute({
    sql: `SELECT * FROM chat_messages WHERE room_id = ? ORDER BY timestamp DESC LIMIT ?`,
    args: [roomId, limit],
  });

  return result.rows.reverse().map(row => ({
    id: row.id as string,
    playerId: row.player_id as string,
    playerName: row.player_name as string,
    text: row.text as string,
    type: row.type as 'chat' | 'system' | 'game',
    timestamp: row.timestamp as number,
  }));
}

export { db };
