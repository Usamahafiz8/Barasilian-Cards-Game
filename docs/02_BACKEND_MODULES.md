# Backend Modules — NestJS

Each module follows NestJS conventions: `module.ts`, `controller.ts`, `service.ts`, `dto/`, `entities/`.  
All inputs validated via `class-validator` DTOs. All routes protected by `JwtAuthGuard` unless marked public.

---

## Module 1 — Auth

**Path:** `src/modules/auth/`

### Responsibilities
- Register and authenticate users via Email/Password, Google OAuth2, Apple Sign-In
- Issue and refresh JWT access tokens
- Manage logout and session invalidation (Redis token blacklist)
- Password reset flow via email OTP

### Files
```
auth/
├── auth.module.ts
├── auth.controller.ts
├── auth.service.ts
├── strategies/
│   ├── jwt.strategy.ts
│   ├── google.strategy.ts
│   └── apple.strategy.ts
├── guards/
│   └── jwt-auth.guard.ts
└── dto/
    ├── register.dto.ts
    ├── login.dto.ts
    ├── refresh-token.dto.ts
    ├── forgot-password.dto.ts
    ├── reset-password.dto.ts
    └── change-password.dto.ts
```

### DTOs
```typescript
// register.dto.ts
class RegisterDto {
  email: string;          // @IsEmail
  password: string;       // @MinLength(8)
  username: string;       // @MinLength(3) @MaxLength(20)
}

// login.dto.ts
class LoginDto {
  email: string;
  password: string;
}

// reset-password.dto.ts
class ResetPasswordDto {
  token: string;
  newPassword: string;    // @MinLength(8)
}
```

### Service Methods
| Method | Description |
|--------|-------------|
| `register(dto)` | Hash password, create user, return tokens |
| `login(dto)` | Validate credentials, return access + refresh tokens |
| `loginWithGoogle(profile)` | Find or create user from Google profile |
| `loginWithApple(profile)` | Find or create user from Apple profile |
| `refreshToken(token)` | Validate refresh token, issue new access token |
| `logout(userId, token)` | Blacklist token in Redis |
| `forgotPassword(email)` | Generate OTP, send reset email |
| `resetPassword(dto)` | Validate OTP, update hashed password |
| `changePassword(userId, dto)` | Validate old password, update |
| `deleteAccount(userId)` | Soft delete user, revoke all tokens |
| `updateEmail(userId, email)` | Update email with verification |
| `validateJwt(payload)` | Passport strategy validator |

### Token Strategy
- **Access Token:** 15 minutes TTL, signed with `JWT_SECRET`
- **Refresh Token:** 30 days TTL, stored hash in DB, used once (rotation)
- **Blacklist:** Redis SET `blacklist:{token}` with TTL matching token expiry

---

## Module 2 — Users

**Path:** `src/modules/users/`

### Responsibilities
- Core user entity management
- Internal service used by all other modules
- Not directly exposed as a public API (auth/profile handle that)

### Files
```
users/
├── users.module.ts
├── users.service.ts
└── entities/
    └── user.entity.ts
```

### User Entity (Prisma Model)
```prisma
model User {
  id               String    @id @default(uuid())
  email            String?   @unique
  passwordHash     String?
  googleId         String?   @unique
  appleId          String?   @unique
  username         String    @unique
  avatarUrl        String?
  registrationDate DateTime  @default(now())
  coins            Int       @default(1000)
  diamonds         Int       @default(0)
  lives            Int       @default(5)
  subscriptionStatus SubscriptionStatus @default(FREE)
  isDeleted        Boolean   @default(false)
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt
}
```

### Service Methods
| Method | Description |
|--------|-------------|
| `findById(id)` | Get user by UUID |
| `findByEmail(email)` | Get user by email |
| `findByUsername(username)` | Get user by username |
| `create(data)` | Create new user record |
| `update(id, data)` | Partial update user |
| `softDelete(id)` | Mark isDeleted=true |
| `exists(id)` | Boolean check |

---

## Module 3 — Profile

**Path:** `src/modules/profile/`

### Responsibilities
- Editable username, avatar management
- Public profile view (for other players to see)
- Avatar upload to S3 (camera/gallery/predefined)

### Files
```
profile/
├── profile.module.ts
├── profile.controller.ts
├── profile.service.ts
└── dto/
    ├── update-profile.dto.ts
    └── upload-avatar.dto.ts
```

### DTOs
```typescript
class UpdateProfileDto {
  username?: string;      // @IsOptional @MinLength(3) @MaxLength(20)
}

class UploadAvatarDto {
  type: 'upload' | 'predefined';
  predefinedId?: string;  // if type = predefined
  // file handled via @UseInterceptors(FileInterceptor)
}
```

### Service Methods
| Method | Description |
|--------|-------------|
| `getProfile(userId)` | Full profile with stats summary |
| `getPublicProfile(userId)` | Public view (for other players) |
| `updateUsername(userId, username)` | Validate uniqueness, update |
| `uploadAvatar(userId, file)` | Upload to S3, save URL |
| `setAvatarFromSocial(userId, url)` | Set Apple/Google profile picture |
| `setPredefinedAvatar(userId, id)` | Set from predefined list |
| `getPredefinedAvatars()` | Return catalog of predefined avatars |

---

## Module 4 — Stats

**Path:** `src/modules/stats/`

### Responsibilities
- Track all player performance metrics
- Calculate level and experience
- Updated automatically after each match

### Files
```
stats/
├── stats.module.ts
├── stats.controller.ts
├── stats.service.ts
└── entities/
    └── player-stats.entity.ts
```

### PlayerStats Entity
```prisma
model PlayerStats {
  id             String  @id @default(uuid())
  userId         String  @unique
  user           User    @relation(fields: [userId], references: [id])
  points         Int     @default(0)
  level          Int     @default(1)
  experience     Int     @default(0)
  gamesPlayed    Int     @default(0)
  wins           Int     @default(0)
  losses         Int     @default(0)
  gamesLeft      Int     @default(0)
  winStreak      Int     @default(0)
  bestWinStreak  Int     @default(0)
  winPercentage  Float   @default(0.0)
}
```

### Level Progression Formula
```
Level 1–10:   XP needed = level * 100
Level 11–30:  XP needed = level * 200
Level 31+:    XP needed = level * 350
```

### Service Methods
| Method | Description |
|--------|-------------|
| `getStats(userId)` | Get full stats |
| `updateAfterMatch(userId, result)` | Increment wins/losses/XP/streak |
| `calculateLevel(xp)` | Pure function: XP → level |
| `recalculateWinPercentage(userId)` | Update derived field |
| `addPoints(userId, points)` | Add ranking points |
| `resetStreak(userId)` | Reset streak on loss |

---

## Module 5 — Economy

**Path:** `src/modules/economy/`

### Responsibilities
- All currency transactions (coins, diamonds)
- Entry fee deduction before match start
- Reward distribution after match
- Purchase logging (audit trail)
- Gift system between players

### Files
```
economy/
├── economy.module.ts
├── economy.controller.ts
├── economy.service.ts
├── entities/
│   └── transaction.entity.ts
└── dto/
    ├── add-currency.dto.ts
    ├── deduct-currency.dto.ts
    └── gift.dto.ts
```

### Transaction Entity
```prisma
model Transaction {
  id          String          @id @default(uuid())
  userId      String
  user        User            @relation(fields: [userId], references: [id])
  type        TransactionType // REWARD, PURCHASE, ENTRY_FEE, GIFT_SENT, GIFT_RECEIVED, MISSION_REWARD
  currency    CurrencyType    // COINS, DIAMONDS
  amount      Int
  balanceBefore Int
  balanceAfter  Int
  referenceId String?         // matchId, shopItemId, etc.
  description String?
  createdAt   DateTime        @default(now())
}
```

### Service Methods
| Method | Description |
|--------|-------------|
| `getBalance(userId)` | Return coins + diamonds |
| `addCoins(userId, amount, type, ref?)` | Credit coins with log |
| `deductCoins(userId, amount, type, ref?)` | Debit coins, check balance |
| `addDiamonds(userId, amount, type, ref?)` | Credit diamonds with log |
| `deductDiamonds(userId, amount, type, ref?)` | Debit diamonds |
| `deductEntryFee(userId, matchId, fee)` | Atomic entry fee deduction |
| `distributeMatchReward(userId, matchId, amount)` | Post-match reward |
| `sendGift(senderId, receiverId, amount, currency)` | Transfer between users |
| `getTransactionHistory(userId, pagination)` | Paginated history |

### Entry Fee Logic
- Deducted atomically when player **joins** a room (not starts game)
- If match fails to start, fee is refunded automatically
- All deductions wrapped in DB transactions to prevent race conditions

---

## Module 6 — Missions

**Path:** `src/modules/missions/`

### Responsibilities
- Define and manage daily/weekly missions
- Track per-player mission progress
- Handle reward claiming

### Files
```
missions/
├── missions.module.ts
├── missions.controller.ts
├── missions.service.ts
├── missions.scheduler.ts    ← @Cron daily/weekly reset
├── entities/
│   ├── mission.entity.ts
│   └── mission-progress.entity.ts
└── dto/
    └── claim-reward.dto.ts
```

### Mission Entity
```prisma
model Mission {
  id           String       @id @default(uuid())
  title        String
  description  String
  type         MissionType  // DAILY, WEEKLY
  requirement  MissionReq   // PLAY_GAMES, WIN_GAMES, EARN_POINTS, etc.
  targetValue  Int          // e.g., play 5 games
  rewardCoins  Int          @default(0)
  rewardDiamonds Int        @default(0)
  isActive     Boolean      @default(true)
  resetAt      DateTime?
}

model MissionProgress {
  id          String   @id @default(uuid())
  userId      String
  missionId   String
  currentValue Int     @default(0)
  isCompleted  Boolean @default(false)
  isClaimed    Boolean @default(false)
  assignedAt  DateTime @default(now())
  claimedAt   DateTime?
}
```

### Service Methods
| Method | Description |
|--------|-------------|
| `getActiveMissions(userId)` | Return daily + weekly with progress |
| `claimReward(userId, missionId)` | Validate completed, distribute reward |
| `updateProgress(userId, event, value)` | Called by game engine after events |
| `assignDailyMissions(userId)` | Called by cron, assign new daily set |
| `assignWeeklyMissions(userId)` | Called by cron, assign new weekly set |
| `resetDailyMissions()` | Cron: midnight UTC reset |
| `resetWeeklyMissions()` | Cron: Monday UTC reset |

---

## Module 7 — Friends

**Path:** `src/modules/friends/`

### Responsibilities
- Send, accept, decline friend requests
- Remove friends
- Block/unblock users
- Used by messaging and ranking to check relationships

### Files
```
friends/
├── friends.module.ts
├── friends.controller.ts
├── friends.service.ts
├── entities/
│   ├── friendship.entity.ts
│   └── block.entity.ts
└── dto/
    ├── friend-request.dto.ts
    └── respond-request.dto.ts
```

### Entities
```prisma
model Friendship {
  id         String           @id @default(uuid())
  senderId   String
  receiverId String
  status     FriendshipStatus // PENDING, ACCEPTED, DECLINED
  createdAt  DateTime         @default(now())
  updatedAt  DateTime         @updatedAt
}

model Block {
  id        String   @id @default(uuid())
  blockerId String
  blockedId String
  createdAt DateTime @default(now())
}
```

### Service Methods
| Method | Description |
|--------|-------------|
| `sendRequest(senderId, receiverId)` | Create PENDING friendship |
| `acceptRequest(userId, requestId)` | Set status = ACCEPTED |
| `declineRequest(userId, requestId)` | Set status = DECLINED |
| `removeFriend(userId, friendId)` | Delete friendship record |
| `blockUser(userId, targetId)` | Create block, remove friendship if exists |
| `unblockUser(userId, targetId)` | Delete block record |
| `getFriends(userId)` | List all ACCEPTED friends |
| `getPendingRequests(userId)` | Incoming PENDING requests |
| `getSentRequests(userId)` | Outgoing PENDING requests |
| `isBlocked(userId, targetId)` | Boolean check |
| `isFriend(userId, targetId)` | Boolean check |

---

## Module 8 — Messaging

**Path:** `src/modules/messaging/`

### Responsibilities
- One-to-one chat between friends
- Group chat within clubs
- Text and voice messages
- Persistent message history
- Real-time delivery via WebSocket

### Files
```
messaging/
├── messaging.module.ts
├── messaging.controller.ts   ← History fetch (REST)
├── messaging.service.ts
├── messaging.gateway.ts      ← WebSocket events
├── entities/
│   ├── conversation.entity.ts
│   └── message.entity.ts
└── dto/
    ├── send-message.dto.ts
    └── get-history.dto.ts
```

### Entities
```prisma
model Conversation {
  id        String           @id @default(uuid())
  type      ConversationType // DIRECT, CLUB
  clubId    String?
  createdAt DateTime         @default(now())
  messages  Message[]
  members   ConversationMember[]
}

model Message {
  id             String      @id @default(uuid())
  conversationId String
  senderId       String
  type           MessageType // TEXT, VOICE
  content        String?     // text content
  voiceUrl       String?     // S3 URL for voice
  duration       Int?        // voice duration in seconds
  isRead         Boolean     @default(false)
  createdAt      DateTime    @default(now())
}
```

### Service Methods
| Method | Description |
|--------|-------------|
| `getOrCreateDirectConversation(u1, u2)` | Find or create 1:1 conversation |
| `getClubConversation(clubId)` | Get club group conversation |
| `sendMessage(conversationId, senderId, dto)` | Persist + emit WS event |
| `sendVoiceMessage(conversationId, senderId, file)` | Upload to S3, persist |
| `getHistory(conversationId, pagination)` | Paginated message history |
| `markAsRead(conversationId, userId)` | Mark messages read |
| `getUnreadCount(userId)` | Count unread across all conversations |

---

## Module 9 — Clubs

**Path:** `src/modules/clubs/`

### Responsibilities
- Club creation and configuration
- Open join vs. request-based membership
- Role management (Leader, Vice Leader, Member)
- Club level and progression
- Club group chat link

### Files
```
clubs/
├── clubs.module.ts
├── clubs.controller.ts
├── clubs.service.ts
├── entities/
│   ├── club.entity.ts
│   └── club-member.entity.ts
└── dto/
    ├── create-club.dto.ts
    ├── update-club.dto.ts
    └── respond-join-request.dto.ts
```

### Entities
```prisma
model Club {
  id              String    @id @default(uuid())
  name            String    @unique
  iconUrl         String?
  welcomeMessage  String?
  mode            ClubMode  // CLASSIC, PROFESSIONAL
  type            ClubType  // OPEN, REQUEST_BASED
  minPoints       Int       @default(0)  // entry requirement
  level           Int       @default(1)
  points          Int       @default(0)
  memberCount     Int       @default(0)
  createdAt       DateTime  @default(now())
}

model ClubMember {
  id       String   @id @default(uuid())
  clubId   String
  userId   String
  role     ClubRole // LEADER, VICE_LEADER, MEMBER
  status   MemberStatus // ACTIVE, PENDING
  joinedAt DateTime @default(now())
}
```

### Service Methods
| Method | Description |
|--------|-------------|
| `createClub(userId, dto)` | Create club, assign creator as LEADER |
| `updateClub(leaderId, clubId, dto)` | Update club settings |
| `deleteClub(leaderId, clubId)` | Delete club and all memberships |
| `joinClub(userId, clubId)` | Direct join (OPEN type) |
| `requestToJoin(userId, clubId)` | Create PENDING membership |
| `respondToRequest(leaderId, memberId, accept)` | Accept or reject |
| `removeMember(leaderId, memberId)` | Kick member |
| `assignRole(leaderId, memberId, role)` | Promote/demote |
| `leaveClub(userId, clubId)` | Self-leave |
| `getClub(clubId)` | Club details with members |
| `searchClubs(query)` | Search by name |
| `getClubMembers(clubId)` | Member list with avatar + level |
| `addClubPoints(clubId, points)` | Called after match, level progression |

---

## Module 10 — Rankings

**Path:** `src/modules/rankings/`

### Responsibilities
- Classic and international leaderboards
- Paginated ranking lists
- Player detail view from ranking

### Files
```
rankings/
├── rankings.module.ts
├── rankings.controller.ts
├── rankings.service.ts
└── dto/
    └── get-rankings.dto.ts
```

### Service Methods
| Method | Description |
|--------|-------------|
| `getClassicRanking(pagination)` | Sorted by points DESC |
| `getInternationalRanking(pagination)` | Sorted by points DESC, global |
| `getPlayerRank(userId, type)` | Get specific player's rank position |
| `getRankedPlayerDetail(userId)` | Profile + stats + club info |

### Ranking Calculation
- Rankings are recalculated after each match via `StatsService.addPoints()`
- Redis sorted set `ranking:classic` and `ranking:international` for O(log n) rank lookup
- DB persists the canonical source; Redis is the fast read layer

---

## Module 11 — Shop & Inventory

**Path:** `src/modules/shop/`

### Responsibilities
- Item catalog across 8 categories
- Purchase flow with currency validation
- Inventory management per player
- Cosmetic unlock tracking

### Files
```
shop/
├── shop.module.ts
├── shop.controller.ts
├── shop.service.ts
├── entities/
│   ├── shop-item.entity.ts
│   └── inventory.entity.ts
└── dto/
    ├── purchase-item.dto.ts
    └── get-catalog.dto.ts
```

### Entities
```prisma
model ShopItem {
  id          String       @id @default(uuid())
  name        String
  description String?
  category    ShopCategory // HOME, SUBSCRIPTIONS, COINS, EMOJIS, TABLES, CARDS, SPECIAL, REDEEM
  priceCoins  Int?
  priceDiamonds Int?
  imageUrl    String?
  isActive    Boolean      @default(true)
  isConsumable Boolean     @default(false)
}

model Inventory {
  id         String   @id @default(uuid())
  userId     String
  itemId     String
  item       ShopItem @relation(fields: [itemId], references: [id])
  quantity   Int      @default(1)
  equippedAt DateTime?
  purchasedAt DateTime @default(now())
}
```

### Service Methods
| Method | Description |
|--------|-------------|
| `getCatalog(category?)` | All active items, optionally filtered |
| `getItemById(itemId)` | Single item detail |
| `purchaseItem(userId, itemId)` | Validate balance, deduct, add to inventory |
| `getInventory(userId)` | All owned items |
| `equipItem(userId, itemId)` | Set as active cosmetic |
| `getEquipped(userId)` | Current equipped cosmetics |
| `redeemCode(userId, code)` | Redeem promo code for item/currency |

---

## Module 12 — Notifications

**Path:** `src/modules/notifications/`

### Responsibilities
- Create and deliver in-app notifications
- Personal and club-level notifications
- Mark read / delete
- Push notification support (FCM)

### Files
```
notifications/
├── notifications.module.ts
├── notifications.controller.ts
├── notifications.service.ts
├── entities/
│   └── notification.entity.ts
└── dto/
    └── create-notification.dto.ts
```

### Notification Entity
```prisma
model Notification {
  id        String           @id @default(uuid())
  userId    String
  type      NotificationType // FRIEND_REQUEST, CLUB_UPDATE, REWARD, SYSTEM, MATCH_INVITE
  title     String
  body      String
  data      Json?            // extra payload (e.g., requestId, clubId)
  isRead    Boolean          @default(false)
  createdAt DateTime         @default(now())
}
```

### Service Methods
| Method | Description |
|--------|-------------|
| `createNotification(userId, dto)` | Create + emit via WebSocket |
| `getNotifications(userId, pagination)` | Get all notifications |
| `getUnreadCount(userId)` | Count unread |
| `markAsRead(userId, notificationId)` | Mark single read |
| `markAllAsRead(userId)` | Mark all read |
| `deleteNotification(userId, id)` | Delete notification |
| `sendPushNotification(userId, payload)` | FCM/APNS push |

---

## Module 13 — Matchmaking

**Path:** `src/modules/matchmaking/`

### Responsibilities
- Queue management per game mode
- Player assignment to tables
- Skill/level-based matching (optional)
- Entry fee validation before queuing

### Files
```
matchmaking/
├── matchmaking.module.ts
├── matchmaking.controller.ts
├── matchmaking.service.ts
├── matchmaking.gateway.ts   ← WebSocket queue events
└── dto/
    ├── join-queue.dto.ts
    └── leave-queue.dto.ts
```

### Queue Structure (Redis)
```
queue:classic:1v1      → sorted set (score = timestamp, member = userId)
queue:classic:2v2      → sorted set
queue:professional:1v1 → sorted set
queue:professional:2v2 → sorted set
```

### Service Methods
| Method | Description |
|--------|-------------|
| `joinQueue(userId, mode, variant)` | Validate entry fee, push to Redis queue |
| `leaveQueue(userId)` | Remove from all queues |
| `processQueues()` | Cron/timer: pop matched players, create room |
| `findMatch(userId, mode)` | Pull best match from queue |
| `isInQueue(userId)` | Boolean check |
| `getQueuePosition(userId)` | Position in queue |

### Matching Logic
1. Player joins queue → deduct entry fee → add to Redis sorted set
2. Every 2s, background job checks each queue
3. When enough players found (2 for 1v1, 4 for 2v2), create room
4. Emit `match_found` WebSocket event to all assigned players
5. Players auto-join room via reconnection token

---

## Module 14 — Rooms (Live Tables)

**Path:** `src/modules/rooms/`

### Responsibilities
- Create, join, leave game tables
- Manage room state machine
- Real-time room list updates
- Entry requirement enforcement

### Files
```
rooms/
├── rooms.module.ts
├── rooms.controller.ts
├── rooms.service.ts
├── rooms.gateway.ts     ← WebSocket room events
├── entities/
│   └── room.entity.ts
└── dto/
    ├── create-room.dto.ts
    └── join-room.dto.ts
```

### Room Entity
```prisma
model Room {
  id              String     @id @default(uuid())
  mode            GameMode   // CLASSIC, PROFESSIONAL
  variant         GameVariant // ONE_VS_ONE, TWO_VS_TWO
  status          RoomStatus // EMPTY, WAITING, READY, IN_PROGRESS, FULL
  maxPlayers      Int
  currentPlayers  Int        @default(0)
  turnDuration    Int        @default(30)  // seconds
  minLevel        Int?
  minPoints       Int?
  entryFeeCoins   Int        @default(0)
  gameId          String?    // linked GameSession when started
  createdAt       DateTime   @default(now())
}
```

### Room State Machine
```
EMPTY → WAITING (first player joins)
WAITING → READY (minimum players reached)
WAITING → FULL (all slots filled before game start)
READY → IN_PROGRESS (game started by engine)
IN_PROGRESS → EMPTY (game ended, room cleared)
```

### Service Methods
| Method | Description |
|--------|-------------|
| `createRoom(userId, dto)` | Create room with settings |
| `joinRoom(userId, roomId)` | Validate requirements, add player |
| `leaveRoom(userId, roomId)` | Remove player, update state |
| `getRoomList(filters)` | All active rooms with player previews |
| `getRoom(roomId)` | Single room detail |
| `startGame(roomId)` | Transition to IN_PROGRESS, call GameEngine |
| `broadcastRoomUpdate(roomId)` | Emit `room_list_update` to all connected |
| `cleanupEmptyRooms()` | Cron: remove stale empty rooms |

---

## Module 15 — Game Engine

**Path:** `src/modules/game-engine/`

### Responsibilities
- Full server-side Buraco game logic
- Deck generation, shuffle, card distribution
- Turn management and validation
- Rule enforcement
- Score calculation
- Match result handling

### Files
```
game-engine/
├── game-engine.module.ts
├── game-engine.service.ts
├── game-engine.gateway.ts  ← WebSocket gameplay events
├── buraco/
│   ├── deck.ts             ← Deck generation + shuffle
│   ├── rules.ts            ← Buraco rule set
│   ├── scoring.ts          ← Point calculation
│   └── turn-manager.ts     ← Turn timer + validation
├── entities/
│   ├── game-session.entity.ts
│   └── game-move.entity.ts
└── dto/
    ├── play-card.dto.ts
    └── draw-card.dto.ts
```

### Game Session Entity
```prisma
model GameSession {
  id          String      @id @default(uuid())
  roomId      String
  mode        GameMode
  variant     GameVariant
  status      GameStatus  // WAITING, IN_PROGRESS, COMPLETED, ABANDONED
  players     GamePlayer[]
  gameState   Json        // full serialized game state (stored in Redis during game)
  startedAt   DateTime?
  endedAt     DateTime?
  winnerId    String?
  winnerTeam  Int?
}

model GameMove {
  id          String   @id @default(uuid())
  gameId      String
  playerId    String
  turnNumber  Int
  moveType    MoveType // DRAW_STOCK, DRAW_DISCARD, PLAY_MELD, DISCARD
  cardData    Json
  isValid     Boolean
  timestamp   DateTime @default(now())
}
```

### Buraco Rules Engine
```typescript
// Core Buraco rules implemented:
// - 2 decks (108 cards including jokers)
// - 11 cards dealt to each player
// - Pot piles (2 piles of 11 cards face-down)
// - Draw from stock or discard pile
// - Form melds (sequences or sets of 3+)
// - Natural canastas (7 cards, no jokers)
// - Dirty canastas (with jokers/wilds)
// - Clean the hand = pick up pot pile
// - Buraco bonus (complete hand before picking pot)
// - Scoring: card values + canasta bonuses - unmelded penalties
```

### Service Methods
| Method | Description |
|--------|-------------|
| `startGame(roomId)` | Initialize game state, deal cards |
| `generateDeck()` | Create 2x52 + 4 jokers = 108 cards |
| `shuffleDeck(deck)` | Fisher-Yates shuffle |
| `dealCards(gameId)` | Distribute 11 cards per player |
| `createPotPiles(gameId)` | Set aside 2x11 face-down piles |
| `processMove(gameId, playerId, dto)` | Validate + apply move |
| `validateMove(gameState, move)` | Pure rule validation |
| `checkTurnOwnership(gameId, playerId)` | Is it this player's turn? |
| `advanceTurn(gameId)` | Move to next player |
| `checkGameEnd(gameState)` | All end conditions |
| `calculateScore(gameState)` | Final score per player/team |
| `finalizeGame(gameId)` | Save result, update stats, economy |
| `getGameState(gameId, playerId)` | Filtered state (hide other hands) |

### Active State Storage
- **Redis key:** `game:{gameId}:state` — full serialized game state
- **TTL:** 24 hours (reconnection window)
- **DB:** Only move log + final result persisted to PostgreSQL during game
- **Sync:** On every move, Redis state updated, DB move log appended

---

## Module 16 — Reconnection

**Path:** `src/modules/reconnection/`

### Responsibilities
- Detect player disconnect within an active game
- Hold game state for disconnect timeout window
- Resume game state on reconnect
- Auto-action (fold/pass) on timeout

### Files
```
reconnection/
├── reconnection.module.ts
├── reconnection.service.ts
└── reconnection.gateway.ts
```

### Logic Flow
```
1. Player disconnects (WebSocket close event)
2. Reconnection service sets Redis key: disconnect:{userId}:{gameId}
3. Disconnect TTL = 60 seconds (configurable)
4. Other players notified: player_disconnected event
5. Turn timer paused for disconnected player
6. Player reconnects → sends reconnect event with gameId
7. Server validates auth, fetches full game state from Redis
8. Sends full state_sync to reconnected player
9. Game resumes from exact state
10. If timeout expires → auto-discard, auto-pass turn, count as "left"
```

### Service Methods
| Method | Description |
|--------|-------------|
| `handleDisconnect(userId, socketId)` | Mark disconnected, start timer |
| `handleReconnect(userId, gameId)` | Restore full state, rejoin room |
| `isDisconnected(userId)` | Check disconnect state |
| `handleDisconnectTimeout(userId)` | Auto-action + notify opponents |
| `getFullGameStateForReconnect(gameId, userId)` | Player-filtered state |

---

## Module 17 — Match History

**Path:** `src/modules/match-history/`

### Responsibilities
- Persist completed match records
- Player match history endpoint
- Used by admin analytics

### Files
```
match-history/
├── match-history.module.ts
├── match-history.controller.ts
├── match-history.service.ts
└── entities/
    └── match-record.entity.ts
```

### MatchRecord Entity
```prisma
model MatchRecord {
  id          String   @id @default(uuid())
  gameId      String   @unique
  mode        GameMode
  variant     GameVariant
  players     MatchPlayer[]
  winnerIds   String[]
  scores      Json     // { userId: score }
  duration    Int      // seconds
  playedAt    DateTime @default(now())
}
```

### Service Methods
| Method | Description |
|--------|-------------|
| `saveMatchRecord(gameResult)` | Called by GameEngine on game end |
| `getPlayerHistory(userId, pagination)` | Paginated match history |
| `getMatchDetail(matchId)` | Full match details |
| `getPlayerStats(userId)` | Aggregate from history |

---

## Module 18 — Security

**Path:** `src/common/guards/` and `src/common/interceptors/`

### Responsibilities
- JWT validation on all protected routes
- WebSocket event validation (JWT on handshake)
- Rate limiting (global + per-endpoint)
- Anti-cheat move validation integration
- Input sanitization

### Components
| Component | Purpose |
|-----------|---------|
| `JwtAuthGuard` | Validates bearer token on REST |
| `WsJwtGuard` | Validates token on WebSocket handshake |
| `ThrottlerGuard` | Rate limiting via Redis |
| `ValidationPipe` | Global DTO validation (whitelist: true) |
| `TransformInterceptor` | Consistent response format |
| `LoggingInterceptor` | Request/response logging |

### Rate Limit Config
```typescript
// Global defaults
ThrottlerModule.forRoot({
  ttl: 60,
  limit: 100,   // 100 requests per minute
})

// Per-endpoint overrides
@Throttle(5, 60)  // Auth endpoints: 5 per minute
@Throttle(30, 60) // Game move endpoints: 30 per minute
```

### Anti-Cheat Rules
- Move timestamps validated server-side (can't replay old moves)
- All card data validated against known deck state
- Turn ownership strictly enforced
- All state changes originate from server, never from client assertion

---

## Module 19 — Cloud Scripting

**Path:** `src/modules/cloud-scripting/`

### Responsibilities
- Sandboxed hook execution
- Trigger points in the game engine
- Custom rules and reward logic

### Supported Trigger Points
| Trigger | When Called |
|---------|------------|
| `onMatchStart` | Game session begins |
| `onMovePlayed` | After each validated move |
| `onRoundEnd` | After each round |
| `onMatchEnd` | After final result |
| `onRewardDistribution` | Before rewards are sent |
| `onMissionProgress` | After mission progress update |

### Constraints
- Scripts run in isolated `vm2` sandbox
- No direct DB access — only through provided safe API
- Execution timeout: 100ms per hook
- Cannot override validated game state
- Errors in scripts do not crash the main game flow (caught + logged)

---

## Module 20 — Admin

**Path:** `src/modules/admin/`

### Responsibilities
- Admin-only REST API endpoints
- Backend for the Next.js admin panel
- Protected by separate Admin JWT

### Endpoints Exposed
| Domain | Admin Capabilities |
|--------|------------------|
| Users | List, search, ban, view balance, edit |
| Economy | View transactions, manual credit/deduct |
| Shop | CRUD items, manage catalog |
| Missions | Create/edit/delete missions |
| Clubs | View clubs, force delete, adjust points |
| Matches | View history, void matches |
| Notifications | Broadcast system notifications |
| Analytics | Aggregated stats, DAU, revenue, match counts |
| Config | System configuration flags |
