import Pusher from 'pusher';
import PusherClient from 'pusher-js';

// Server-side Pusher
export const pusherServer = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  useTLS: true,
});

// Client-side Pusher
export function getPusherClient(authHeaders?: Record<string, string>): PusherClient {
  return new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    authEndpoint: '/api/pusher/auth',
    auth: authHeaders ? { headers: authHeaders } : undefined,
  });
}

// Channel name helpers
export const roomChannel = (roomId: string) => `presence-room-${roomId}`;
export const privateChannel = (playerId: string) => `private-player-${playerId}`;

// Event names
export const EVENTS = {
  // Game events
  GAME_STATE: 'game-state',
  GAME_STARTED: 'game-started',
  ROUND_START: 'round-start',
  CARD_PLAYED: 'card-played',
  TRICK_COMPLETE: 'trick-complete',
  ROUND_OVER: 'round-over',
  GAME_OVER: 'game-over',

  // Player events
  PLAYER_JOINED: 'player-joined',
  PLAYER_LEFT: 'player-left',
  PLAYER_READY: 'player-ready',

  // Chat events
  CHAT_MESSAGE: 'chat-message',

  // Video signaling
  VIDEO_OFFER: 'video-offer',
  VIDEO_ANSWER: 'video-answer',
  VIDEO_ICE: 'video-ice-candidate',
  VIDEO_TOGGLE: 'video-toggle',

  // Moderation
  MOD_ACTION: 'mod-action',
};
