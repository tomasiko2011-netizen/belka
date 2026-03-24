import { NextRequest, NextResponse } from 'next/server';
import { pusherServer } from '@/lib/pusher';

// WebRTC signaling through Pusher
export async function POST(req: NextRequest) {
  try {
    const { type, from, to, signal, roomId } = await req.json();

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
