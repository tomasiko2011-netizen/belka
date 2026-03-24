export type Suit = '♣' | '♠' | '♥' | '♦';
export type Rank = '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  suit: Suit;
  rank: Rank;
  id: string; // e.g. "J♣"
}

export type TeamId = 0 | 1; // 0 = players 0&2, 1 = players 1&3

export interface GameRules {
  withSevens: boolean;
  winEyes: number;
  eggsEnabled: boolean;
  saveEnabled: boolean;
  saveThreshold: number; // points needed for "спас"
  turnTimerSec: number;
}

export interface Player {
  id: string;
  userId?: string;
  name: string;
  seatIndex: number; // 0-3
  teamId: TeamId;
  hand: Card[];
  isBot?: boolean;
  isConnected: boolean;
  videoEnabled: boolean;
  audioEnabled: boolean;
  isMuted: boolean;   // muted by moderator
  isBanned: boolean;
}

export type GamePhase =
  | 'waiting'    // waiting for players
  | 'dealing'    // cards being dealt
  | 'playing'    // active gameplay
  | 'scoring'    // calculating scores after a round
  | 'finished';  // game over

export interface Trick {
  cards: Array<{ card: Card; playerId: string; seatIndex: number }>;
  leadSuit: Suit | null;
  winnerId: string | null;
  winnerSeatIndex: number | null;
}

export interface TeamScore {
  eyes: number;         // "глаза" 0-12 (win at 12)
  eyesVisible: boolean; // whether 6-cards are flipped
  roundPoints: number;  // points this round (0-120)
}

export interface GameState {
  roomId: string;
  phase: GamePhase;
  round: number;
  players: Player[];           // indexed by seatIndex
  deck: Card[];
  currentTrick: Trick;
  completedTricks: Trick[];
  currentPlayerIndex: number;  // whose turn
  currentTurnStartedAt?: number;
  dealerIndex: number;
  trumpSuit: Suit;             // current trump suit
  // Trump assignments per player seat (established in round 1)
  trumpAssignments: Record<number, Suit>; // seatIndex -> suit they'll call
  trumpAssignmentsSet: boolean;
  teams: [TeamScore, TeamScore];
  pendingEyes: number;         // eyes to open next round (for "яйца" scenario)
  withSevens: boolean;         // game variant: include 7s
  rules?: GameRules;
  jackClubsHolderSeat: number | null; // who had J♣ at start of this round
  lastAction: string;
  createdAt: number;
  hostId: string;
  gameOverRecorded?: boolean;
}

export interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  text: string;
  timestamp: number;
  type: 'chat' | 'system' | 'game';
}

export interface Room {
  id: string;
  name: string;
  hostId: string;
  players: RoomPlayer[];
  gameState: GameState | null;
  isStarted: boolean;
  withSevens: boolean;
  maxPlayers: 4;
  createdAt: number;
}

export interface RoomPlayer {
  id: string;
  userId?: string;
  name: string;
  seatIndex: number;
  isBot?: boolean;
  isReady: boolean;
  isBanned: boolean;
  isMuted: boolean;
}

// Pusher event types
export interface GameActionEvent {
  type: 'play_card' | 'start_game' | 'restart';
  playerId: string;
  cardId?: string;
}

export interface VideoSignalEvent {
  from: string;
  to: string;
  signal: unknown;
  type: 'offer' | 'answer' | 'ice-candidate';
}

export interface ModAction {
  type: 'ban' | 'unban' | 'mute' | 'unmute';
  targetPlayerId: string;
  moderatorId: string;
}
