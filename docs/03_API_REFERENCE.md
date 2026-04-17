# API Reference — Swagger Documentation

**Base URL:** `https://api.buraco.game/v1`  
**Auth:** All endpoints require `Authorization: Bearer <access_token>` unless marked `[PUBLIC]`  
**Content-Type:** `application/json`

---

## Response Format

All responses follow this envelope:

```json
// Success
{
  "success": true,
  "data": { ... },
  "timestamp": "2024-01-01T00:00:00.000Z"
}

// Error
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Email or password is incorrect",
    "statusCode": 401
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

---

## Pagination Format

```json
{
  "data": [...],
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "totalPages": 5
  }
}
```

---

# AUTH ENDPOINTS

## POST /auth/register `[PUBLIC]`
Register a new user with email and password.

**Request Body:**
```json
{
  "email": "player@example.com",
  "password": "SecurePass123",
  "username": "CoolPlayer"
}
```

**Validation:**
- `email`: valid email format, unique
- `password`: min 8 chars, at least 1 number
- `username`: 3–20 chars, alphanumeric + underscores, unique

**Response 201:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "player@example.com",
      "username": "CoolPlayer"
    },
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc...",
    "expiresIn": 900
  }
}
```

**Errors:** `400 VALIDATION_ERROR`, `409 USERNAME_TAKEN`, `409 EMAIL_TAKEN`

---

## POST /auth/login `[PUBLIC]`
Login with email and password.

**Request Body:**
```json
{
  "email": "player@example.com",
  "password": "SecurePass123"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "username": "CoolPlayer",
      "avatarUrl": "https://cdn.buraco.game/avatars/uuid.jpg"
    },
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc...",
    "expiresIn": 900
  }
}
```

**Errors:** `401 INVALID_CREDENTIALS`, `403 ACCOUNT_DELETED`

---

## POST /auth/google `[PUBLIC]`
Login or register with Google OAuth.

**Request Body:**
```json
{
  "idToken": "google_id_token_here"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "user": { "id": "uuid", "username": "CoolPlayer" },
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc...",
    "isNewUser": false
  }
}
```

---

## POST /auth/apple `[PUBLIC]`
Login or register with Apple Sign-In.

**Request Body:**
```json
{
  "identityToken": "apple_identity_token",
  "authorizationCode": "auth_code",
  "fullName": { "firstName": "John", "lastName": "Doe" }
}
```

**Response 200:** Same as Google login response.

---

## POST /auth/refresh `[PUBLIC]`
Get a new access token using a refresh token.

**Request Body:**
```json
{
  "refreshToken": "eyJhbGc..."
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGc...",
    "expiresIn": 900
  }
}
```

**Errors:** `401 INVALID_REFRESH_TOKEN`, `401 REFRESH_TOKEN_EXPIRED`

---

## POST /auth/logout
Revoke current session.

**Response 200:**
```json
{ "success": true, "data": { "message": "Logged out successfully" } }
```

---

## POST /auth/forgot-password `[PUBLIC]`
Send OTP to email for password reset.

**Request Body:**
```json
{ "email": "player@example.com" }
```

**Response 200:**
```json
{ "success": true, "data": { "message": "Reset email sent if account exists" } }
```

---

## POST /auth/reset-password `[PUBLIC]`
Reset password using OTP token.

**Request Body:**
```json
{
  "token": "otp_token_from_email",
  "newPassword": "NewSecurePass123"
}
```

**Response 200:**
```json
{ "success": true, "data": { "message": "Password reset successfully" } }
```

---

## PUT /auth/change-password
Change password while authenticated.

**Request Body:**
```json
{
  "currentPassword": "OldPass123",
  "newPassword": "NewPass456"
}
```

**Response 200:**
```json
{ "success": true, "data": { "message": "Password changed successfully" } }
```

---

## PUT /auth/email
Update account email.

**Request Body:**
```json
{ "email": "newemail@example.com" }
```

**Response 200:** Sends verification to new email.

---

## DELETE /auth/account
Permanently delete account.

**Response 200:**
```json
{ "success": true, "data": { "message": "Account deleted" } }
```

---

# PROFILE ENDPOINTS

## GET /profile/me
Get own full profile.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "username": "CoolPlayer",
    "email": "player@example.com",
    "avatarUrl": "https://cdn.buraco.game/avatars/uuid.jpg",
    "registrationDate": "2024-01-01T00:00:00.000Z",
    "coins": 5000,
    "diamonds": 100,
    "lives": 5,
    "subscriptionStatus": "FREE",
    "stats": {
      "level": 12,
      "points": 4500,
      "gamesPlayed": 87,
      "wins": 52,
      "losses": 35,
      "winPercentage": 59.77,
      "winStreak": 3
    }
  }
}
```

---

## GET /profile/:userId
Get another player's public profile.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "username": "CoolPlayer",
    "avatarUrl": "https://cdn.buraco.game/avatars/uuid.jpg",
    "stats": {
      "level": 12,
      "points": 4500,
      "gamesPlayed": 87,
      "winPercentage": 59.77
    },
    "club": {
      "id": "club-uuid",
      "name": "Brazil Masters",
      "role": "MEMBER"
    }
  }
}
```

---

## PUT /profile/username
Update username.

**Request Body:**
```json
{ "username": "NewCoolName" }
```

**Errors:** `409 USERNAME_TAKEN`, `400 VALIDATION_ERROR`

---

## POST /profile/avatar/upload
Upload avatar image.

**Content-Type:** `multipart/form-data`

**Form Fields:**
- `file` (File): JPEG/PNG, max 5MB

**Response 200:**
```json
{
  "success": true,
  "data": { "avatarUrl": "https://cdn.buraco.game/avatars/uuid.jpg" }
}
```

---

## PUT /profile/avatar/predefined
Set a predefined avatar.

**Request Body:**
```json
{ "predefinedId": "avatar_001" }
```

---

## GET /profile/avatars/predefined
Get list of all predefined avatars.

**Response 200:**
```json
{
  "success": true,
  "data": [
    { "id": "avatar_001", "name": "Classic Blue", "url": "https://cdn.buraco.game/avatars/predefined/001.png" },
    { "id": "avatar_002", "name": "Fire Red", "url": "https://cdn.buraco.game/avatars/predefined/002.png" }
  ]
}
```

---

# STATS ENDPOINTS

## GET /stats/me
Get own stats.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "points": 4500,
    "level": 12,
    "experience": 2400,
    "experienceToNextLevel": 600,
    "gamesPlayed": 87,
    "wins": 52,
    "losses": 35,
    "gamesLeft": 0,
    "winPercentage": 59.77,
    "winStreak": 3,
    "bestWinStreak": 8
  }
}
```

---

## GET /stats/:userId
Get another player's stats (public fields only).

---

# ECONOMY ENDPOINTS

## GET /economy/balance
Get current currency balances.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "coins": 5000,
    "diamonds": 100,
    "lives": 5
  }
}
```

---

## GET /economy/transactions
Get transaction history with pagination.

**Query Params:**
- `page` (number, default: 1)
- `limit` (number, default: 20, max: 50)
- `currency` (optional: COINS | DIAMONDS)
- `type` (optional: REWARD | PURCHASE | ENTRY_FEE | GIFT_SENT | GIFT_RECEIVED | MISSION_REWARD)

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "type": "MATCH_REWARD",
      "currency": "COINS",
      "amount": 500,
      "balanceBefore": 4500,
      "balanceAfter": 5000,
      "description": "Match win reward",
      "createdAt": "2024-01-01T12:00:00.000Z"
    }
  ],
  "meta": { "total": 45, "page": 1, "limit": 20, "totalPages": 3 }
}
```

---

## POST /economy/gift
Send coins or diamonds to another player.

**Request Body:**
```json
{
  "receiverId": "user-uuid",
  "currency": "COINS",
  "amount": 500
}
```

**Errors:** `400 INSUFFICIENT_BALANCE`, `404 USER_NOT_FOUND`, `403 USER_BLOCKED`

---

# MISSIONS ENDPOINTS

## GET /missions
Get all active missions with progress.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "daily": [
      {
        "id": "mission-uuid",
        "title": "Play 3 Games",
        "description": "Play 3 games of any mode",
        "type": "DAILY",
        "requirement": "PLAY_GAMES",
        "targetValue": 3,
        "currentValue": 1,
        "isCompleted": false,
        "isClaimed": false,
        "rewardCoins": 200,
        "rewardDiamonds": 0,
        "resetsAt": "2024-01-02T00:00:00.000Z"
      }
    ],
    "weekly": [
      {
        "id": "mission-uuid-2",
        "title": "Win 10 Games",
        "description": "Win 10 games this week",
        "type": "WEEKLY",
        "requirement": "WIN_GAMES",
        "targetValue": 10,
        "currentValue": 4,
        "isCompleted": false,
        "isClaimed": false,
        "rewardCoins": 1000,
        "rewardDiamonds": 5,
        "resetsAt": "2024-01-08T00:00:00.000Z"
      }
    ]
  }
}
```

---

## POST /missions/:missionId/claim
Claim reward for a completed mission.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "reward": { "coins": 200, "diamonds": 0 },
    "newBalance": { "coins": 5200, "diamonds": 100 }
  }
}
```

**Errors:** `400 MISSION_NOT_COMPLETED`, `400 REWARD_ALREADY_CLAIMED`

---

# FRIENDS ENDPOINTS

## GET /friends
Get friend list.

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "friendshipId": "uuid",
      "user": {
        "id": "uuid",
        "username": "BestFriend",
        "avatarUrl": "...",
        "level": 8,
        "isOnline": true
      }
    }
  ]
}
```

---

## GET /friends/requests/incoming
Get incoming friend requests.

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "requestId": "uuid",
      "from": {
        "id": "uuid",
        "username": "NewPlayer",
        "avatarUrl": "...",
        "level": 5
      },
      "sentAt": "2024-01-01T10:00:00.000Z"
    }
  ]
}
```

---

## GET /friends/requests/sent
Get sent pending friend requests.

---

## POST /friends/request
Send a friend request.

**Request Body:**
```json
{ "userId": "target-user-uuid" }
```

**Errors:** `409 REQUEST_ALREADY_SENT`, `409 ALREADY_FRIENDS`, `403 USER_BLOCKED`

---

## PUT /friends/request/:requestId/accept
Accept a friend request.

**Response 200:**
```json
{ "success": true, "data": { "message": "Friend request accepted" } }
```

---

## PUT /friends/request/:requestId/decline
Decline a friend request.

---

## DELETE /friends/:friendId
Remove a friend.

---

## POST /friends/block
Block a user.

**Request Body:**
```json
{ "userId": "target-user-uuid" }
```

---

## DELETE /friends/block/:userId
Unblock a user.

---

## GET /friends/blocked
Get blocked users list.

---

# CLUBS ENDPOINTS

## GET /clubs
Search / browse clubs.

**Query Params:**
- `search` (optional string): Search by name
- `mode` (optional: CLASSIC | PROFESSIONAL)
- `type` (optional: OPEN | REQUEST_BASED)
- `page`, `limit`

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": "club-uuid",
      "name": "Brazil Masters",
      "iconUrl": "...",
      "mode": "CLASSIC",
      "type": "OPEN",
      "level": 5,
      "memberCount": 28,
      "minPoints": 1000,
      "points": 15000
    }
  ]
}
```

---

## GET /clubs/:clubId
Get club details.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "club-uuid",
    "name": "Brazil Masters",
    "iconUrl": "...",
    "welcomeMessage": "Welcome to the best club!",
    "mode": "CLASSIC",
    "type": "OPEN",
    "level": 5,
    "points": 15000,
    "memberCount": 28,
    "progressToNextLevel": 75,
    "minPoints": 1000,
    "myRole": "MEMBER",
    "members": [
      {
        "userId": "uuid",
        "username": "Leader123",
        "avatarUrl": "...",
        "level": 20,
        "role": "LEADER"
      }
    ]
  }
}
```

---

## POST /clubs
Create a new club.

**Request Body:**
```json
{
  "name": "Brazil Masters",
  "iconUrl": "https://...",
  "welcomeMessage": "Welcome to the best club!",
  "mode": "CLASSIC",
  "type": "OPEN",
  "minPoints": 1000
}
```

**Errors:** `409 CLUB_NAME_TAKEN`, `400 ALREADY_IN_CLUB`

---

## PUT /clubs/:clubId
Update club settings. (Leader only)

**Request Body:** (all optional)
```json
{
  "welcomeMessage": "New welcome message",
  "type": "REQUEST_BASED",
  "minPoints": 2000
}
```

---

## DELETE /clubs/:clubId
Delete club. (Leader only)

---

## POST /clubs/:clubId/join
Join an open club directly.

**Errors:** `400 INSUFFICIENT_POINTS`, `400 CLUB_FULL`, `403 CLUB_REQUEST_BASED`

---

## POST /clubs/:clubId/request
Request to join a request-based club.

---

## PUT /clubs/:clubId/requests/:userId/accept
Accept join request. (Leader/Vice Leader only)

---

## PUT /clubs/:clubId/requests/:userId/decline
Decline join request. (Leader/Vice Leader only)

---

## DELETE /clubs/:clubId/members/:userId
Remove member from club. (Leader/Vice Leader only)

---

## PUT /clubs/:clubId/members/:userId/role
Change member role. (Leader only)

**Request Body:**
```json
{ "role": "VICE_LEADER" }
```

---

## POST /clubs/:clubId/leave
Leave the club.

---

# RANKINGS ENDPOINTS

## GET /rankings/classic
Get classic ranking leaderboard.

**Query Params:**
- `page` (default: 1), `limit` (default: 50, max: 100)

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "rank": 1,
      "user": {
        "id": "uuid",
        "username": "TopPlayer",
        "avatarUrl": "...",
        "level": 35
      },
      "points": 98500,
      "club": { "name": "Brazil Masters", "role": "LEADER" }
    }
  ],
  "meta": { "total": 10000, "myRank": 142 }
}
```

---

## GET /rankings/international
Get international ranking leaderboard.

Same response format as classic rankings.

---

## GET /rankings/player/:userId
Get ranked detail view for a specific player.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "rank": 142,
    "user": {
      "id": "uuid",
      "username": "CoolPlayer",
      "avatarUrl": "...",
      "level": 12
    },
    "points": 4500,
    "stats": {
      "gamesPlayed": 87,
      "wins": 52,
      "winPercentage": 59.77
    },
    "club": { "id": "club-uuid", "name": "Brazil Masters", "role": "MEMBER" },
    "isFriend": false,
    "isBlocked": false
  }
}
```

---

# SHOP ENDPOINTS

## GET /shop/catalog
Get shop catalog, optionally filtered by category.

**Query Params:**
- `category` (optional: HOME | SUBSCRIPTIONS | COINS | EMOJIS | TABLES | CARDS | SPECIAL | REDEEM)

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": "item-uuid",
      "name": "Gold Table",
      "description": "A luxurious gold table skin",
      "category": "TABLES",
      "priceCoins": 5000,
      "priceDiamonds": null,
      "imageUrl": "https://cdn.buraco.game/shop/gold-table.png",
      "isOwned": false
    }
  ]
}
```

---

## GET /shop/item/:itemId
Get single item detail.

---

## POST /shop/purchase
Purchase an item from the shop.

**Request Body:**
```json
{
  "itemId": "item-uuid",
  "currency": "COINS"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "item": { "id": "item-uuid", "name": "Gold Table" },
    "newBalance": { "coins": 0, "diamonds": 100 }
  }
}
```

**Errors:** `400 INSUFFICIENT_BALANCE`, `409 ITEM_ALREADY_OWNED`

---

## GET /shop/inventory
Get all owned items.

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "inventoryId": "uuid",
      "item": {
        "id": "item-uuid",
        "name": "Gold Table",
        "category": "TABLES",
        "imageUrl": "..."
      },
      "isEquipped": true,
      "purchasedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

---

## PUT /shop/inventory/:itemId/equip
Equip an owned item.

---

## POST /shop/redeem
Redeem a promo code.

**Request Body:**
```json
{ "code": "PROMO2024" }
```

---

# NOTIFICATIONS ENDPOINTS

## GET /notifications
Get all notifications.

**Query Params:**
- `page`, `limit`, `unreadOnly` (boolean)

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "type": "FRIEND_REQUEST",
      "title": "New Friend Request",
      "body": "CoolPlayer sent you a friend request",
      "data": { "requestId": "req-uuid" },
      "isRead": false,
      "createdAt": "2024-01-01T10:00:00.000Z"
    }
  ]
}
```

---

## GET /notifications/unread-count
Get count of unread notifications.

**Response 200:**
```json
{ "success": true, "data": { "count": 3 } }
```

---

## PUT /notifications/:notificationId/read
Mark a notification as read.

---

## PUT /notifications/read-all
Mark all notifications as read.

---

## DELETE /notifications/:notificationId
Delete a notification.

---

# MATCHMAKING ENDPOINTS

## POST /matchmaking/join
Join the matchmaking queue.

**Request Body:**
```json
{
  "mode": "CLASSIC",
  "variant": "ONE_VS_ONE"
}
```

**Mode options:** `CLASSIC`, `PROFESSIONAL`  
**Variant options:** `ONE_VS_ONE`, `TWO_VS_TWO`

**Response 200:**
```json
{
  "success": true,
  "data": {
    "queueId": "queue-entry-uuid",
    "estimatedWaitSeconds": 30,
    "message": "Joined matchmaking queue"
  }
}
```

**Errors:** `400 INSUFFICIENT_BALANCE` (entry fee), `400 ALREADY_IN_QUEUE`, `400 ALREADY_IN_GAME`

---

## DELETE /matchmaking/leave
Leave the matchmaking queue and get entry fee refunded.

**Response 200:**
```json
{ "success": true, "data": { "message": "Left queue, entry fee refunded" } }
```

---

## GET /matchmaking/status
Get current queue status.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "inQueue": true,
    "mode": "CLASSIC",
    "variant": "ONE_VS_ONE",
    "queuePosition": 3,
    "waitedSeconds": 15
  }
}
```

---

# ROOMS ENDPOINTS

## GET /rooms
Get list of active live rooms/tables.

**Query Params:**
- `mode` (optional: CLASSIC | PROFESSIONAL)
- `variant` (optional: ONE_VS_ONE | TWO_VS_TWO)

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": "room-uuid",
      "mode": "CLASSIC",
      "variant": "TWO_VS_TWO",
      "status": "WAITING",
      "maxPlayers": 4,
      "currentPlayers": 2,
      "turnDuration": 30,
      "entryFeeCoins": 500,
      "minLevel": 5,
      "players": [
        { "userId": "uuid", "username": "Player1", "avatarUrl": "...", "level": 12 },
        { "userId": "uuid2", "username": "Player2", "avatarUrl": "...", "level": 8 }
      ]
    }
  ]
}
```

---

## GET /rooms/:roomId
Get single room detail.

---

## POST /rooms
Create a new game table.

**Request Body:**
```json
{
  "mode": "CLASSIC",
  "variant": "TWO_VS_TWO",
  "turnDuration": 30,
  "entryFeeCoins": 500,
  "minLevel": 5,
  "minPoints": 0
}
```

---

## POST /rooms/:roomId/join
Join an existing room table.

**Errors:** `400 INSUFFICIENT_BALANCE`, `400 ROOM_FULL`, `400 LEVEL_REQUIREMENT_NOT_MET`, `400 POINTS_REQUIREMENT_NOT_MET`

---

## POST /rooms/:roomId/leave
Leave a room before game starts.

---

# GAME ENDPOINTS

## GET /game/:gameId/state
Get current game state (filtered to requesting player's view).

**Response 200:**
```json
{
  "success": true,
  "data": {
    "gameId": "game-uuid",
    "status": "IN_PROGRESS",
    "mode": "CLASSIC",
    "variant": "TWO_VS_TWO",
    "currentTurn": {
      "playerId": "uuid",
      "username": "CoolPlayer",
      "timeRemaining": 25
    },
    "myHand": [
      { "suit": "HEARTS", "rank": "ACE", "id": "card-1" },
      { "suit": "SPADES", "rank": "7", "id": "card-2" }
    ],
    "myMelds": [
      { "id": "meld-1", "cards": [...], "isCanasta": false }
    ],
    "discardPile": [
      { "suit": "DIAMONDS", "rank": "KING", "id": "card-top" }
    ],
    "stockPileCount": 45,
    "potPiles": [
      { "count": 11, "isAvailable": false },
      { "count": 11, "isAvailable": false }
    ],
    "players": [
      {
        "userId": "uuid",
        "username": "Player1",
        "avatarUrl": "...",
        "handCount": 7,
        "meldsCount": 2,
        "isConnected": true,
        "teamId": 1
      }
    ],
    "scores": { "team1": 450, "team2": 230 },
    "round": 1
  }
}
```

---

## POST /game/:gameId/move/draw
Draw a card (from stock or discard pile).

**Request Body:**
```json
{
  "source": "STOCK"
}
```
or
```json
{
  "source": "DISCARD"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "card": { "suit": "CLUBS", "rank": "5", "id": "card-99" },
    "newHandCount": 12
  }
}
```

**Errors:** `400 NOT_YOUR_TURN`, `400 INVALID_MOVE`, `400 GAME_NOT_IN_PROGRESS`

---

## POST /game/:gameId/move/meld
Play a meld (set or sequence) from hand.

**Request Body:**
```json
{
  "cardIds": ["card-1", "card-2", "card-3"],
  "meldType": "SET"
}
```

**Meld Types:** `SET` (same rank), `SEQUENCE` (same suit, consecutive ranks)

---

## POST /game/:gameId/move/add-to-meld
Add cards to an existing meld.

**Request Body:**
```json
{
  "meldId": "meld-1",
  "cardIds": ["card-5"]
}
```

---

## POST /game/:gameId/move/discard
Discard a card to end your turn.

**Request Body:**
```json
{
  "cardId": "card-7"
}
```

---

## POST /game/:gameId/move/pickup-pot
Pick up the pot pile (when hand is empty).

---

# MESSAGING ENDPOINTS

## GET /messaging/conversations
Get all conversations.

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": "conv-uuid",
      "type": "DIRECT",
      "participant": {
        "id": "uuid",
        "username": "BestFriend",
        "avatarUrl": "...",
        "isOnline": true
      },
      "lastMessage": {
        "content": "Good game!",
        "type": "TEXT",
        "sentAt": "2024-01-01T12:00:00.000Z"
      },
      "unreadCount": 2
    }
  ]
}
```

---

## GET /messaging/conversations/:conversationId/messages
Get message history for a conversation.

**Query Params:** `page`, `limit` (default 50)

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": "msg-uuid",
      "senderId": "uuid",
      "senderUsername": "BestFriend",
      "type": "TEXT",
      "content": "Good game!",
      "isRead": true,
      "createdAt": "2024-01-01T12:00:00.000Z"
    },
    {
      "id": "msg-uuid-2",
      "senderId": "uuid",
      "type": "VOICE",
      "voiceUrl": "https://cdn.buraco.game/voice/msg-uuid-2.mp3",
      "duration": 8,
      "isRead": false,
      "createdAt": "2024-01-01T12:01:00.000Z"
    }
  ]
}
```

---

## POST /messaging/conversations/:conversationId/voice
Upload and send a voice message.

**Content-Type:** `multipart/form-data`

**Form Fields:**
- `file` (File): MP3/M4A, max 2MB, max 60s

---

## PUT /messaging/conversations/:conversationId/read
Mark all messages in conversation as read.

---

# MATCH HISTORY ENDPOINTS

## GET /match-history/me
Get own match history.

**Query Params:** `page`, `limit`, `mode`

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": "match-uuid",
      "mode": "CLASSIC",
      "variant": "TWO_VS_TWO",
      "result": "WIN",
      "myScore": 650,
      "opponentScore": 420,
      "duration": 840,
      "playedAt": "2024-01-01T14:00:00.000Z",
      "players": [
        { "userId": "uuid", "username": "Me", "team": 1 },
        { "userId": "uuid2", "username": "Partner", "team": 1 },
        { "userId": "uuid3", "username": "Opponent1", "team": 2 },
        { "userId": "uuid4", "username": "Opponent2", "team": 2 }
      ]
    }
  ]
}
```

---

## GET /match-history/:matchId
Get full match detail.

---

# ERROR CODES REFERENCE

| Code | HTTP | Description |
|------|------|-------------|
| `VALIDATION_ERROR` | 400 | DTO validation failed |
| `INVALID_CREDENTIALS` | 401 | Wrong email/password |
| `TOKEN_EXPIRED` | 401 | JWT expired |
| `INVALID_TOKEN` | 401 | JWT invalid or blacklisted |
| `UNAUTHORIZED` | 401 | Not authenticated |
| `FORBIDDEN` | 403 | Not authorized for this action |
| `USER_BLOCKED` | 403 | Target user has blocked you |
| `NOT_FOUND` | 404 | Resource not found |
| `ALREADY_FRIENDS` | 409 | Already friends with user |
| `REQUEST_ALREADY_SENT` | 409 | Friend request already pending |
| `USERNAME_TAKEN` | 409 | Username not available |
| `EMAIL_TAKEN` | 409 | Email already registered |
| `CLUB_NAME_TAKEN` | 409 | Club name not available |
| `ITEM_ALREADY_OWNED` | 409 | Already in inventory |
| `ALREADY_IN_QUEUE` | 400 | Already in matchmaking queue |
| `ALREADY_IN_GAME` | 400 | Already in active game |
| `INSUFFICIENT_BALANCE` | 400 | Not enough coins/diamonds |
| `ROOM_FULL` | 400 | Room has no open slots |
| `NOT_YOUR_TURN` | 400 | Move submitted out of turn |
| `INVALID_MOVE` | 400 | Move violates Buraco rules |
| `MISSION_NOT_COMPLETED` | 400 | Mission not yet completed |
| `REWARD_ALREADY_CLAIMED` | 400 | Reward already claimed |
| `LEVEL_REQUIREMENT_NOT_MET` | 400 | Level too low for room |
| `POINTS_REQUIREMENT_NOT_MET` | 400 | Points too low for room |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |
