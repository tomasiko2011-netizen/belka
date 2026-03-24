import { NextRequest, NextResponse } from 'next/server';
import { pusherServer } from '@/lib/pusher';

export async function POST(req: NextRequest) {
  const body = await req.text();
  const params = new URLSearchParams(body);
  const socketId = params.get('socket_id')!;
  const channelName = params.get('channel_name')!;

  // For presence channels, get player info from headers
  const playerData = {
    user_id: req.headers.get('x-player-id') || socketId,
    user_info: {
      name: req.headers.get('x-player-name') || 'Anonymous',
    },
  };

  try {
    const auth = pusherServer.authorizeChannel(socketId, channelName, playerData);
    return NextResponse.json(auth);
  } catch (e) {
    return NextResponse.json({ error: 'Auth failed' }, { status: 403 });
  }
}
