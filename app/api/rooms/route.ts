import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { createRoom, getRoom, listRooms, addPlayer, updateGameState } from '@/lib/db';
import { createInitialGameState } from '@/lib/game-engine';
import { pusherServer, roomChannel, EVENTS } from '@/lib/pusher';

export async function GET() {
  try {
    const rooms = await listRooms();
    return NextResponse.json({ rooms });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to list rooms' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, playerName, withSevens = true, userId } = await req.json();
    const roomId = uuidv4();
    const playerId = uuidv4();

    const gameState = createInitialGameState(roomId, playerId, withSevens);

    await createRoom({
      id: roomId,
      name: name || `Комната ${roomId.slice(0, 6)}`,
      hostId: playerId,
      gameState,
      withSevens,
    });

    await addPlayer({
      id: playerId,
      userId,
      roomId,
      name: playerName || 'Игрок 1',
      seatIndex: 0,
    });

    // Hydrate game state with the host player for waiting screen
    await updateGameState(roomId, {
      ...gameState,
      players: [{
        id: playerId,
        userId,
        name: playerName || 'Игрок 1',
        seatIndex: 0,
        teamId: 0,
        hand: [],
        isBot: false,
        isConnected: true,
        videoEnabled: false,
        audioEnabled: false,
        isMuted: false,
        isBanned: false,
      }],
    });

    return NextResponse.json({ roomId, playerId });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to create room' }, { status: 500 });
  }
}

// Join room
export async function PUT(req: NextRequest) {
  try {
    const { roomId, playerName, userId } = await req.json();
    const room = await getRoom(roomId);
    if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

    const takenSeats = room.players.map(p => p.seatIndex);
    const allSeats = [0, 1, 2, 3];
    const freeSeats = allSeats.filter(s => !takenSeats.includes(s));
    if (freeSeats.length === 0) {
      return NextResponse.json({ error: 'Room is full' }, { status: 400 });
    }

    const playerId = uuidv4();
    const seatIndex = freeSeats[0];

    await addPlayer({ id: playerId, userId, roomId, name: playerName || `Игрок ${seatIndex + 1}`, seatIndex });

    // Refresh game state players list for waiting screen
    const updatedRoom = await getRoom(roomId);
    if (updatedRoom?.gameState) {
      await updateGameState(roomId, {
        ...updatedRoom.gameState,
        players: updatedRoom.players.map(p => ({
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
      });
    }

    // Notify others (non-fatal)
    try {
      await pusherServer.trigger(roomChannel(roomId), EVENTS.PLAYER_JOINED, {
        playerId,
        playerName,
        seatIndex,
      });
    } catch (e) {
      console.error('Pusher PLAYER_JOINED failed', e);
    }

    return NextResponse.json({ roomId, playerId, seatIndex });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to join room' }, { status: 500 });
  }
}
