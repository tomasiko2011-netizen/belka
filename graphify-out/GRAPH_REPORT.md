# Graph Report - .  (2026-06-11)

## Corpus Check
- Corpus is ~15,510 words - fits in a single context window. You may not need a graph.

## Summary
- 223 nodes · 395 edges · 18 communities (13 shown, 5 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.95)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_API Routes & Database Layer|API Routes & Database Layer]]
- [[_COMMUNITY_UI Game Components|UI Game Components]]
- [[_COMMUNITY_Card Game Engine|Card Game Engine]]
- [[_COMMUNITY_Dev Dependencies Config|Dev Dependencies Config]]
- [[_COMMUNITY_TypeScript Compiler Config|TypeScript Compiler Config]]
- [[_COMMUNITY_Runtime Dependencies|Runtime Dependencies]]
- [[_COMMUNITY_Docs & CI Workflow|Docs & CI Workflow]]
- [[_COMMUNITY_API Playthrough Test Scripts|API Playthrough Test Scripts]]
- [[_COMMUNITY_PWA Manifest|PWA Manifest]]
- [[_COMMUNITY_Vercel Deploy Config|Vercel Deploy Config]]
- [[_COMMUNITY_Database Init Script|Database Init Script]]
- [[_COMMUNITY_App Root Layout|App Root Layout]]
- [[_COMMUNITY_Lobby & Room Pages|Lobby & Room Pages]]
- [[_COMMUNITY_Leaderboard Page|Leaderboard Page]]
- [[_COMMUNITY_Next.js Config|Next.js Config]]

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 15 edges
2. `POST()` - 14 edges
3. `getRoom()` - 12 edges
4. `ensureSchema()` - 10 edges
5. `playCard()` - 10 edges
6. `createInitialGameState()` - 9 edges
7. `autoPlayTimeout()` - 9 edges
8. `roomChannel()` - 9 edges
9. `scripts` - 9 edges
10. `simulateOneGame()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `GameBoard()` --calls--> `getValidCards()`  [EXTRACTED]
  components/GameBoard.tsx → lib/game-engine.ts
- `CI Build and Lint Workflow` --references--> `Belka Kazakh Online Card Game`  [INFERRED]
  .github/workflows/ci.yml → README.md
- `POST()` --calls--> `applyBotTurns()`  [EXTRACTED]
  app/api/game/action/route.ts → lib/game-engine.ts
- `POST()` --calls--> `autoPlayTimeout()`  [EXTRACTED]
  app/api/game/action/route.ts → lib/game-engine.ts
- `POST()` --calls--> `startNewRound()`  [EXTRACTED]
  app/api/game/action/route.ts → lib/game-engine.ts

## Import Cycles
- None detected.

## Communities (18 total, 5 thin omitted)

### Community 0 - "API Routes & Database Layer"
Cohesion: 0.13
Nodes (31): POST(), GET(), POST(), GET(), addPlayer(), createRoom(), db, ensureSchema() (+23 more)

### Community 1 - "UI Game Components"
Cohesion: 0.08
Nodes (28): CardProps, SIZES, SUIT_SYMBOLS, ChatProps, GameBoard(), GameBoardProps, SEAT_POSITIONS, TRICK_CARD_OFFSETS (+20 more)

### Community 2 - "Card Game Engine"
Cohesion: 0.15
Nodes (29): applyBotTurns(), autoPlayTimeout(), calculateTrickPoints(), CARD_POINTS, cardBeats(), chooseBotCard(), createDeck(), dealCards() (+21 more)

### Community 3 - "Dev Dependencies Config"
Cohesion: 0.08
Nodes (23): devDependencies, autoprefixer, postcss, tailwindcss, tsx, @types/node, @types/react, @types/react-dom (+15 more)

### Community 4 - "TypeScript Compiler Config"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 5 - "Runtime Dependencies"
Cohesion: 0.15
Nodes (13): dependencies, clsx, dotenv, framer-motion, @libsql/client, next, pusher, pusher-js (+5 more)

### Community 6 - "Docs & CI Workflow"
Cohesion: 0.25
Nodes (9): Belka Kazakh Online Card Game, Belka Game Engine, Host Moderation System, Next.js, Pusher Realtime, Turso libSQL Database, Vercel Deployment, WebRTC Video Chat (+1 more)

### Community 7 - "API Playthrough Test Scripts"
Cohesion: 0.50
Nodes (8): api(), BASE_URL, brutePlayTurn(), getState(), main(), playCard(), runOnce(), startGame()

### Community 8 - "PWA Manifest"
Cohesion: 0.25
Nodes (7): background_color, display, icons, name, short_name, start_url, theme_color

### Community 9 - "Vercel Deploy Config"
Cohesion: 0.25
Nodes (7): maxDuration, buildCommand, devCommand, framework, functions, app/api/**/*.ts, installCommand

## Knowledge Gaps
- **94 isolated node(s):** `metadata`, `LeaderboardRow`, `RoomInfo`, `SUIT_SYMBOLS`, `SIZES` (+89 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `Runtime Dependencies` to `Dev Dependencies Config`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **What connects `metadata`, `LeaderboardRow`, `RoomInfo` to the rest of the system?**
  _94 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `API Routes & Database Layer` be split into smaller, more focused modules?**
  _Cohesion score 0.13107822410147993 - nodes in this community are weakly interconnected._
- **Should `UI Game Components` be split into smaller, more focused modules?**
  _Cohesion score 0.07692307692307693 - nodes in this community are weakly interconnected._
- **Should `Dev Dependencies Config` be split into smaller, more focused modules?**
  _Cohesion score 0.08333333333333333 - nodes in this community are weakly interconnected._
- **Should `TypeScript Compiler Config` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._