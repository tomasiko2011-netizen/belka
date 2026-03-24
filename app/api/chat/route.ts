import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { saveMessage, getChatHistory, getRoom } from '@/lib/db';
import { pusherServer, roomChannel, EVENTS } from '@/lib/pusher';
import { ChatMessage } from '@/lib/types';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const roomId = searchParams.get('roomId');
  if (!roomId) return NextResponse.json({ error: 'Missing roomId' }, { status: 400 });

  const messages = await getChatHistory(roomId);
  return NextResponse.json({ messages });
}

export async function POST(req: NextRequest) {
  try {
    const { roomId, playerId, playerName, text } = await req.json();

    if (!text?.trim()) return NextResponse.json({ error: 'Empty message' }, { status: 400 });
    if (text.length > 500) return NextResponse.json({ error: 'Message too long' }, { status: 400 });

    // Check if player is muted
    const room = await getRoom(roomId);
    if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

    const player = room.players.find(p => p.id === playerId);
    if (player?.isMuted) {
      return NextResponse.json({ error: 'You are muted' }, { status: 403 });
    }

    const message: ChatMessage = {
      id: uuidv4(),
      playerId,
      playerName,
      text: text.trim(),
      timestamp: Date.now(),
      type: 'chat',
    };

    await saveMessage({ ...message, roomId });

    await pusherServer.trigger(roomChannel(roomId), EVENTS.CHAT_MESSAGE, message);

    return NextResponse.json({ success: true, message });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}
