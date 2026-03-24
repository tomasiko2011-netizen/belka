import { NextRequest, NextResponse } from 'next/server';
import { getRoom, updatePlayerBan, updatePlayerMute } from '@/lib/db';
import { pusherServer, roomChannel, EVENTS } from '@/lib/pusher';

export async function POST(req: NextRequest) {
  try {
    const { roomId, moderatorId, targetPlayerId, action } = await req.json();

    const room = await getRoom(roomId);
    if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

    // Only host can moderate
    if (room.hostId !== moderatorId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // Can't moderate yourself
    if (targetPlayerId === moderatorId) {
      return NextResponse.json({ error: 'Cannot moderate yourself' }, { status: 400 });
    }

    switch (action) {
      case 'ban':
        await updatePlayerBan(targetPlayerId, true);
        break;
      case 'unban':
        await updatePlayerBan(targetPlayerId, false);
        break;
      case 'mute':
        await updatePlayerMute(targetPlayerId, true);
        break;
      case 'unmute':
        await updatePlayerMute(targetPlayerId, false);
        break;
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    // Broadcast mod action to all players in room
    await pusherServer.trigger(roomChannel(roomId), EVENTS.MOD_ACTION, {
      type: action,
      targetPlayerId,
      moderatorId,
    });

    // If banned, disconnect player
    if (action === 'ban') {
      await pusherServer.trigger(`private-player-${targetPlayerId}`, 'banned', {
        reason: 'You have been banned from this room.',
      });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Moderation failed' }, { status: 500 });
  }
}
