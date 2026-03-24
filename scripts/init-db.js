#!/usr/bin/env node
/**
 * Run: node scripts/init-db.js
 * Initializes the Turso database schema.
 * Requires TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in .env.local
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@libsql/client');

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function init() {
  console.log('🔧 Initializing Belka database...');
  
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

  console.log('✅ Database initialized successfully!');
  process.exit(0);
}

init().catch(e => {
  console.error('❌ Error:', e.message);
  process.exit(1);
});
