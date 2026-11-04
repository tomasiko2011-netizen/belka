import { NextRequest, NextResponse } from 'next/server';
import { pusherServer } from '@/lib/pusher';
import { verifyPlayer } from '@/lib/player-token';

export async function POST(req: NextRequest) {
  const body = await req.text();
  const params = new URLSearchParams(body);
  const socketId = params.get('socket_id')!;
  const channelName = params.get('channel_name')!;

  // Подписка только своим проверенным id: иначе можно слушать private-player-<чужой id> и видеть чужие карты
  const playerId = req.headers.get('x-player-id');
  if (!verifyPlayer(playerId, req.headers.get('x-player-token'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
  if (channelName.startsWith('private-player-') && channelName !== `private-player-${playerId}`) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // For presence channels, get player info from headers
  const playerData = {
    user_id: playerId as string,
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
