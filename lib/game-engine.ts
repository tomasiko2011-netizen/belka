import { Card, Suit, Rank, GameState, Trick, Player, TeamScore } from './types';
import { v4 as uuidv4 } from 'uuid';

// ─── Card Values ────────────────────────────────────────────────────────────
export const CARD_POINTS: Record<Rank, number> = {
  'A': 11, '10': 10, 'K': 4, 'Q': 3, 'J': 2,
  '9': 0, '8': 0, '7': 0,
};

export const SUITS: Suit[] = ['♣', '♠', '♥', '♦'];
export const RANKS: Rank[] = ['7', '8', '9', 'J', 'Q', 'K', '10', 'A'];
export const RANKS_NO_SEVENS: Rank[] = ['8', '9', 'J', 'Q', 'K', '10', 'A'];

// Permanent trump order: J♣ > J♠ > J♥ > J♦
export const JACK_ORDER: Suit[] = ['♣', '♠', '♥', '♦'];

// ─── Deck ────────────────────────────────────────────────────────────────────
export function createDeck(withSevens: boolean): Card[] {
  const ranks = withSevens ? RANKS : RANKS_NO_SEVENS;
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of ranks) {
      deck.push({ suit, rank, id: `${rank}${suit}` });
    }
  }
  return deck;
}

export function shuffleDeck(deck: Card[]): Card[] {
  const d = [...deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

// ─── Trump & Card Strength ───────────────────────────────────────────────────
export function isJack(card: Card): boolean {
  return card.rank === 'J';
}

/** Returns trump strength 0-3 for Jacks (0 = weakest J♦, 3 = strongest J♣) */
export function jackTrumpStrength(card: Card): number {
  return 3 - JACK_ORDER.indexOf(card.suit);
}

/** Effective suit of a card (Jacks always belong to trump "group") */
export function effectiveSuit(card: Card, trumpSuit: Suit): Suit {
  if (isJack(card)) return trumpSuit; // All jacks are trump-suited
  return card.suit;
}

/** Non-Jack rank strength (higher = stronger) */
const RANK_STRENGTH: Record<Rank, number> = {
  '7': 0, '8': 1, '9': 2, 'Q': 3, 'K': 4, '10': 5, 'A': 6, 'J': 7,
};

/**
 * Returns true if cardA beats cardB, given leadSuit and trumpSuit.
 * cardB is the "current winner".
 */
export function cardBeats(cardA: Card, cardB: Card, leadSuit: Suit, trumpSuit: Suit): boolean {
  const aIsJack = isJack(cardA);
  const bIsJack = isJack(cardB);

  // Both jacks: compare jack order
  if (aIsJack && bIsJack) {
    return jackTrumpStrength(cardA) > jackTrumpStrength(cardB);
  }
  // A is jack, B is not: jack beats everything
  if (aIsJack) return true;
  // B is jack, A is not: jack wins
  if (bIsJack) return false;

  const aSuit = cardA.suit;
  const bSuit = cardB.suit;
  const aIsTrump = aSuit === trumpSuit;
  const bIsTrump = bSuit === trumpSuit;

  // Trump beats non-trump
  if (aIsTrump && !bIsTrump) return true;
  if (!aIsTrump && bIsTrump) return false;

  // Same suit (both trump or both lead): compare rank
  if (aSuit === bSuit || (aIsTrump && bIsTrump)) {
    return RANK_STRENGTH[cardA.rank] > RANK_STRENGTH[cardB.rank];
  }

  // A is lead suit, B is off-suit non-trump (shouldn't happen in valid play)
  if (aSuit === leadSuit) return true;

  return false;
}

/** Determine winner of a completed trick */
export function determineTrickWinner(trick: Trick, trumpSuit: Suit): { winnerId: string; winnerSeatIndex: number } {
  if (trick.cards.length === 0) throw new Error('Empty trick');

  const leadSuit = effectiveSuit(trick.cards[0].card, trumpSuit);
  let winner = trick.cards[0];

  for (let i = 1; i < trick.cards.length; i++) {
    const challenger = trick.cards[i];
    if (cardBeats(challenger.card, winner.card, leadSuit, trumpSuit)) {
      winner = challenger;
    }
  }

  return { winnerId: winner.playerId, winnerSeatIndex: winner.seatIndex };
}

/** Get valid cards a player can play */
export function getValidCards(hand: Card[], trick: Trick, trumpSuit: Suit): Card[] {
  if (trick.cards.length === 0) return hand; // lead: play anything

  const leadCard = trick.cards[0].card;
  const leadSuit = effectiveSuit(leadCard, trumpSuit);

  // Must follow suit (including jacks as trump)
  const suitMatch = hand.filter(c => effectiveSuit(c, trumpSuit) === leadSuit);
  if (suitMatch.length > 0) return suitMatch;

  // Ace rule: cannot discard an Ace of a suit that hasn't been led yet
  // (standard Belka rule - if no cards of lead suit, can play anything)
  return hand;
}

// ─── Scoring ─────────────────────────────────────────────────────────────────
export function calculateTrickPoints(tricks: Trick[]): number {
  return tricks.reduce((sum, trick) => {
    return sum + trick.cards.reduce((s, { card }) => s + CARD_POINTS[card.rank], 0);
  }, 0);
}

function getRules(state: GameState) {
  return {
    withSevens: state.rules?.withSevens ?? state.withSevens,
    winEyes: state.rules?.winEyes ?? 12,
    eggsEnabled: state.rules?.eggsEnabled ?? true,
    saveEnabled: state.rules?.saveEnabled ?? true,
    saveThreshold: state.rules?.saveThreshold ?? 30,
    turnTimerSec: state.rules?.turnTimerSec ?? 20,
  };
}

export function getTeamTricks(completedTricks: Trick[], teamSeatIndices: number[]): Trick[] {
  return completedTricks.filter(t =>
    t.winnerSeatIndex !== null && teamSeatIndices.includes(t.winnerSeatIndex)
  );
}

// ─── Initial State ────────────────────────────────────────────────────────────
export function createInitialGameState(roomId: string, hostId: string, withSevens: boolean): GameState {
  return {
    roomId,
    phase: 'waiting',
    round: 0,
    players: [],
    deck: [],
    currentTrick: { cards: [], leadSuit: null, winnerId: null, winnerSeatIndex: null },
    completedTricks: [],
    currentPlayerIndex: 0,
    currentTurnStartedAt: Date.now(),
    dealerIndex: 0,
    trumpSuit: '♣',
    trumpAssignments: {},
    trumpAssignmentsSet: false,
    teams: [
      { eyes: 0, eyesVisible: false, roundPoints: 0 },
      { eyes: 0, eyesVisible: false, roundPoints: 0 },
    ],
    pendingEyes: 2,
    withSevens,
    rules: {
      withSevens,
      winEyes: 12,
      eggsEnabled: true,
      saveEnabled: true,
      saveThreshold: 30,
      turnTimerSec: 20,
    },
    jackClubsHolderSeat: null,
    lastAction: '',
    createdAt: Date.now(),
    hostId,
    gameOverRecorded: false,
  };
}

// ─── Game Operations ──────────────────────────────────────────────────────────

export function dealCards(state: GameState): GameState {
  const rules = getRules(state);
  const deck = shuffleDeck(createDeck(rules.withSevens));
  const cardsPerPlayer = rules.withSevens ? 8 : 7;
  const newPlayers = state.players.map((p, i) => ({
    ...p,
    hand: deck.slice(i * cardsPerPlayer, (i + 1) * cardsPerPlayer),
  }));

  // Find who has J♣
  let jackClubsHolderSeat = state.jackClubsHolderSeat;
  let trumpSuit: Suit = '♣';
  let trumpAssignments = state.trumpAssignments;
  let trumpAssignmentsSet = state.trumpAssignmentsSet;

  if (state.round === 1) {
    // First round: clubs are trump, find J♣ holder for future assignments
    for (const p of newPlayers) {
      if (p.hand.find(c => c.id === 'J♣')) {
        jackClubsHolderSeat = p.seatIndex;
        break;
      }
    }
    // Assign trumps: J♣ holder → ♣, partner (seat+2) → ♠, left opp → ♥, right opp → ♦
    if (jackClubsHolderSeat !== null) {
      const assignments: Record<number, Suit> = {};
      const seatOrder = [0, 1, 2, 3];
      const startIdx = jackClubsHolderSeat;
      const rotated = [
        seatOrder[startIdx % 4],
        seatOrder[(startIdx + 2) % 4], // partner
        seatOrder[(startIdx + 1) % 4], // left
        seatOrder[(startIdx + 3) % 4], // right
      ];
      const suitAssign: Suit[] = ['♣', '♠', '♥', '♦'];
      rotated.forEach((seat, i) => { assignments[seat] = suitAssign[i]; });
      trumpAssignments = assignments;
      trumpAssignmentsSet = true;
    }
    trumpSuit = '♣';
  } else {
    // Subsequent rounds: find J♣ holder, look up their assigned trump
    for (const p of newPlayers) {
      if (p.hand.find(c => c.id === 'J♣')) {
        jackClubsHolderSeat = p.seatIndex;
        break;
      }
    }
    if (jackClubsHolderSeat !== null && trumpAssignmentsSet) {
      trumpSuit = trumpAssignments[jackClubsHolderSeat] || '♣';
    }
  }

  // First player after dealer (left of dealer)
  const firstPlayerIndex = (state.dealerIndex + 1) % 4;

  return {
    ...state,
    phase: 'playing',
    deck: [],
    players: newPlayers,
    currentTrick: { cards: [], leadSuit: null, winnerId: null, winnerSeatIndex: null },
    completedTricks: [],
    currentPlayerIndex: firstPlayerIndex,
    currentTurnStartedAt: Date.now(),
    trumpSuit,
    trumpAssignments,
    trumpAssignmentsSet,
    jackClubsHolderSeat,
    lastAction: `Карты розданы. Козырь: ${trumpSuit}`,
  };
}

export function playCard(state: GameState, playerId: string, cardId: string): GameState {
  const playerIdx = state.players.findIndex(p => p.id === playerId);
  if (playerIdx === -1) throw new Error('Player not found');
  if (playerIdx !== state.currentPlayerIndex) throw new Error('Not your turn');

  const player = state.players[playerIdx];
  const cardIdx = player.hand.findIndex(c => c.id === cardId);
  if (cardIdx === -1) throw new Error('Card not in hand');

  const card = player.hand[cardIdx];

  // Validate move
  const validCards = getValidCards(player.hand, state.currentTrick, state.trumpSuit);
  if (!validCards.find(c => c.id === cardId)) throw new Error('Invalid card play');

  // Remove card from hand
  const newHand = player.hand.filter(c => c.id !== cardId);
  const newPlayers = state.players.map((p, i) =>
    i === playerIdx ? { ...p, hand: newHand } : p
  );

  // Add to current trick
  const newTrickCards = [
    ...state.currentTrick.cards,
    { card, playerId, seatIndex: player.seatIndex }
  ];

  let newState: GameState = {
    ...state,
    players: newPlayers,
    currentTrick: {
      ...state.currentTrick,
      cards: newTrickCards,
      leadSuit: newTrickCards.length === 1 ? effectiveSuit(card, state.trumpSuit) : state.currentTrick.leadSuit,
    },
    lastAction: `${player.name} сыграл ${card.rank}${card.suit}`,
  };

  // If all 4 players have played
  if (newTrickCards.length === 4) {
    const { winnerId, winnerSeatIndex } = determineTrickWinner(
      { ...newState.currentTrick, cards: newTrickCards },
      state.trumpSuit
    );

    const completedTrick: Trick = {
      cards: newTrickCards,
      leadSuit: newState.currentTrick.leadSuit,
      winnerId,
      winnerSeatIndex,
    };

    const completedTricks = [...state.completedTricks, completedTrick];
    const winnerPlayer = newPlayers.find(p => p.id === winnerId)!;

    newState = {
      ...newState,
      currentTrick: { cards: [], leadSuit: null, winnerId: null, winnerSeatIndex: null },
      completedTricks,
      currentPlayerIndex: winnerSeatIndex,
      currentTurnStartedAt: Date.now(),
      lastAction: `${winnerPlayer.name} берёт взятку!`,
    };

    // Check if round is over (all hands empty)
    if (newPlayers.every(p => p.hand.length === 0)) {
      newState = scoreRound(newState, completedTricks);
    }
  } else {
    // Next player
    newState = {
      ...newState,
      currentPlayerIndex: (playerIdx + 1) % 4,
      currentTurnStartedAt: Date.now(),
    };
  }

  return newState;
}

function pickLowest(cards: Card[], trumpSuit: Suit, leadSuit: Suit | null): Card {
  const sorted = [...cards].sort((a, b) => {
    const aPoints = CARD_POINTS[a.rank];
    const bPoints = CARD_POINTS[b.rank];
    if (aPoints !== bPoints) return aPoints - bPoints;

    const aIsTrump = effectiveSuit(a, trumpSuit) === trumpSuit;
    const bIsTrump = effectiveSuit(b, trumpSuit) === trumpSuit;
    if (aIsTrump !== bIsTrump) return aIsTrump ? 1 : -1;

    if (leadSuit) {
      const aIsLead = effectiveSuit(a, trumpSuit) === leadSuit;
      const bIsLead = effectiveSuit(b, trumpSuit) === leadSuit;
      if (aIsLead !== bIsLead) return aIsLead ? 1 : -1;
    }

    return RANK_STRENGTH[a.rank] - RANK_STRENGTH[b.rank];
  });
  return sorted[0];
}

function chooseBotCard(state: GameState, playerId: string): Card | null {
  const player = state.players.find(p => p.id === playerId);
  if (!player) return null;
  const valid = getValidCards(player.hand, state.currentTrick, state.trumpSuit);
  if (valid.length === 0) return null;

  // Lead: play lowest-value card (save points)
  if (state.currentTrick.cards.length === 0) {
    return pickLowest(valid, state.trumpSuit, null);
  }

  const leadSuit = effectiveSuit(state.currentTrick.cards[0].card, state.trumpSuit);
  const currentWinner = determineTrickWinner(
    { ...state.currentTrick, cards: state.currentTrick.cards },
    state.trumpSuit
  );
  const partnerSeat = (player.seatIndex + 2) % 4;
  const partnerWinning = currentWinner.winnerSeatIndex === partnerSeat;

  // If partner is winning, avoid taking the trick if possible
  if (partnerWinning) {
    const losingCards = valid.filter(c => !cardBeats(c, state.currentTrick.cards.find(t => t.seatIndex === currentWinner.winnerSeatIndex)!.card, leadSuit, state.trumpSuit));
    if (losingCards.length > 0) {
      return pickLowest(losingCards, state.trumpSuit, leadSuit);
    }
    return pickLowest(valid, state.trumpSuit, leadSuit);
  }

  // Try to win with the lowest winning card
  const winningCards = valid.filter(c => cardBeats(c, state.currentTrick.cards.find(t => t.seatIndex === currentWinner.winnerSeatIndex)!.card, leadSuit, state.trumpSuit));
  if (winningCards.length > 0) {
    return pickLowest(winningCards, state.trumpSuit, leadSuit);
  }

  // Otherwise, dump lowest card
  return pickLowest(valid, state.trumpSuit, leadSuit);
}

export function applyBotTurns(state: GameState): GameState {
  let next = state;
  let safety = 0;
  while (next.phase === 'playing' && safety < 32) {
    const current = next.players[next.currentPlayerIndex];
    if (!current?.isBot) break;
    const card = chooseBotCard(next, current.id);
    if (!card) break;
    next = playCard(next, current.id, card.id);
    safety += 1;
  }
  return next;
}

function scoreRound(state: GameState, completedTricks: Trick[]): GameState {
  const rules = getRules(state);
  const team0Seats = [0, 2];
  const team1Seats = [1, 3];

  const team0Tricks = getTeamTricks(completedTricks, team0Seats);
  const team1Tricks = getTeamTricks(completedTricks, team1Seats);

  const team0Points = calculateTrickPoints(team0Tricks);
  const team1Points = calculateTrickPoints(team1Tricks);

  let newTeams: [TeamScore, TeamScore] = [
    { ...state.teams[0], roundPoints: team0Points },
    { ...state.teams[1], roundPoints: team1Points },
  ];

  // Determine eyes to open
  let eyesToOpen = state.pendingEyes;
  let nextPendingEyes = 2;

  // "Яйца" (tie at 60-60)
  if (team0Points === 60 && team1Points === 60) {
    // "Яйца" (optional): No eyes opened, optionally double next round
    nextPendingEyes = rules.eggsEnabled ? eyesToOpen + 2 : eyesToOpen;
    return {
      ...state,
      phase: 'scoring',
      completedTricks,
      teams: newTeams,
      pendingEyes: nextPendingEyes,
      round: state.round + 1,
      dealerIndex: (state.dealerIndex + 1) % 4,
      lastAction: 'Яйца! Очки удваиваются в следующем коне!',
    };
  }

  const winnerTeam = team0Points > team1Points ? 0 : 1;
  const loserTeam = 1 - winnerTeam;

  // Check for bonus eyes (3 eyes if trump was from losing team & they didn't score "спас")
  const trumpHolderSeat = state.jackClubsHolderSeat ?? 0;
  const trumpHolderTeam = [0, 2].includes(trumpHolderSeat) ? 0 : 1;
  const loserPoints = loserTeam === 0 ? team0Points : team1Points;

  if (rules.saveEnabled && winnerTeam !== trumpHolderTeam && loserPoints < rules.saveThreshold) {
    // Didn't get "спас" (threshold points) — open 3 eyes
    eyesToOpen = 3;
  }

  // Open eyes for winning team
  const winnerEyes = Math.min(newTeams[winnerTeam].eyes + eyesToOpen, rules.winEyes);
  newTeams[winnerTeam] = { ...newTeams[winnerTeam], eyes: winnerEyes };

  // Check game over
  const gameOver = winnerEyes >= rules.winEyes;

  return {
    ...state,
    phase: gameOver ? 'finished' : 'scoring',
    completedTricks,
    teams: newTeams,
    pendingEyes: nextPendingEyes,
    round: state.round + 1,
    dealerIndex: (state.dealerIndex + 1) % 4,
    lastAction: gameOver
      ? `🏆 Команда ${winnerTeam + 1} победила в партии!`
      : `Команда ${winnerTeam + 1} открывает ${eyesToOpen} ${eyesToOpen === 1 ? 'глаз' : 'глаза'}!`,
  };
}

export function startNewRound(state: GameState): GameState {
  return dealCards({
    ...state,
    phase: 'dealing',
    round: state.round + 1,
  });
}

export function startGame(state: GameState): GameState {
  return dealCards({
    ...state,
    phase: 'dealing',
    round: 1,
    teams: [
      { eyes: 0, eyesVisible: false, roundPoints: 0 },
      { eyes: 0, eyesVisible: false, roundPoints: 0 },
    ],
    pendingEyes: 2,
  });
}

export function autoPlayTimeout(state: GameState, now = Date.now()): { state: GameState; didPlay: boolean } {
  const rules = getRules(state);
  const timerMs = (rules.turnTimerSec || 0) * 1000;
  if (state.phase !== 'playing' || timerMs <= 0) return { state, didPlay: false };

  const startedAt = state.currentTurnStartedAt ?? now;
  if (now - startedAt < timerMs) return { state, didPlay: false };

  const current = state.players[state.currentPlayerIndex];
  if (!current) return { state, didPlay: false };

  const card = chooseBotCard(state, current.id);
  if (!card) return { state, didPlay: false };

  let next = playCard(state, current.id, card.id);
  next = applyBotTurns(next);
  return { state: next, didPlay: true };
}
