import { NextRequest, NextResponse } from 'next/server';
import { getRoom, updateGameState } from '@/lib/db';
import { createInitialGameState, autoPlayTimeout } from '@/lib/game-engine';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const roomId = searchParams.get('roomId');
  const playerId = searchParams.get('playerId');

  if (!roomId || !playerId) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 });
  }

  const room = await getRoom(roomId);
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

  let gameState = room.gameState ?? createInitialGameState(roomId, room.hostId, room.withSevens);

  if (gameState.phase === 'waiting' && gameState.players.length !== room.players.length) {
    gameState = {
      ...gameState,
      players: room.players.map(p => ({
        id: p.id,
        userId: p.userId,
        name: p.name,
        seatIndex: p.seatIndex,
        teamId: (p.seatIndex % 2 === 0 ? 0 : 1) as 0 | 1,
        hand: [],
        isBot: p.isBot ?? false,
        isConnected: true,
        videoEnabled: false,
        audioEnabled: false,
        isMuted: p.isMuted,
        isBanned: p.isBanned,
      })),
    };
    await updateGameState(roomId, gameState);
  }

  // Auto-play on timeout (safety loop)
  let safety = 0;
  while (safety < 4) {
    const { state: next, didPlay } = autoPlayTimeout(gameState);
    if (!didPlay) break;
    gameState = next;
    safety += 1;
  }
  if (safety > 0) {
    await updateGameState(roomId, gameState);
  }
  const isHost = room.hostId === playerId;

  // Find player's hand
  const player = gameState.players.find(p => p.id === playerId);
  const hand = player?.hand || [];

  // Return state without other players' hands
  const publicState = {
    ...gameState,
    players: gameState.players.map(p => ({ ...p, hand: [] })),
  };

  return NextResponse.json({
    gameState: publicState,
    hand,
    isHost,
    roomName: room.name,
  });
}
