# Buraco Card Game — API Documentation

**Version:** 1.0  
**Last Updated:** April 2026  
**Backend Framework:** NestJS · Prisma ORM · PostgreSQL · Redis  
**Interactive Docs (Swagger UI):** `http://<host>:3000/api/docs`

---

## Table of Contents

1. [Overview](#1-overview)
2. [Base URL & Environments](#2-base-url--environments)
3. [Authentication](#3-authentication)
4. [Standard Response Format](#4-standard-response-format)
5. [Error Codes](#5-error-codes)
6. [Rate Limiting](#6-rate-limiting)
7. [WebSocket Gateway](#7-websocket-gateway)
8. [API Reference](#8-api-reference)
   - [Auth](#81-auth)
   - [Profile](#82-profile)
   - [Stats](#83-stats)
   - [Economy](#84-economy)
   - [Rankings](#85-rankings)
   - [Friends](#86-friends)
   - [Missions](#87-missions)
   - [Notifications](#88-notifications)
   - [Shop](#89-shop)
   - [Clubs](#810-clubs)
   - [Matchmaking](#811-matchmaking)
   - [Rooms](#812-rooms)
   - [Game](#813-game)
   - [Messaging](#814-messaging)
   - [Match History](#815-match-history)
   - [Cloud Scripting](#816-cloud-scripting)
9. [Admin API Reference](#9-admin-api-reference)
   - [Admin Auth](#91-admin-auth)
   - [Dashboard](#92-dashboard)
   - [User Management](#93-user-management)
   - [Leaderboard Management](#94-leaderboard-management)
   - [Game Management](#95-game-management)
   - [Shop Management](#96-shop-management)
   - [Promo Codes](#97-promo-codes)
   - [Clubs Management](#98-clubs-management)
   - [Missions Management](#99-missions-management)
   - [Broadcast](#910-broadcast)
   - [System Config](#911-system-config)
   - [Audit Logs](#912-audit-logs)
10. [Data Models](#10-data-models)
11. [Integration Credentials Setup](#11-integration-credentials-setup)

---

## 1. Overview

The Buraco API is a **server-authoritative** REST + WebSocket backend for the Buraco (Brazilian Rummy) card game. All game logic runs server-side; clients send move intents and receive authoritative state updates.

**Key characteristics:**
- All player-facing routes require a **JWT Bearer token** (15-minute access token)
- Token refresh is supported via a 30-day rotating refresh token
- All responses are JSON-wrapped in a standard envelope
- Game moves and real-time events use **Socket.IO** WebSocket connections
- Admin routes use a separate JWT with a different secret and 8-hour TTL

---

## 2. Base URL & Environments

| Environment | Base URL |
|-------------|----------|
| Local Dev | `http://localhost:3000/v1` |
| Production | `https://api.yourdomain.com/v1` |
| Swagger UI | `http://localhost:3000/api/docs` |
| Admin Panel | `http://localhost:3001` |

> **All API endpoints in this document are relative to the Base URL.** For example, `POST /auth/login` is the full path `http://localhost:3000/v1/auth/login`.

---

## 3. Authentication

### Player Authentication

All protected endpoints require the header:
```
Authorization: Bearer <accessToken>
```

Access tokens expire in **15 minutes**. Use the refresh endpoint to get a new one.

#### Token Flow
```
1. POST /auth/register  OR  POST /auth/login
   → returns { accessToken, refreshToken, expiresIn: 900 }

2. Client stores both tokens securely.

3. When accessToken expires (HTTP 401), call:
   POST /auth/refresh  { refreshToken }
   → returns { accessToken, expiresIn: 900 }
   (old refresh token is invalidated — store the new one)

4. On logout:
   POST /auth/logout  (invalidates the current accessToken via Redis blacklist)
```

### Admin Authentication

Admin endpoints use a separate token. Use the admin login endpoint and pass the token as `Authorization: Bearer <adminToken>`.

Admin tokens expire in **8 hours**.

---

## 4. Standard Response Format

Every response is wrapped in this envelope:

```json
{
  "success": true,
  "data": { ... },
  "timestamp": "2026-04-19T12:00:00.000Z"
}
```

On error:
```json
{
  "success": false,
  "error": {
    "code": "Unauthorized",
    "message": "INVALID_CREDENTIALS",
    "statusCode": 401
  },
  "path": "/v1/auth/login",
  "timestamp": "2026-04-19T12:00:00.000Z"
}
```

---

## 5. Error Codes

| HTTP Status | Code | Meaning |
|-------------|------|---------|
| 400 | `Bad Request` | Validation failed or missing required fields |
| 401 | `Unauthorized` | Missing, expired, or invalid token |
| 403 | `Forbidden` | Token valid but action not permitted (e.g. banned) |
| 404 | `Not Found` | Resource does not exist |
| 409 | `Conflict` | Duplicate resource (e.g. `EMAIL_TAKEN`, `USERNAME_TAKEN`) |
| 429 | `Too Many Requests` | Rate limit exceeded |
| 500 | `Internal Server Error` | Unexpected server error |

**Common message strings:**

| Message | Meaning |
|---------|---------|
| `EMAIL_TAKEN` | Email already registered |
| `USERNAME_TAKEN` | Username already in use |
| `INVALID_CREDENTIALS` | Wrong email/password |
| `INVALID_REFRESH_TOKEN` | Refresh token expired or already used |
| `ACCOUNT_BANNED` | User is banned from the platform |
| `INSUFFICIENT_BALANCE` | Not enough coins or diamonds |
| `USER_BLOCKED` | Action blocked by a block relationship |

---

## 6. Rate Limiting

Default limits (configurable via admin panel):

| Setting | Default |
|---------|---------|
| Window | 60 seconds |
| Max requests per window | 100 |

When exceeded, the server returns `HTTP 429 Too Many Requests`.

---

## 7. WebSocket Gateway

**Connection URL:** `ws://localhost:3000` (Socket.IO)

**Authentication:** Pass the JWT as a query parameter or header on connection:
```
ws://localhost:3000?token=<accessToken>
```

### Client → Server Events

| Event | Payload | Description |
|-------|---------|-------------|
| `game:join` | `{ gameId }` | Join a game room |
| `game:move` | `{ gameId, action, ... }` | Submit a game move (use REST /game endpoints for structured moves) |
| `chat:send` | `{ conversationId, content }` | Send a chat message |
| `room:ready` | `{ roomId }` | Mark yourself ready in a room |

### Server → Client Events

| Event | Payload | Description |
|-------|---------|-------------|
| `game:state` | Full game state | Pushed after every valid move |
| `game:started` | `{ gameId }` | Game has started |
| `game:ended` | `{ winner, scores }` | Game has ended |
| `chat:message` | Message object | New message received |
| `room:player_joined` | Player info | Another player joined the room |
| `room:player_left` | `{ userId }` | Player left the room |
| `matchmaking:matched` | `{ roomId }` | Match found, join the room |
| `notification` | Notification object | Real-time notification pushed |

---

## 8. API Reference

### 8.1 Auth

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/auth/register` | Public | Register with email and password |
| `POST` | `/auth/login` | Public | Login with email and password |
| `POST` | `/auth/google` | Public | Login / register with Google Sign-In |
| `POST` | `/auth/apple` | Public | Login / register with Apple Sign-In |
| `POST` | `/auth/refresh` | Public | Refresh access token |
| `POST` | `/auth/logout` | Bearer | Logout and revoke token |
| `POST` | `/auth/forgot-password` | Public | Send password reset OTP to email |
| `POST` | `/auth/reset-password` | Public | Reset password with OTP |
| `PUT` | `/auth/change-password` | Bearer | Change password while authenticated |
| `PUT` | `/auth/email` | Bearer | Update account email |
| `DELETE` | `/auth/account` | Bearer | Permanently delete account |

#### POST /auth/register
```json
Request:
{
  "email": "player@example.com",
  "username": "CoolPlayer",
  "password": "MyPass@123"
}

Response 201:
{
  "user": { "id": "...", "username": "CoolPlayer", "coins": 1000, "diamonds": 0, "lives": 5, ... },
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "expiresIn": 900
}
```

#### POST /auth/login
```json
Request:  { "email": "player@example.com", "password": "MyPass@123" }
Response: { "user": {...}, "accessToken": "...", "refreshToken": "...", "expiresIn": 900 }
```

#### POST /auth/google
```json
Request:  { "idToken": "<Google ID token from client SDK>" }
Response: { "user": {...}, "accessToken": "...", "refreshToken": "...", "isNewUser": false }
```

#### POST /auth/apple
```json
Request:  {
  "identityToken": "<Apple identity token>",
  "fullName": { "firstName": "Jane", "lastName": "Doe" }
}
Response: { "user": {...}, "accessToken": "...", "refreshToken": "...", "isNewUser": true }
```

#### POST /auth/refresh
```json
Request:  { "refreshToken": "eyJ..." }
Response: { "accessToken": "eyJ...", "expiresIn": 900 }
```

#### POST /auth/forgot-password
```json
Request:  { "email": "player@example.com" }
Response: {} (always 200 — does not reveal whether email exists)
```

#### POST /auth/reset-password
```json
Request:  { "token": "<base64(email:otp)>", "newPassword": "NewPass@123" }
Response: {}
```

---

### 8.2 Profile

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/profile/me` | Bearer | Get own full profile with stats |
| `GET` | `/profile/{userId}` | Bearer | Get another player's public profile |
| `PUT` | `/profile/username` | Bearer | Update own username |
| `POST` | `/profile/avatar/upload` | Bearer | Upload custom avatar (multipart, max 5 MB) |
| `PUT` | `/profile/avatar/predefined` | Bearer | Set a predefined avatar by ID |
| `GET` | `/profile/avatars/predefined` | Bearer | List all available predefined avatars |

#### GET /profile/me — Response
```json
{
  "id": "uuid",
  "username": "CoolPlayer",
  "email": "player@example.com",
  "avatarUrl": "https://...",
  "coins": 1600,
  "diamonds": 0,
  "lives": 5,
  "subscriptionStatus": "FREE",
  "isBanned": false,
  "stats": { "level": 1, "points": 0, "gamesPlayed": 0, "winPercentage": 0.0, "winStreak": 0 }
}
```

#### PUT /profile/username
```json
Request:  { "username": "NewUsername" }
Response: { "id": "uuid", "username": "NewUsername" }
```

#### PUT /profile/avatar/predefined
```json
Request:  { "predefinedId": "avatar_001" }
Response: { "avatarUrl": "https://app.buraco.game/avatars/predefined/001.png" }
```

**Predefined avatar IDs:** `avatar_001` to `avatar_005`

---

### 8.3 Stats

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/stats/me` | Bearer | Get own player stats |
| `GET` | `/stats/{userId}` | Bearer | Get another player's stats |

#### Stats Object
```json
{
  "level": 5,
  "points": 4200,
  "gamesPlayed": 38,
  "winPercentage": 52.6,
  "winStreak": 3,
  "bestWinStreak": 7
}
```

---

### 8.4 Economy

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/economy/balance` | Bearer | Get coins, diamonds, lives balances |
| `POST` | `/economy/daily-claim` | Bearer | Claim daily login reward (once per UTC day) |
| `POST` | `/economy/gift` | Bearer | Send coins or diamonds to another player |
| `GET` | `/economy/transactions` | Bearer | Paginated transaction history |

#### POST /economy/daily-claim — Response
```json
// First claim of the day:
{ "claimed": true, "coinsAwarded": 200 }

// Already claimed:
{ "claimed": false, "message": "Already claimed today" }
```

#### POST /economy/gift
```json
Request:
{
  "receiverId": "uuid",
  "currency": "COINS",
  "amount": 100
}
```

#### GET /economy/transactions — Query params
| Param | Type | Description |
|-------|------|-------------|
| `page` | number | Page number (default 1) |
| `limit` | number | Items per page (default 20) |
| `currency` | `COINS` \| `DIAMONDS` | Filter by currency |
| `type` | TransactionType | Filter by type |

---

### 8.5 Rankings

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/rankings/classic` | Bearer | Classic mode leaderboard (by points) |
| `GET` | `/rankings/international` | Bearer | All-modes leaderboard (by wins) |
| `GET` | `/rankings/player/{userId}` | Bearer | A specific player's rank + surrounding context |

#### Query params (classic / international)
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | number | 1 | Page |
| `limit` | number | 20 | Items per page |

---

### 8.6 Friends

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/friends` | Bearer | Get own friend list |
| `POST` | `/friends/request` | Bearer | Send friend request |
| `PUT` | `/friends/request/{requestId}/accept` | Bearer | Accept a friend request |
| `PUT` | `/friends/request/{requestId}/decline` | Bearer | Decline a friend request |
| `GET` | `/friends/requests/incoming` | Bearer | Incoming pending requests |
| `GET` | `/friends/requests/sent` | Bearer | Sent requests awaiting response |
| `DELETE` | `/friends/{friendId}` | Bearer | Remove a friend |
| `POST` | `/friends/block` | Bearer | Block a player |
| `DELETE` | `/friends/block/{userId}` | Bearer | Unblock a player |
| `GET` | `/friends/blocked` | Bearer | List blocked users |

#### POST /friends/request
```json
Request:  { "userId": "target-user-uuid" }
Response: { "id": "request-uuid", "senderId": "...", "receiverId": "...", "status": "PENDING" }
```

> **Note:** The body field is `userId` (not `receiverId`).

---

### 8.7 Missions

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/missions` | Bearer | Get active missions with own progress |
| `POST` | `/missions/{missionId}/claim` | Bearer | Claim reward for a completed mission |

#### GET /missions — Response
```json
{
  "daily": [
    {
      "id": "progress-uuid",
      "missionId": "mission-uuid",
      "currentValue": 2,
      "isCompleted": false,
      "isClaimed": false,
      "mission": {
        "title": "Play 3 Games",
        "requirement": "PLAY_GAMES",
        "targetValue": 3,
        "rewardCoins": 150,
        "rewardDiamonds": 0
      }
    }
  ],
  "weekly": [ ... ]
}
```

> **Note:** Pass the **progress ID** (not the mission ID) to `/missions/{id}/claim`.

---

### 8.8 Notifications

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/notifications` | Bearer | Paginated notification list |
| `GET` | `/notifications/unread-count` | Bearer | Total unread count |
| `PUT` | `/notifications/{notificationId}/read` | Bearer | Mark single notification as read |
| `PUT` | `/notifications/read-all` | Bearer | Mark all as read |
| `DELETE` | `/notifications/{notificationId}` | Bearer | Delete a notification |

---

### 8.9 Shop

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/shop/catalog` | Bearer | Browse shop items (filter by category) |
| `GET` | `/shop/item/{itemId}` | Bearer | Get single item detail |
| `POST` | `/shop/purchase` | Bearer | Purchase an item with coins or diamonds |
| `POST` | `/shop/redeem` | Bearer | Redeem a promo code |
| `GET` | `/shop/inventory` | Bearer | Own inventory (all purchased items) |
| `PUT` | `/shop/inventory/{itemId}/equip` | Bearer | Equip an owned cosmetic |
| `GET` | `/shop/equipped` | Bearer | Get all currently equipped items |

#### GET /shop/catalog — Query params
| Param | Type | Description |
|-------|------|-------------|
| `category` | string | `COINS`, `CARDS`, `TABLES`, `EMOJIS`, `SUBSCRIPTIONS`, `SPECIAL` |
| `page` | number | Page (default 1) |
| `limit` | number | Items per page (default 20) |

#### POST /shop/purchase
```json
Request:  { "itemId": "uuid" }
Response: { "message": "Purchase successful", "item": {...}, "newBalance": { "coins": 500, "diamonds": 10 } }
```

#### POST /shop/redeem
```json
Request:  { "code": "SUMMER25" }
Response: { "coinsAwarded": 200, "diamondsAwarded": 0, "itemAwarded": null }
```

---

### 8.10 Clubs

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/clubs` | Bearer | Search and browse clubs |
| `POST` | `/clubs` | Bearer | Create a new club |
| `GET` | `/clubs/{clubId}` | Bearer | Club detail with member list |
| `PUT` | `/clubs/{clubId}` | Bearer | Update club settings (Leader only) |
| `DELETE` | `/clubs/{clubId}` | Bearer | Delete the club (Leader only) |
| `POST` | `/clubs/{clubId}/join` | Bearer | Join an OPEN club instantly |
| `POST` | `/clubs/{clubId}/request` | Bearer | Request to join a REQUEST_BASED club |
| `PUT` | `/clubs/{clubId}/requests/{userId}/accept` | Bearer | Accept join request (Leader/Vice) |
| `PUT` | `/clubs/{clubId}/requests/{userId}/decline` | Bearer | Decline join request (Leader/Vice) |
| `POST` | `/clubs/{clubId}/leave` | Bearer | Leave the club |
| `DELETE` | `/clubs/{clubId}/members/{userId}` | Bearer | Remove a member (Leader/Vice) |
| `PUT` | `/clubs/{clubId}/members/{userId}/role` | Bearer | Assign role (Leader only) |

#### POST /clubs — Create Club
```json
Request:
{
  "name": "Team Alpha",
  "mode": "CLASSIC",
  "type": "OPEN",
  "welcomeMessage": "Welcome to Team Alpha!",
  "minPoints": 0
}
```

**Club modes:** `CLASSIC`, `PROFESSIONAL`  
**Club types:** `OPEN` (anyone can join), `REQUEST_BASED` (join request needed)

---

### 8.11 Matchmaking

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/matchmaking/join` | Bearer | Join the matchmaking queue |
| `DELETE` | `/matchmaking/leave` | Bearer | Leave the queue |
| `GET` | `/matchmaking/status` | Bearer | Get current queue status |

#### POST /matchmaking/join
```json
Request:
{
  "mode":    "CLASSIC",
  "variant": "TWO_VS_TWO"
}
```

**Modes:** `CLASSIC`, `PROFESSIONAL`  
**Variants:** `ONE_VS_ONE`, `TWO_VS_TWO`

When a match is found, the server emits `matchmaking:matched` via WebSocket with `{ roomId }`.

---

### 8.12 Rooms

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/rooms` | Bearer | List active / waiting rooms |
| `POST` | `/rooms` | Bearer | Create a private room |
| `GET` | `/rooms/{roomId}` | Bearer | Get room detail with player list |
| `POST` | `/rooms/{roomId}/join` | Bearer | Join an existing room |
| `POST` | `/rooms/{roomId}/leave` | Bearer | Leave a room before game starts |

#### POST /rooms — Create Room
```json
Request:
{
  "mode":      "CLASSIC",
  "variant":   "TWO_VS_TWO",
  "isPrivate": true
}
```

#### GET /rooms — Query params
| Param | Type | Description |
|-------|------|-------------|
| `mode` | `CLASSIC` \| `PROFESSIONAL` | Filter by mode |
| `variant` | `ONE_VS_ONE` \| `TWO_VS_TWO` | Filter by variant |
| `page` | number | Page |
| `limit` | number | Per page |

---

### 8.13 Game

All game move endpoints require the player to be an active participant in the game.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/game/{gameId}/state` | Bearer | Get current game state (own view only) |
| `POST` | `/game/{gameId}/move/draw` | Bearer | Draw from stock or discard pile |
| `POST` | `/game/{gameId}/move/meld` | Bearer | Play a meld from hand |
| `POST` | `/game/{gameId}/move/add-to-meld` | Bearer | Add cards to an existing meld |
| `POST` | `/game/{gameId}/move/discard` | Bearer | Discard a card to end your turn |
| `POST` | `/game/{gameId}/move/pickup-pot` | Bearer | Pick up the discard pot |

#### Game State Object (abbreviated)
```json
{
  "gameId": "uuid",
  "status": "IN_PROGRESS",
  "currentTurn": "player-uuid",
  "myHand": ["AS", "KH", "QD", ...],
  "melds": [ { "cards": ["7H","7D","7S"], "isClean": false } ],
  "stockCount": 42,
  "discardPile": ["5C"],
  "scores": { "team1": 120, "team2": 80 }
}
```

---

### 8.14 Messaging

> **Note:** Creating new conversations and sending messages is done via **WebSocket** (`chat:send` event). REST endpoints are for reading history only.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/messaging/conversations` | Bearer | List all conversations (direct + club) |
| `GET` | `/messaging/conversations/{id}/messages` | Bearer | Paginated message history |
| `PUT` | `/messaging/conversations/{id}/read` | Bearer | Mark conversation as read |
| `POST` | `/messaging/conversations/{id}/voice` | Bearer | Upload a voice message (max 2 MB) |

#### GET /messaging/conversations/{id}/messages — Query params
| Param | Type | Default |
|-------|------|---------|
| `page` | number | 1 |
| `limit` | number | 30 |
| `before` | ISO date | — (load messages before this date) |

---

### 8.15 Match History

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/match-history/me` | Bearer | Own paginated match history |
| `GET` | `/match-history/{matchId}` | Bearer | Full match detail with scores and moves |

#### GET /match-history/me — Query params
| Param | Type | Default |
|-------|------|---------|
| `page` | number | 1 |
| `limit` | number | 20 |

---

### 8.16 Cloud Scripting

Used by the Unity client to fetch live game config on startup.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/cloud-scripting/game-defaults` | Public | Get game default config (for Unity client) |
| `GET` | `/cloud-scripting/config` | Admin Bearer | Get all config values |
| `PUT` | `/cloud-scripting/config/{key}` | Admin Bearer | Set a config value at runtime |

---

## 9. Admin API Reference

> **Base path:** all admin routes are under `/v1/admin/`  
> **Authentication:** `Authorization: Bearer <adminToken>` (obtained from admin login)  
> **Roles:** `SUPER_ADMIN` > `MODERATOR`

---

### 9.1 Admin Auth

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/admin/auth/login` | Public | Admin login |

#### POST /admin/auth/login
```json
Request:  { "email": "admin@buraco.game", "password": "Admin@123!" }
Response: { "admin": { "id":"...", "name":"Super Admin", "role":"SUPER_ADMIN" }, "accessToken": "...", "expiresIn": 28800 }
```

---

### 9.2 Dashboard

| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| `GET` | `/admin/dashboard` | Any Admin | Platform stats snapshot |

#### Response
```json
{
  "totalUsers":    150,
  "activeUsers":   23,
  "newUsersToday": 5,
  "bannedUsers":   2,
  "totalGames":    410,
  "activeGames":   3,
  "gamesToday":    12,
  "totalRevenue":  890,
  "topPlayers": [
    { "id":"...", "username":"ChampionBR", "level":15, "points":45000, "winPercentage": 71.4 }
  ]
}
```

---

### 9.3 User Management

| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| `GET` | `/admin/users` | Any Admin | List users (paginated + search) |
| `GET` | `/admin/users/{userId}` | Any Admin | Full user detail (stats, transactions, notes) |
| `PATCH` | `/admin/users/{userId}` | SUPER_ADMIN | Edit any user field |
| `PATCH` | `/admin/users/{userId}/ban` | SUPER_ADMIN, MODERATOR | Ban or unban a user |
| `POST` | `/admin/users/{userId}/credit` | SUPER_ADMIN | Add coins or diamonds |
| `POST` | `/admin/users/{userId}/deduct` | SUPER_ADMIN | Remove coins or diamonds |
| `POST` | `/admin/users/{userId}/notes` | Any Admin | Add internal admin note |
| `POST` | `/admin/users/{userId}/send-item` | SUPER_ADMIN | Send a shop item to user's inventory |

#### GET /admin/users — Query params
| Param | Default | Description |
|-------|---------|-------------|
| `page` | 1 | Page |
| `limit` | 20 | Per page |
| `search` | — | Search by username or email |

#### PATCH /admin/users/{userId} — Edit User
```json
// All fields optional — only send fields to change
{
  "username": "NewName",
  "email": "new@email.com",
  "coins": 5000,
  "diamonds": 50,
  "lives": 10,
  "subscriptionStatus": "PREMIUM"
}
```

#### POST /admin/users/{userId}/credit
```json
Request:  { "currency": "COINS", "amount": 500, "reason": "Compensation for bug" }
Response: { "message": "Credited 500 COINS" }
```

#### POST /admin/users/{userId}/send-item
```json
Request:  { "itemId": "shop-item-uuid" }
Response: { "message": "Item \"Gold Foil Deck\" sent to ChampionBR" }
```

#### PATCH /admin/users/{userId}/ban
```json
Request:  { "isBanned": true, "reason": "Cheating" }
Response: { "message": "User banned" }
```

---

### 9.4 Leaderboard Management

| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| `GET` | `/admin/leaderboard` | Any Admin | Full paginated leaderboard |
| `POST` | `/admin/leaderboard/{userId}/reset` | SUPER_ADMIN, MODERATOR | Reset player stats to zero |
| `PATCH` | `/admin/leaderboard/{userId}/score` | SUPER_ADMIN | Manually set points and/or level |

#### GET /admin/leaderboard — Query params
| Param | Default | Options |
|-------|---------|---------|
| `page` | 1 | — |
| `limit` | 20 | — |
| `sort` | `points` | `points`, `winPercentage`, `gamesPlayed`, `level` |

#### PATCH /admin/leaderboard/{userId}/score
```json
Request:  { "points": 10000, "level": 20 }
Response: { "message": "Score updated" }
```

---

### 9.5 Game Management

| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| `GET` | `/admin/games` | Any Admin | List game sessions (paginated) |
| `PATCH` | `/admin/games/{gameId}/void` | SUPER_ADMIN, MODERATOR | Void a game session |

#### GET /admin/games — Query params
| Param | Description |
|-------|-------------|
| `page`, `limit` | Pagination |
| `status` | Filter: `WAITING`, `IN_PROGRESS`, `FINISHED`, `VOIDED` |

#### PATCH /admin/games/{gameId}/void
```json
Request:  { "reason": "Player reported cheating" }
Response: { "message": "Game voided" }
```

---

### 9.6 Shop Management

| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| `GET` | `/admin/shop/items` | Any Admin | List all shop items |
| `POST` | `/admin/shop/items` | SUPER_ADMIN | Create a new shop item |
| `PATCH` | `/admin/shop/items/{itemId}/toggle` | SUPER_ADMIN | Activate / deactivate an item |

#### POST /admin/shop/items
```json
{
  "name": "Diamond Deck",
  "description": "Exclusive diamond-themed card design",
  "category": "CARDS",
  "priceDiamonds": 35,
  "isConsumable": false
}
```

**Categories:** `COINS`, `CARDS`, `TABLES`, `EMOJIS`, `SUBSCRIPTIONS`, `SPECIAL`

---

### 9.7 Promo Codes

| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| `POST` | `/admin/promos` | SUPER_ADMIN | Create promo code |
| `GET` | `/admin/promos` | Any Admin | List all promo codes |
| `PATCH` | `/admin/promos/{promoId}/toggle` | SUPER_ADMIN | Activate / deactivate a promo |

#### POST /admin/promos
```json
{
  "code": "LAUNCH50",
  "rewardCoins": 500,
  "rewardDiamonds": 0,
  "maxUses": 1000,
  "expiresAt": "2027-01-01T00:00:00Z"
}
```

---

### 9.8 Clubs Management

| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| `GET` | `/admin/clubs` | Any Admin | List all clubs |
| `GET` | `/admin/clubs/{clubId}` | Any Admin | Club detail with all members |
| `DELETE` | `/admin/clubs/{clubId}` | SUPER_ADMIN, MODERATOR | Permanently delete a club |
| `DELETE` | `/admin/clubs/{clubId}/members/{userId}` | SUPER_ADMIN, MODERATOR | Remove a member from a club |

---

### 9.9 Missions Management

| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| `GET` | `/admin/missions` | Any Admin | List all missions |
| `PATCH` | `/admin/missions/{missionId}/toggle` | Any Admin | Toggle mission active/inactive |

---

### 9.10 Broadcast

| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| `POST` | `/admin/broadcast` | SUPER_ADMIN, MODERATOR | Send notification to all users |

```json
Request:  { "title": "Maintenance Tonight", "body": "Servers will be down 2–4 AM UTC." }
Response: { "message": "Broadcast sent to 150 users" }
```

---

### 9.11 System Config

| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| `GET` | `/admin/config` | Any Admin | List all 29 config keys with values |
| `PUT` | `/admin/config/{key}` | SUPER_ADMIN | Set a config value |

```json
// PUT /admin/config/new_user_coins
Request:  { "value": "1500" }
Response: { "key": "new_user_coins", "value": "1500", "updatedAt": "..." }
```

**Config keys and their purpose:**

| Key | Type | Description |
|-----|------|-------------|
| `maintenance_mode` | boolean | `"true"` takes the app offline |
| `min_version_ios` | string | Minimum iOS app version |
| `min_version_android` | string | Minimum Android app version |
| `turn_duration_seconds` | number | Seconds per player turn |
| `disconnect_timeout_seconds` | number | Seconds before auto-remove on disconnect |
| `new_user_coins` | number | Coins on first registration |
| `new_user_diamonds` | number | Diamonds on first registration |
| `new_user_lives` | number | Lives on first registration |
| `daily_login_reward_coins` | number | Daily claim reward amount |
| `classic_entry_fee` | number | Coins to enter Classic match |
| `professional_entry_fee` | number | Coins to enter Professional match |
| `max_club_members` | number | Max members per club |
| `throttle_ttl_seconds` | number | Rate limit window |
| `throttle_limit` | number | Max requests per window |
| `google_client_id` | string | Google OAuth client ID |
| `google_client_secret` | secret | Google OAuth client secret |
| `apple_client_id` | string | Apple Sign-In services ID |
| `apple_team_id` | string | Apple Developer Team ID |
| `apple_key_id` | string | Apple Sign-In key ID |
| `apple_private_key` | secret | Apple .p8 key contents |
| `aws_region` | string | AWS region (e.g. `us-east-1`) |
| `aws_access_key_id` | string | AWS IAM access key |
| `aws_secret_access_key` | secret | AWS IAM secret key |
| `aws_s3_bucket` | string | S3 bucket name for uploads |
| `smtp_host` | string | SMTP server hostname |
| `smtp_port` | number | SMTP port (587 or 465) |
| `smtp_user` | string | SMTP login username |
| `smtp_pass` | secret | SMTP password |
| `smtp_from` | string | From address for emails |

> Config changes take effect within **60 seconds** (in-memory TTL). Secret fields are masked in the admin panel — click "Reveal" to see them.

---

### 9.12 Audit Logs

| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| `GET` | `/admin/audit-logs` | Any Admin | Paginated log of all admin actions |

Every admin action (ban, credit, config change, etc.) is automatically logged with: admin ID, action name, target type, target ID, details, and timestamp.

---

## 10. Data Models

### User
| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Unique identifier |
| `username` | string | Display name (3–30 chars) |
| `email` | string? | Email address |
| `avatarUrl` | string? | Avatar URL |
| `coins` | int | In-game coin balance |
| `diamonds` | int | Premium currency balance |
| `lives` | int | Lives remaining |
| `subscriptionStatus` | enum | `FREE`, `BASIC`, `PREMIUM` |
| `isBanned` | bool | Whether account is banned |
| `createdAt` | datetime | Registration date |
| `lastSeenAt` | datetime? | Last activity |

### PlayerStats
| Field | Type | Description |
|-------|------|-------------|
| `level` | int | Player level |
| `points` | int | Total points |
| `gamesPlayed` | int | Total games played |
| `winPercentage` | float | Win rate (0–100) |
| `winStreak` | int | Current win streak |
| `bestWinStreak` | int | All-time best streak |

### Transaction Types
`REWARD` · `PURCHASE` · `ENTRY_FEE` · `ENTRY_FEE_REFUND` · `GIFT_SENT` · `GIFT_RECEIVED` · `MISSION_REWARD` · `MANUAL_CREDIT` · `MANUAL_DEDUCT` · `SUBSCRIPTION`

### Game Status Values
`WAITING` · `IN_PROGRESS` · `FINISHED` · `VOIDED`

### Friendship Status Values
`PENDING` · `ACCEPTED` · `DECLINED`

---

## 11. Integration Credentials Setup

All third-party credentials can be set either in `.env` (local fallback) or live via the **Admin Panel → System Config → Integrations** section. DB values override `.env`.

### Google Sign-In
1. Go to [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials
2. Create an OAuth 2.0 Client ID
3. Set `google_client_id` and `google_client_secret` in admin config

### Apple Sign-In
1. Apple Developer → Certificates, IDs & Profiles → Keys → create a Sign in with Apple key
2. Download the `.p8` file
3. Set `apple_client_id` (Services ID), `apple_team_id`, `apple_key_id`, and paste the full `.p8` file content into `apple_private_key`

### AWS S3 (Avatar Uploads)
1. Create an S3 bucket and an IAM user with `s3:PutObject` permission on that bucket
2. Set `aws_region`, `aws_access_key_id`, `aws_secret_access_key`, `aws_s3_bucket` in admin config

### Email / SMTP
For Gmail:
1. Enable 2-Step Verification on your Google account
2. Go to Google Account → Security → App Passwords → generate one
3. Set `smtp_host=smtp.gmail.com`, `smtp_port=587`, `smtp_user=you@gmail.com`, `smtp_pass=<app password>`

---

*For questions or integration support, refer to the interactive Swagger docs at `/api/docs` or contact the backend team.*
