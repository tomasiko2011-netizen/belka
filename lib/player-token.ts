import crypto from 'crypto';

// Токен игрока = HMAC(секрет, playerId). playerId виден всем в gameState, токен знает только сам игрок.
function secret() {
  const s = process.env.PLAYER_TOKEN_SECRET || process.env.PUSHER_SECRET;
  if (!s) throw new Error('PLAYER_TOKEN_SECRET is not set');
  return s;
}

export function signPlayer(playerId: string): string {
  return crypto.createHmac('sha256', secret()).update(`player:${playerId}`).digest('base64url');
}

export function verifyPlayer(playerId: unknown, token: unknown): boolean {
  if (typeof playerId !== 'string' || typeof token !== 'string' || !playerId || !token) return false;
  const expected = Buffer.from(signPlayer(playerId));
  const got = Buffer.from(token);
  return expected.length === got.length && crypto.timingSafeEqual(expected, got);
}
