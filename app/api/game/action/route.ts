import { NextRequest, NextResponse } from 'next/server';
import { getRoom, updateGameState, setRoomStarted, recordGameResult, addPlayer, updatePlayer, removePlayer, updateRoomHost } from '@/lib/db';
import { createInitialGameState, playCard, startGame, startNewRound, applyBotTurns, autoPlayTimeout } from '@/lib/game-engine';
import { pusherServer, roomChannel, EVENTS } from '@/lib/pusher';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: NextRequest) {
  try {
    const { roomId, playerId, action, cardId, rules } = await req.json();

    const room = await getRoom(roomId);
    if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

    let gameState = room.gameState ?? createInitialGameState(roomId, room.hostId, room.withSevens);

    switch (action) {
      case 'start_game': {
        if (playerId !== room.hostId && room.players.length < 2) {
          return NextResponse.json({ error: 'Not enough players to start' }, { status: 403 });
        }
        // Initialize players in game state from room players
        gameState = {
          ...gameState,
          players: room.players.map(p => ({
            id: p.id,
            userId: p.userId,
            name: p.name,
            seatIndex: p.seatIndex,
            teamId: (p.seatIndex % 2 === 0 ? 0 : 1) as 0 | 1,
            hand: [],
            isBot: p.isBot ?? false,
            isConnected: true,
            videoEnabled: false,
            audioEnabled: false,
            isMuted: false,
            isBanned: false,
          })),
        };
        gameState = startGame(gameState);
        await setRoomStarted(roomId);
        break;
      }

      case 'update_rules': {
        if (playerId !== room.hostId) {
          return NextResponse.json({ error: 'Only host can change rules' }, { status: 403 });
        }
        if (!gameState || gameState.phase !== 'waiting') {
          return NextResponse.json({ error: 'Rules can be changed only before the game starts' }, { status: 400 });
        }
        const nextRules = {
          ...gameState.rules,
          ...(rules || {}),
        };
        gameState = {
          ...gameState,
          withSevens: !!nextRules.withSevens,
          rules: nextRules,
        };
        break;
      }

      case 'play_card': {
        if (!cardId) return NextResponse.json({ error: 'No card specified' }, { status: 400 });
        gameState = playCard(gameState, playerId, cardId);
        break;
      }

      case 'next_round': {
        if (gameState.phase !== 'scoring') {
          return NextResponse.json({ error: 'Not in scoring phase' }, { status: 400 });
        }
        gameState = startNewRound(gameState);
        break;
      }

      case 'add_bot': {
        if (playerId !== room.hostId) {
          return NextResponse.json({ error: 'Only host can add bots' }, { status: 403 });
        }
        if (room.players.length >= 4) {
          return NextResponse.json({ error: 'Room is full' }, { status: 400 });
        }
        if (gameState.phase !== 'waiting') {
          return NextResponse.json({ error: 'Bots can be added only before the game starts' }, { status: 400 });
        }
        const takenSeats = room.players.map(p => p.seatIndex);
        const seatIndex = [0, 1, 2, 3].find(s => !takenSeats.includes(s));
        if (seatIndex === undefined) {
          return NextResponse.json({ error: 'No free seats' }, { status: 400 });
        }
        const botId = uuidv4();
        const botName = `Бот ${seatIndex + 1}`;
        await addPlayer({ id: botId, roomId, name: botName, seatIndex, isBot: true });
        const updatedRoom = await getRoom(roomId);
        if (updatedRoom?.gameState) {
          gameState = {
            ...updatedRoom.gameState,
            players: updatedRoom.players.map(p => ({
              id: p.id,
              userId: p.userId,
              name: p.name,
              seatIndex: p.seatIndex,
              teamId: (p.seatIndex % 2 === 0 ? 0 : 1) as 0 | 1,
              hand: [],
              isBot: p.isBot ?? false,
              isConnected: true,
              videoEnabled: false,
              audioEnabled: false,
              isMuted: p.isMuted,
              isBanned: p.isBanned,
            })),
          };
        }
        break;
      }

      case 'player_left': {
        const leaving = room.players.find(p => p.id === playerId);
        if (!leaving) return NextResponse.json({ success: true });

        // If game hasn't started, remove player
        if (gameState.phase === 'waiting') {
          await removePlayer(playerId);
          const updatedRoom = await getRoom(roomId);
          if (updatedRoom) {
            if (updatedRoom.hostId === playerId && updatedRoom.players.length > 0) {
              await updateRoomHost(roomId, updatedRoom.players[0].id);
            }
            if (updatedRoom.gameState) {
              gameState = {
                ...updatedRoom.gameState,
                players: updatedRoom.players.map(p => ({
                  id: p.id,
                  userId: p.userId,
                  name: p.name,
                  seatIndex: p.seatIndex,
                  teamId: (p.seatIndex % 2 === 0 ? 0 : 1) as 0 | 1,
                  hand: [],
                  isBot: p.isBot ?? false,
                  isConnected: true,
                  videoEnabled: false,
                  audioEnabled: false,
                  isMuted: p.isMuted,
                  isBanned: p.isBanned,
                })),
              };
            }
          }
          break;
        }

        // If game is in progress, replace with bot
        const botName = leaving.name.startsWith('Бот') ? leaving.name : `Бот ${leaving.seatIndex + 1}`;
        await updatePlayer(playerId, { name: botName, isBot: true, userId: null });
        gameState = {
          ...gameState,
          players: gameState.players.map(p =>
            p.id === playerId
              ? { ...p, name: botName, isBot: true, isConnected: true, userId: undefined }
              : p
          ),
          lastAction: `${leaving.name} покинул игру — добавлен бот`,
        };
        break;
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    gameState = applyBotTurns(gameState);
    // In case current player times out immediately (e.g., after long pause), auto-play once
    const timeoutResult = autoPlayTimeout(gameState);
    if (timeoutResult.didPlay) {
      gameState = timeoutResult.state;
    }

    if (gameState.phase === 'finished' && !gameState.gameOverRecorded) {
      const winnerTeam = gameState.teams[0].eyes >= gameState.teams[1].eyes ? 0 : 1;
      await recordGameResult(
        gameState.players.map(p => ({ userId: p.userId, name: p.name, teamId: p.teamId })),
        winnerTeam as 0 | 1
      );
      gameState = { ...gameState, gameOverRecorded: true };
    }

    await updateGameState(roomId, gameState);

    // Broadcast updated state (without hands - send personalized states per player)
    const publicState = {
      ...gameState,
      players: gameState.players.map(p => ({ ...p, hand: [] })), // strip hands
    };

    try {
      await pusherServer.trigger(roomChannel(roomId), EVENTS.GAME_STATE, {
        gameState: publicState,
      });
    } catch (e) {
      console.error('Pusher GAME_STATE failed', e);
    }

    // Send private hand to each player (non-fatal)
    for (const player of gameState.players) {
      try {
        await pusherServer.trigger(`private-player-${player.id}`, 'hand-update', {
          hand: player.hand,
        });
      } catch (e) {
        console.error('Pusher hand-update failed', e);
      }
    }

    return NextResponse.json({ success: true, gameState: publicState });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message || 'Action failed' }, { status: 500 });
  }
}
