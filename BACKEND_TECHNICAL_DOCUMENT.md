# Buraco Plus — Backend Technical Document

> Last updated: 2026-05-13  
> Backend stack: NestJS · PostgreSQL (Prisma) · Redis · Socket.io · AWS S3

---

## Table of Contents

1. [System Architecture](#1-system-architecture)
2. [Tech Stack](#2-tech-stack)
3. [Communication Layer — Socket.io vs Photon](#3-communication-layer--socketio-vs-photon)
4. [Authentication](#4-authentication)
5. [All Modules Overview](#5-all-modules-overview)
6. [Game Engine — Deep Dive](#6-game-engine--deep-dive)
7. [Card System](#7-card-system)
8. [Game Rules Implementation](#8-game-rules-implementation)
9. [Scoring System](#9-scoring-system)
10. [WebSocket Events Reference](#10-websocket-events-reference)
11. [REST API Reference](#11-rest-api-reference)
12. [Matchmaking Flow](#12-matchmaking-flow)
13. [Room & Game Lifecycle](#13-room--game-lifecycle)
14. [Reconnection System](#14-reconnection-system)
15. [Economy & Rewards](#15-economy--rewards)
16. [Messaging & Voice Messages](#16-messaging--voice-messages)
17. [Admin System](#17-admin-system)
18. [What Is Fully Implemented](#18-what-is-fully-implemented)
19. [What Is Not Yet Implemented](#19-what-is-not-yet-implemented)

---

## 1. System Architecture

The system is **server-authoritative**. Every game action (draw, meld, discard) is validated and executed on the server. The Unity client is a pure presentation layer — it sends intent, receives authoritative state.

```
Unity Client
    │
    ├── REST (JWT Bearer)  ──► NestJS HTTP Controllers
    │                               │
    └── Socket.io WebSocket ──► AppGateway (gateway.ts)
                                    │
                              ┌─────▼──────┐
                              │  Services  │
                              │ GameEngine │
                              │ Matchmaking│
                              │ Rooms      │
                              │ Messaging  │
                              └─────┬──────┘
                                    │
                         ┌──────────┼──────────┐
                         ▼          ▼          ▼
                      Prisma      Redis       S3
                    (PostgreSQL) (State/Cache) (Voice)
```

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Framework | NestJS (Node.js) |
| Database | PostgreSQL via Prisma ORM |
| Cache / Game State | Redis (game state, presence, queues, locks) |
| Real-time | Socket.io WebSocket |
| File Storage | AWS S3 (voice messages, avatars) |
| Auth | JWT (access token) + Passport.js |
| Scheduling | `@nestjs/schedule` cron jobs |
| Validation | `class-validator` + `class-transformer` |
| API Docs | Swagger (`@nestjs/swagger`) at `/api/docs` |

---

## 3. Communication Layer — Socket.io vs Photon

### Why NOT Photon

Photon is a peer-to-peer relay network. Using it would mean:
- Game moves are sent between clients directly (or via Photon relay)
- The server has no authority — any client can cheat
- Economy, scoring, and stats cannot be trusted

This game uses **Socket.io** instead. The Unity client connects to the backend's WebSocket endpoint. All game logic runs on the server. Photon's RPC system (`photonView.RPC()`) is not used.

### How Unity Should Connect

```
// WebSocket URL
wss://your-api-domain.com/

// Connection with auth token
socket.handshake.auth = { token: "<JWT access token>" }
```

Use the **Socket.io Unity client** package (not the Photon SDK):
- [Socket.io-client-unity](https://github.com/itisnajim/SocketIOUnity)

### Connection Acknowledgement

On connect, the server immediately emits:
```json
{ "event": "connect_ack", "data": { "userId": "...", "socketId": "..." } }
```

---

## 4. Authentication

All HTTP endpoints and WebSocket connections require a JWT bearer token.

### HTTP
```
Authorization: Bearer <access_token>
```

### WebSocket
```json
{ "auth": { "token": "<access_token>" } }
```

### Auth Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/register` | Register with email + password |
| POST | `/auth/login` | Login, returns `{ access_token }` |
| POST | `/auth/refresh` | Refresh token |
| POST | `/auth/logout` | Invalidate token |
| GET | `/auth/me` | Get current user profile |

---

## 5. All Modules Overview

The backend has **20 modules**:

| Module | Purpose |
|---|---|
| `auth` | JWT login, register, refresh, guards |
| `users` | User account CRUD, search |
| `profile` | Avatar upload (S3), bio, display name |
| `stats` | Win/loss record, XP, level, ranking points |
| `economy` | Coin balance, transactions, entry fees, rewards |
| `missions` | Daily/weekly missions, progress tracking, completion rewards |
| `friends` | Send/accept/decline friend requests, friend list |
| `clubs` | Create/join clubs, club chat, club rankings |
| `rankings` | Global and friend leaderboards by ranking points |
| `shop` | Buy cosmetic items with coins |
| `notifications` | In-app notification delivery via WebSocket |
| `matchmaking` | Queue-based matchmaking with Redis sorted sets |
| `rooms` | Game table management (create, join, leave) |
| `game-engine` | Core game logic — all card rules, state, scoring |
| `messaging` | Direct messages, club chat, voice message upload |
| `match-history` | Browse past games and results |
| `admin` | Manage users, missions, ban/unban, grant coins |
| `cloud-scripting` | Server-side scripts for special game events |
| `reconnection` | Handle mid-game disconnects and rejoin |
| `mail` | Email notifications (welcome, password reset) |

### Common/Shared Services

| Service | Purpose |
|---|---|
| `PrismaService` | Database access (all modules) |
| `RedisService` | Cache, game state, queues, presence |
| `S3Service` | File uploads to AWS S3 |
| `SocketService` | Bridge between HTTP controllers and WebSocket server |
| `JwtAuthGuard` | Global auth guard (applied to all routes by default) |

---

## 6. Game Engine — Deep Dive

### State Storage

Every active game's state is stored in Redis as JSON:

```
Key: game:{gameId}:state
TTL: 86400 seconds (24 hours)
```

The `GameState` object stored in Redis:

```typescript
{
  gameId: string
  mode: "CLASSIC" | "PROFESSIONAL"
  variant: "ONE_VS_ONE" | "TWO_VS_TWO"
  status: "IN_PROGRESS" | "COMPLETED"
  stockPile: Card[]          // face-down draw pile
  discardPile: Card[]        // face-up discard pile
  potPiles: Card[][]         // 2 pot bundles of 11 cards
  hands: { [userId]: Card[] }    // private — each player's hand
  melds: { [userId]: Meld[] }    // each player's played combinations
  teamMelds: { 1: Meld[], 2: Meld[] }  // shared team melds (2v2)
  players: [{ userId, teamId, isConnected }]
  turnOrder: string[]        // shuffled userId array
  currentTurnIndex: number
  gameStartedAt: number      // unix ms timestamp
  turnStartedAt: number      // unix ms timestamp of current turn
  turnDuration: number       // seconds per turn (default 30)
  round: number
  scores: { 1: number, 2: number }   // teamId → accumulated score
  moveCount: number
  potCollectedByTeam: number[]       // teamIds that collected their pot
}
```

### Client View (What Unity Receives)

The server **never** sends raw state. It filters it through `buildClientView()` before sending, which:

- Puts the requesting player first in `players[]` (Unity can safely use `players[0]` as self)
- Hides opponent hand cards (only sends `handCount`)
- Exposes `myHand` and `myMelds` as dedicated top-level fields
- Exposes `currentPlayerId`, `topDiscardCard`, `stockPileCount` as convenience fields

```json
{
  "gameId": "...",
  "mode": "CLASSIC",
  "variant": "ONE_VS_ONE",
  "status": "IN_PROGRESS",
  "currentPlayerId": "user-abc",
  "stockPileCount": 42,
  "topDiscardCard": { "id": "...", "suit": "HEARTS", "rank": "7", "isWild": false },
  "discardPileCount": 5,
  "potPileCounts": [11, 11],
  "players": [
    {
      "id": "user-abc",
      "userId": "user-abc",
      "teamId": 1,
      "isConnected": true,
      "handCount": 11,
      "hand": [ ...your cards... ],
      "melds": []
    },
    {
      "id": "user-xyz",
      "userId": "user-xyz",
      "teamId": 2,
      "isConnected": true,
      "handCount": 11,
      "hand": [],
      "melds": []
    }
  ],
  "myHand": [ ...your 11 cards... ],
  "myMelds": [],
  "teamMelds": { "1": [], "2": [] },
  "turnOrder": ["user-abc", "user-xyz"],
  "currentTurnIndex": 0,
  "turnStartedAt": 1715600000000,
  "turnDuration": 30,
  "round": 1,
  "scores": { "1": 0, "2": 0 },
  "moveCount": 0,
  "potCollectedByTeam": []
}
```

### Turn Timeout (Cron Job)

A cron job runs every 5 seconds and checks all active games:
- If `Date.now() - turnStartedAt > turnDuration * 1000` → auto-discard the player's first card
- Advances to the next player's turn
- Logs the auto-discard to the database

---

## 7. Card System

### Card Structure

```typescript
{
  id: string        // UUID (unique per card instance)
  suit: "HEARTS" | "DIAMONDS" | "CLUBS" | "SPADES" | "JOKER"
  rank: "A" | "2" | "3" | ... | "K" | "JOKER"
  isWild: boolean   // true for Jokers and 2s (Pinella)
}
```

### Deck Sizes by Mode

| Mode | Decks | Jokers | Total Cards |
|---|---|---|---|
| CLASSIC | 2 | 4 (2 per deck) | **108** |
| PROFESSIONAL | 2 | 0 (excluded) | **104** |

### Dealing (Both Modes)

```
1. Shuffle full deck
2. Deal 11 cards to each player (clockwise)
3. Set aside Pot 1: next 11 cards
4. Set aside Pot 2: next 11 cards
5. Flip 1 card face-up → discard pile
6. Remaining cards → stock pile (draw pile)
```

**1v1 example (CLASSIC, 108 cards):**
- 2 players × 11 = 22 cards dealt
- 2 pots × 11 = 22 cards set aside
- 1 card to discard pile
- 63 cards in stock pile

### Wild Cards

| Mode | Wild Cards |
|---|---|
| CLASSIC | Jokers (rank=JOKER) + Pinella (rank=2) |
| PROFESSIONAL | Pinella only (rank=2); no Jokers in deck |

---

## 8. Game Rules Implementation

### Valid Melds

**Sets** — 3+ cards of the same rank, any suit  
**Sequences** — 3+ cards of the same suit in consecutive rank order

```
Rank order: A(1) 2(2) 3(3) 4(4) 5(5) 6(6) 7(7) 8(8) 9(9) 10(10) J(11) Q(12) K(13) JOKER(0)
```

**Rules enforced:**
- Minimum 3 cards per meld
- At least 1 natural (non-wild) card
- **Maximum 1 wild card per meld** (one Joker OR one Pinella — not both)
- Wild fills exactly one gap in the sequence

### Move Types

| Move | Rule |
|---|---|
| `DRAW_STOCK` | Draw top card from stock pile |
| `DRAW_DISCARD` | Take entire discard pile — only if you can form a meld using the top card |
| `PLAY_MELD` | Play 3+ cards from hand as a new meld |
| `ADD_TO_MELD` | Add cards from hand to an existing meld you own |
| `DISCARD` | Discard 1 card to end your turn |
| `PICKUP_POT` | Take pot pile into your hand (hand must be empty) |

### Stock Exhaustion

After every `DRAW_STOCK`: if `stockPile.length < 2`, the round ends immediately (no discard reshuffle available). `finalizeGame` is called with no closing bonus.

### Closing the Game (Discard)

To close the game by discarding your last card, ALL three conditions must be met:

| Condition | CLASSIC | PROFESSIONAL |
|---|---|---|
| Team has ≥1 Buraco (7+ card meld) | ✅ Required | ✅ Required |
| Team has collected their pot | ✅ Required | ✅ Required |
| Discarded card is not wild | ✅ Required (Joker/Pinella banned) | ❌ Not restricted |

If any condition fails, the server throws `400 Bad Request` with the reason.

### Pot Rules

| Rule | CLASSIC | PROFESSIONAL |
|---|---|---|
| Can pick up pot when hand is empty | ✅ | ✅ |
| Must have Buraco first | ❌ Not required | ✅ Required |
| One pot per team per game | ✅ | ✅ |
| Opponent team penalty if never collected | -100 pts | -100 pts |

---

## 9. Scoring System

### Card Point Values

| Card | CLASSIC | PROFESSIONAL |
|---|---|---|
| 3, 4, 5, 6, 7 | 5 pts | 5 pts |
| 8, 9, 10, J, Q, K | 10 pts | 10 pts |
| Ace (A) | 15 pts | 15 pts |
| 2 / Pinella | 20 pts | 10 pts |
| Joker | 30 pts | — (not in deck) |

### Buraco Bonuses (7+ card melds)

| Type | Condition | Bonus |
|---|---|---|
| Clean Buraco | 7+ cards, zero wild cards | **+200 pts** |
| Semi-clean Buraco | 7+ cards, 1 wild at start OR end (CLASSIC only) | **+150 pts** |
| Dirty Buraco | 7+ cards, wild card in the middle | **+100 pts** |

### End-of-Round Scoring

```
Team Score =
  + sum of all card values in melds
  + Buraco bonuses for each qualifying meld
  - sum of card values left in hand (penalty)
  + 100  (closing bonus, if this team closed the game)
  - 100  (pot penalty, if this team never collected their pot)
```

### Match Rewards (Economy)

| Result | Coins | XP | Points |
|---|---|---|---|
| Winner | max(200, score÷10) | 100 + score÷50 | 50 + score÷20 |
| Loser | 50 | 25 | 0 |

---

## 10. WebSocket Events Reference

### Client → Server (Emit)

| Event | Payload | Description |
|---|---|---|
| `ping` | — | Heartbeat, keeps presence alive (30s TTL) |
| `room:subscribe` | — | Join room lobby feed |
| `room:unsubscribe` | — | Leave room lobby feed |
| `room:join` | `"roomId"` or `{ roomId }` | Join a room socket channel |
| `room:leave` | `{ roomId }` | Leave room channel |
| `game:join` | `{ gameId }` | Join game channel (after game starts) |
| `game:reconnect` | `{ gameId }` | Reconnect to in-progress game |
| `game:move:draw` | `{ gameId, source: "STOCK"\|"DISCARD" }` | Draw a card |
| `game:move:discard` | `{ gameId, cardId }` | Discard a card |
| `game:move:meld` | `{ gameId, cardIds: string[] }` | Play a meld |
| `chat:send` | `{ conversationId, content }` | Send a text message |
| `chat:typing` | `{ conversationId, isTyping }` | Broadcast typing indicator |
| `chat:read` | `{ conversationId }` | Mark messages as read |

### Server → Client (Listen)

| Event | Data | When Emitted |
|---|---|---|
| `connect_ack` | `{ userId, socketId }` | On successful connection |
| `error` | `{ code, message }` | On any server-side error |
| `pong` | `{ timestamp }` | Reply to ping |
| `room:joined_ack` | `{ roomId }` | After room:join succeeds |
| `room:list_update` | `{ action, room }` | Room created/closed (lobby feed) |
| `room:player_joined` | `{ roomId, player, currentPlayers, maxPlayers }` | Someone joined a room |
| `room:player_left` | `{ roomId, userId, username, currentPlayers }` | Someone left a room |
| `room:update` | `{ roomId, gameId, status: "IN_PROGRESS" }` | **Game has started** |
| `game:state_sync` | Full client view | On reconnect |
| `game:move_played` | `{ gameId, playerId, moveType, result, nextTurnPlayerId }` | Valid move executed |
| `game:move_invalid` | `{ gameId, reason }` | Invalid move attempt |
| `game:end` | `{ gameId, winnerTeam, winnerIds, scores, duration }` | Game over |
| `game:player_disconnected` | `{ gameId, playerId, reconnectWindowSeconds }` | Player disconnected |
| `game:player_reconnected` | `{ gameId, playerId }` | Player reconnected |
| `chat:message` | Message object | New message received |
| `chat:typing` | `{ conversationId, userId, isTyping }` | Typing indicator |
| `chat:read_receipt` | `{ conversationId, readByUserId, readAt }` | Messages marked read |
| `notification:new` | Notification object | New notification for user |

---

## 11. REST API Reference

All routes are prefixed with `/api` and protected by JWT unless noted.

### Auth
```
POST /auth/register
POST /auth/login
POST /auth/refresh
POST /auth/logout
GET  /auth/me
```

### Game
```
GET  /game/:gameId/state          → Get your filtered game state
POST /game/:gameId/move/draw      → Draw card { source: "STOCK"|"DISCARD" }
POST /game/:gameId/move/meld      → Play meld { cardIds: string[] }
POST /game/:gameId/move/add-to-meld → Add to meld { meldId, cardIds }
POST /game/:gameId/move/discard   → Discard { cardId }
POST /game/:gameId/move/pickup-pot → Pick up pot (empty hand required)
```

### Rooms
```
GET  /rooms                       → List rooms (filter: ?mode=&variant=)
GET  /rooms/:roomId               → Get room detail
POST /rooms                       → Create room { mode, variant, turnDuration?, entryFeeCoins?, minLevel?, minPoints? }
POST /rooms/:roomId/join          → Join room
POST /rooms/:roomId/leave         → Leave room
```

### Matchmaking
```
POST   /matchmaking/join          → Join queue { mode, variant }
DELETE /matchmaking/leave         → Leave queue
GET    /matchmaking/status        → Queue position + wait time
```

### Messaging
```
GET  /messaging/conversations                         → All conversations
GET  /messaging/conversations/:id/messages            → History (?page=1&limit=50)
POST /messaging/conversations/:id/voice               → Upload voice message (multipart/form-data)
PUT  /messaging/conversations/:id/read               → Mark as read
```

### Profile & Users
```
GET  /profile
PUT  /profile
POST /profile/avatar              → Upload avatar to S3
GET  /users/search?q=             → Search users by username
GET  /users/:id                   → Public profile
```

### Economy
```
GET  /economy/balance             → Coin balance
POST /economy/gift                → Send coins to friend
```

### Stats & Rankings
```
GET  /stats/me                    → My stats (wins, losses, XP, level)
GET  /stats/:userId               → Another player's stats
GET  /rankings                    → Global leaderboard (?page=&limit=)
GET  /rankings/friends            → Friends leaderboard
```

### Match History
```
GET  /match-history               → My past games (?page=&limit=)
GET  /match-history/:matchId      → Single match detail
```

### Misc
```
GET  /notifications               → My notifications
PUT  /notifications/:id/read      → Mark notification read
GET  /friends                     → Friend list
POST /friends/request             → Send friend request
POST /friends/:requestId/accept   → Accept request
POST /friends/:requestId/decline  → Decline request
GET  /missions                    → Active missions + progress
GET  /clubs                       → Browse clubs
POST /clubs                       → Create club
POST /clubs/:id/join              → Join club
GET  /shop                        → Shop items
POST /shop/buy                    → Purchase item
```

---

## 12. Matchmaking Flow

```
1. Client  →  POST /matchmaking/join { mode, variant }
2. Server  →  Deducts entry fee from wallet
3. Server  →  Adds userId to Redis sorted set: queue:{mode}:{variant}
4. Matchmaking cron (every 5s) polls all queues
5. When enough players found (2 for 1v1, 4 for 2v2):
   a. Creates Room in DB (status = WAITING)
   b. Removes players from queue
   c. Emits room:update WebSocket to matched players
6. Each player connects to Socket.io and emits: room:join { roomId }
7. Server checks if room is FULL (all seats connected)
8. Server acquires Redis NX lock to prevent race condition
9. Server calls gameEngine.startGame() → creates GameSession in DB
10. Server emits room:update { status: "IN_PROGRESS", gameId } to room
11. Clients emit: game:join { gameId } to subscribe to game channel
```

---

## 13. Room & Game Lifecycle

```
WAITING ─── (players join) ──► FULL ─── (all WS connected) ──► IN_PROGRESS
                                                                      │
                              ┌───────────────────────────────────────┘
                              │
                              ▼
                         Game Turns Loop
                         ┌─────────────────────────────────────┐
                         │ 1. Current player draws (STOCK/DISCARD)│
                         │ 2. Player may meld or add to melds    │
                         │ 3. Player discards to end turn        │
                         │    → Turn advances to next player     │
                         └─────────────────────────────────────┘
                              │
                    ┌─────────▼──────────┐
                    │  Game End Triggers  │
                    ├────────────────────┤
                    │ • Player closes    │
                    │   (discard last +  │
                    │   Buraco + pot ok) │
                    │ • Stock < 2 cards  │
                    └─────────┬──────────┘
                              │
                              ▼
                         COMPLETED
                    ─ Scores calculated ─
                    ─ DB records written ─
                    ─ Rewards distributed ─
                    ─ Redis state deleted ─
```

---

## 14. Reconnection System

When a player disconnects mid-game:

1. Server detects socket disconnect
2. Sets Redis key: `disconnect:{userId}:{gameId}` with configurable TTL (reconnect window)
3. Broadcasts `game:player_disconnected` to other players in the game
4. If player reconnects within the window:
   - Client emits `game:reconnect { gameId }`
   - Server clears the disconnect key
   - Server sends full `game:state_sync` to the reconnecting client
   - Server broadcasts `game:player_reconnected` to other players
5. If reconnect window expires → game can be finalized by opponent

Redis keys used:
```
user:{userId}:activeGame    → current gameId for a user
disconnect:{userId}:{gameId} → reconnect window TTL
online:{userId}             → presence marker (30s TTL, refreshed on ping)
```

---

## 15. Economy & Rewards

### Coin Flow

```
Registration bonus → coins added
Matchmaking entry fee → coins deducted (held as escrow)
Win match → max(200, score÷10) coins
Lose match → 50 coins (consolation)
Send gift to friend → direct transfer
Shop purchase → coins deducted
```

### Subscription Tiers

| Mode | Free | Subscribed |
|---|---|---|
| CLASSIC | ✅ | ✅ |
| PROFESSIONAL | ❌ Blocked | ✅ |

The matchmaking `joinQueue` endpoint checks subscription status for PROFESSIONAL games.

---

## 16. Messaging & Voice Messages

### Text Messages
Sent in real-time via WebSocket `chat:send` event. Stored in DB and fetched via REST paginated history.

### Voice Messages
Full upload flow:

```
1. Client records audio locally
2. POST /messaging/conversations/:id/voice
   Content-Type: multipart/form-data
   Fields: file (audio), duration (seconds)
3. Server validates MIME type (mp3, m4a, webm, ogg, wav, aac)
4. Server uploads to S3: voice-messages/{conversationId}/{uuid}.{ext}
5. Server saves message to DB with S3 URL + duration
6. Server emits chat:message event to all conversation members on WebSocket
7. Client receives message with voiceUrl field for playback
```

**Limits:** 5 MB max file size, positive duration required.

---

## 17. Admin System

Protected by admin role check. Endpoints available under `/admin`:

- Get all users, ban/unban accounts
- Grant or deduct coins from any user
- Create, edit, delete missions
- Toggle mission active/inactive status
- View all active game sessions
- Access full match history across all users

---

## 18. What Is Fully Implemented

| Feature | Status |
|---|---|
| JWT Authentication (register, login, refresh) | ✅ Done |
| WebSocket Gateway with Socket.io | ✅ Done |
| Room creation, join, leave | ✅ Done |
| Matchmaking queue (1v1 and 2v2) | ✅ Done |
| Automatic game start when room is FULL (with Redis NX lock) | ✅ Done |
| CLASSIC deck — 108 cards (2 decks + 4 jokers) | ✅ Done |
| PROFESSIONAL deck — 104 cards (2 decks, no jokers) | ✅ Done |
| Dealing — 11 cards per player, 2 pots of 11 | ✅ Done |
| Draw from stock | ✅ Done |
| Draw from discard pile (with meld check) | ✅ Done |
| Reshuffle discard into stock when stock empty | ✅ Done |
| Play meld (set or sequence) | ✅ Done |
| Add cards to existing meld | ✅ Done |
| Discard to end turn | ✅ Done |
| Max 1 wild card per meld | ✅ Done |
| Pot pickup (hand must be empty) | ✅ Done |
| One pot per team per game | ✅ Done |
| PROFESSIONAL: must have Buraco before pot | ✅ Done |
| Must have Buraco to close | ✅ Done |
| Must have collected pot to close | ✅ Done |
| CLASSIC: cannot close by discarding wild card | ✅ Done |
| Stock exhaustion ends game (< 2 cards) | ✅ Done |
| Correct card point values per mode | ✅ Done |
| Clean Buraco bonus (200 pts) | ✅ Done |
| Semi-clean Buraco bonus (150 pts, CLASSIC only) | ✅ Done |
| Dirty Buraco bonus (100 pts) | ✅ Done |
| Closing bonus (+100 pts) | ✅ Done |
| Pot penalty (−100 pts for teams that never collected) | ✅ Done |
| Hand penalty (unmelded cards subtract from score) | ✅ Done |
| Turn timer (30s) with auto-discard on timeout | ✅ Done |
| Reconnection with state sync | ✅ Done |
| Economy (coins, entry fees, rewards, gifts) | ✅ Done |
| Stats (XP, level, wins, losses) | ✅ Done |
| Leaderboards (global + friends) | ✅ Done |
| Missions system | ✅ Done |
| Friends system | ✅ Done |
| Clubs | ✅ Done |
| Text messaging (WebSocket real-time) | ✅ Done |
| Voice messages (S3 upload + WebSocket broadcast) | ✅ Done |
| Match history | ✅ Done |
| Notifications | ✅ Done |
| Admin panel APIs | ✅ Done |
| Player presence (online/offline) | ✅ Done |

---

## 19. What Is Not Yet Implemented

| Feature | Notes |
|---|---|
| **Multi-round / 1005 mode** | CLASSIC can run multi-round until a team reaches 1005 pts. Currently each session is one round only. |
| **PROFESSIONAL Direct mode** | "Close by finishing on the fly without discarding". Only Indirect (discard last card) exists. |
| **PROFESSIONAL: 2nd pot on-the-fly only** | Second pot has no restriction yet — same rules as first pot. |
| **PROFESSIONAL: Buraco of 2 instant win** | Forming a Buraco using only 2-valued cards should end the game immediately as a special win. |
| **PROFESSIONAL: natural 2 in sequence** | Special condition: two 2s in a sequence if one is the natural 2 in position. |
| **MAKART option** | If player has 1 card and discard pile has 1 card → must draw from stock. |
| **Club-level matchmaking** | Matchmaking within a club (invite-only tables). |
| **Spectator mode** | Watching ongoing games without playing. |

---

*End of document.*
