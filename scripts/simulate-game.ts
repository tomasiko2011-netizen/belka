import { createInitialGameState, startGame, startNewRound, playCard, getValidCards, applyBotTurns } from '../lib/game-engine';
import { Player } from '../lib/types';

function makePlayers(botSeats: number[] = []): Player[] {
  const isBot = (seat: number) => botSeats.includes(seat);
  return [
    { id: 'p1', name: 'P1', seatIndex: 0, teamId: 0, hand: [], isBot: isBot(0), isConnected: true, videoEnabled: false, audioEnabled: false, isMuted: false, isBanned: false },
    { id: 'p2', name: 'P2', seatIndex: 1, teamId: 1, hand: [], isBot: isBot(1), isConnected: true, videoEnabled: false, audioEnabled: false, isMuted: false, isBanned: false },
    { id: 'p3', name: 'P3', seatIndex: 2, teamId: 0, hand: [], isBot: isBot(2), isConnected: true, videoEnabled: false, audioEnabled: false, isMuted: false, isBanned: false },
    { id: 'p4', name: 'P4', seatIndex: 3, teamId: 1, hand: [], isBot: isBot(3), isConnected: true, videoEnabled: false, audioEnabled: false, isMuted: false, isBanned: false },
  ];
}

function simulateOneGame(gameIndex: number, botSeats: number[] = []) {
  let state = createInitialGameState(`room-${gameIndex}`, 'p1', true);
  state.players = makePlayers(botSeats);
  state = startGame(state);
  state = applyBotTurns(state);

  let safety = 0;
  while (state.phase !== 'finished' && safety < 5000) {
    safety += 1;

    if (state.phase === 'dealing') {
      state = { ...state, phase: 'playing' };
    }

    if (state.phase === 'playing') {
      const current = state.players[state.currentPlayerIndex];
      if (current.isBot) {
        state = applyBotTurns(state);
        continue;
      }
      const valid = getValidCards(current.hand, state.currentTrick, state.trumpSuit);
      if (valid.length === 0) {
        throw new Error(`No valid cards for ${current.id}`);
      }
      const card = valid[0];
      state = playCard(state, current.id, card.id);
      state = applyBotTurns(state);
      continue;
    }

    if (state.phase === 'scoring') {
      state = startNewRound(state);
      state = applyBotTurns(state);
      continue;
    }
  }

  if (safety >= 5000) {
    throw new Error('Safety limit reached, possible deadlock');
  }

  return state.teams;
}

function main() {
  const count = Number(process.argv[2] || 3);
  const botMode = process.argv[3] === 'bots';
  let finished = 0;
  for (let i = 1; i <= count; i += 1) {
    const teams = simulateOneGame(i, botMode ? [1, 3] : []);
    finished += 1;
    console.log(`Game ${i} finished. Team1 eyes=${teams[0].eyes}, Team2 eyes=${teams[1].eyes}${botMode ? ' (bots)' : ''}`);
  }
  console.log(`OK: ${finished}/${count} games finished.`);
}

main();
