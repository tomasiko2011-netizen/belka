import { NextRequest, NextResponse } from 'next/server';
import { pusherServer } from '@/lib/pusher';
import { verifyPlayer } from '@/lib/player-token';

// WebRTC signaling through Pusher
export async function POST(req: NextRequest) {
  try {
    const { type, from, fromToken, to, signal, roomId } = await req.json();
    if (!verifyPlayer(from, fromToken)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Send signal to specific player's private channel
    await pusherServer.trigger(`private-player-${to}`, `video-${type}`, {
      from,
      signal,
      roomId,
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Signal failed' }, { status: 500 });
  }
}
