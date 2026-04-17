# Admin Panel — Next.js

**Framework:** Next.js 14 (App Router)  
**URL:** `https://admin.buraco.game`  
**Auth:** Separate admin JWT — not shared with player tokens  
**Access:** Role-based (SUPER_ADMIN, MODERATOR, SUPPORT)

---

## Tech Stack

| Layer | Library | Purpose |
|-------|---------|---------|
| Framework | Next.js 14 | App Router, SSR, API routes |
| UI Components | shadcn/ui | Headless accessible components |
| Styling | Tailwind CSS | Utility-first styling |
| Data Fetching | TanStack Query v5 | Server state, caching, pagination |
| Tables | TanStack Table v8 | Sortable, filterable data grids |
| Charts | Recharts | Line, bar, pie charts |
| Forms | React Hook Form + Zod | Validated admin forms |
| State | Zustand | Global UI state (sidebar, modals) |
| Auth | NextAuth.js | Admin session management |
| Icons | Lucide React | Icon set |
| Date | date-fns | Date formatting |
| HTTP | Axios | API calls with interceptors |

---

## Folder Structure

```
buraco-admin/
├── app/
│   ├── (auth)/
│   │   └── login/
│   │       └── page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx              ← Sidebar + header layout
│   │   ├── page.tsx                ← Dashboard overview
│   │   ├── users/
│   │   │   ├── page.tsx            ← User list
│   │   │   └── [userId]/
│   │   │       └── page.tsx        ← User detail
│   │   ├── economy/
│   │   │   ├── page.tsx            ← Transaction logs
│   │   │   └── manual/
│   │   │       └── page.tsx        ← Manual credit/deduct
│   │   ├── clubs/
│   │   │   ├── page.tsx            ← Club list
│   │   │   └── [clubId]/
│   │   │       └── page.tsx        ← Club detail
│   │   ├── shop/
│   │   │   ├── page.tsx            ← Item catalog manager
│   │   │   ├── create/
│   │   │   │   └── page.tsx        ← Add new item
│   │   │   └── [itemId]/
│   │   │       └── page.tsx        ← Edit item
│   │   ├── missions/
│   │   │   ├── page.tsx            ← Mission list
│   │   │   ├── create/page.tsx
│   │   │   └── [missionId]/page.tsx
│   │   ├── matches/
│   │   │   ├── page.tsx            ← Match history
│   │   │   └── [matchId]/page.tsx  ← Match detail + void
│   │   ├── notifications/
│   │   │   └── page.tsx            ← Broadcast notifications
│   │   ├── analytics/
│   │   │   └── page.tsx            ← Charts dashboard
│   │   └── settings/
│   │       └── page.tsx            ← System config
│   └── layout.tsx
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── Header.tsx
│   │   └── Breadcrumb.tsx
│   ├── ui/                         ← shadcn/ui components
│   ├── tables/
│   │   ├── UsersTable.tsx
│   │   ├── TransactionsTable.tsx
│   │   ├── MatchesTable.tsx
│   │   └── ClubsTable.tsx
│   ├── charts/
│   │   ├── DauChart.tsx
│   │   ├── RevenueChart.tsx
│   │   └── MatchesChart.tsx
│   └── modals/
│       ├── BanUserModal.tsx
│       ├── ManualCurrencyModal.tsx
│       └── BroadcastNotificationModal.tsx
├── lib/
│   ├── api.ts                      ← Axios instance
│   ├── auth.ts                     ← NextAuth config
│   └── utils.ts
└── types/
    └── admin.types.ts
```

---

## Pages

### Login Page
- Admin email + password
- Protected: redirects to `/dashboard` if already authenticated

---

### Dashboard (Overview) `/`

**Stats Cards (top row):**
| Card | Metric |
|------|--------|
| Total Users | count + % change vs yesterday |
| Active Today (DAU) | daily active users |
| Matches Today | total matches played today |
| Revenue Today | coin purchases + diamond sales |
| New Registrations | count today |
| Online Now | current WebSocket connections |

**Charts:**
- **DAU Chart** (line): 30-day daily active users
- **New Users Chart** (bar): 30-day registrations
- **Matches Per Day** (bar): 30-day match volume
- **Revenue Chart** (line): 30-day coin purchase revenue

**Recent Activity Feed:**
- Last 10 support flags / ban actions / manual transactions

---

### Users `/users`

**Filters:**
- Search by username or email
- Filter by: subscription status, banned status, registration date range

**Table Columns:**
| Column | Sortable |
|--------|---------|
| Avatar + Username | Yes |
| Email | No |
| Level | Yes |
| Points | Yes |
| Coins / Diamonds | Yes |
| Registration Date | Yes |
| Status (Active/Banned) | Yes |
| Actions | — |

**Row Actions:**
- View profile
- Edit user
- Ban / Unban
- Reset password (force)
- Add/Remove currency (opens modal)

**Bulk Actions:**
- Bulk ban
- Bulk message

---

### User Detail `/users/:userId`

**Sections:**

1. **Profile Card**
   - Avatar, username, email, registration date, subscription status
   - Edit username button
   - Ban / Unban toggle

2. **Balance & Economy**
   - Current coins, diamonds, lives
   - Quick add/deduct buttons (opens modal with reason)
   - Recent 10 transactions table

3. **Stats**
   - Level, XP, games played, wins, losses, win%, streak
   - Match history table (last 20 games)

4. **Social**
   - Friend count
   - Club membership + role
   - Block list count

5. **Notifications Log**
   - Recent 20 notifications sent to user

6. **Admin Notes**
   - Internal notes about the user (not visible to player)
   - Timeline of admin actions on this account

---

### Economy `/economy`

**Transaction Log Table:**

**Filters:**
- Date range picker
- Transaction type (REWARD / PURCHASE / ENTRY_FEE / GIFT / MISSION)
- Currency (COINS / DIAMONDS)
- User search

**Table Columns:**
| Column | Description |
|--------|-------------|
| Transaction ID | truncated UUID |
| User | username link |
| Type | badge |
| Currency | COINS / DIAMONDS |
| Amount | +/- colored |
| Balance After | snapshot |
| Description | |
| Date | |

**Stats at top:**
- Total coins in circulation
- Total diamonds in circulation
- Total transactions today
- Total match rewards paid today

---

### Manual Currency `/economy/manual`

**Form:**
- User search (autocomplete)
- Currency type (COINS / DIAMONDS)
- Amount
- Action (ADD / DEDUCT)
- Reason (required text, min 10 chars)
- Internal note

**Preview:** Shows user's current balance and projected balance after action.

**Audit:** All manual actions logged with admin ID + reason.

---

### Clubs `/clubs`

**Table Columns:**
| Column | Sortable |
|--------|---------|
| Icon + Name | Yes |
| Mode | — |
| Type | — |
| Level | Yes |
| Members | Yes |
| Points | Yes |
| Created | Yes |
| Actions | — |

**Row Actions:**
- View detail
- Force delete
- Adjust points

---

### Club Detail `/clubs/:clubId`

**Sections:**
1. Club info (name, icon, welcome msg, mode, type, min points)
2. Member list table (username, level, role, join date)
3. Remove member button per row
4. Club stats (level, points, progression)
5. Danger zone: Delete club button (with confirm modal)

---

### Shop `/shop`

**Item Catalog Table:**

**Filters:** Category, active/inactive status

**Columns:** Name, Category, Price (coins/diamonds), Status, Created, Actions

**Actions per row:** Edit, Activate/Deactivate, Delete

---

### Create/Edit Shop Item `/shop/create` or `/shop/:itemId`

**Form Fields:**
- Name
- Description
- Category (dropdown: HOME / SUBSCRIPTIONS / COINS / EMOJIS / TABLES / CARDS / SPECIAL / REDEEM)
- Price in Coins (optional)
- Price in Diamonds (optional)
- Is Consumable (toggle)
- Is Active (toggle)
- Image Upload (S3)

---

### Missions `/missions`

**Table:** Mission name, type (DAILY/WEEKLY), requirement, target, rewards, active status, actions

**Create/Edit Form:**
- Title
- Description
- Type (DAILY / WEEKLY)
- Requirement type (PLAY_GAMES / WIN_GAMES / EARN_POINTS / CHAT_MESSAGES / etc.)
- Target value (number)
- Reward coins
- Reward diamonds
- Active toggle

---

### Matches `/matches`

**Filters:** Date range, mode, variant, result

**Table Columns:**
| Column | |
|--------|--|
| Match ID | |
| Mode + Variant | |
| Players | usernames |
| Winner | highlighted |
| Scores | team1 vs team2 |
| Duration | mm:ss |
| Played At | |
| Status | COMPLETED / VOIDED |
| Actions | |

**Actions:** View detail, Void match

---

### Match Detail `/matches/:matchId`

**Sections:**
1. Match summary (mode, variant, duration, status)
2. Teams + players (avatars, usernames, levels)
3. Final scores per team
4. Move log table (turnNumber, player, moveType, card data, timestamp)
5. Void Match button (with reason required, refunds entry fees)

---

### Notifications `/notifications`

**Broadcast Form:**
- Target: ALL USERS / SPECIFIC USERS / CLUB / SUBSCRIPTION TIER
- Notification type
- Title
- Body
- Data payload (optional JSON)
- Schedule: Send Now / Schedule for date+time

**Notification History Table:**
- Broadcast ID, target, title, recipients count, sent at, status

---

### Analytics `/analytics`

**Date Range Picker** (affects all charts)

**Charts:**
1. **Daily Active Users** (line chart, 30/60/90 day)
2. **New Registrations** (bar chart)
3. **Match Volume by Mode** (stacked bar: Classic vs Professional)
4. **Revenue Breakdown** (pie: coin packages vs diamond packages vs subscriptions)
5. **Average Session Duration** (line chart)
6. **Retention Rate** (day 1 / day 7 / day 30)
7. **Top Players** (table: username, level, games played, win%)
8. **Top Clubs** (table: name, members, level, points)
9. **Economy Health** (coins earned vs spent per day)
10. **Shop Sales** (table: item name, units sold, revenue)

---

### Settings `/settings`

**System Configuration:**

| Setting | Type | Description |
|---------|------|-------------|
| Maintenance Mode | Toggle | Shows maintenance screen to players |
| New User Coins | Number | Starting coins for new accounts |
| New User Diamonds | Number | Starting diamonds |
| New User Lives | Number | Starting lives |
| Match Entry Fee (Classic 1v1) | Number | Default entry fee in coins |
| Match Entry Fee (Classic 2v2) | Number | |
| Match Entry Fee (Pro 1v1) | Number | |
| Match Entry Fee (Pro 2v2) | Number | |
| Max Friends Per User | Number | |
| Max Club Members | Number | |
| Reconnect Timeout (seconds) | Number | How long to wait before auto-action |
| Turn Duration Options | Multi-select | Allowed turn durations (15/30/60) |
| Daily Mission Count | Number | How many daily missions assigned |
| Weekly Mission Count | Number | |

---

## Admin Roles & Permissions

| Permission | SUPER_ADMIN | MODERATOR | SUPPORT |
|-----------|:-----------:|:---------:|:-------:|
| View dashboard | Yes | Yes | Yes |
| View/search users | Yes | Yes | Yes |
| Edit user profile | Yes | Yes | No |
| Ban/unban users | Yes | Yes | No |
| Add/deduct currency | Yes | No | No |
| View transactions | Yes | Yes | Yes |
| Manage shop items | Yes | No | No |
| Create/edit missions | Yes | No | No |
| View matches | Yes | Yes | Yes |
| Void matches | Yes | Yes | No |
| Send broadcast notifications | Yes | Yes | No |
| View analytics | Yes | Yes | No |
| Modify system settings | Yes | No | No |
| Manage admin accounts | Yes | No | No |

---

## Admin API Endpoints (Backend)

All require `Authorization: Bearer <admin_token>` and separate admin JWT secret.

```
GET    /admin/stats/overview
GET    /admin/stats/analytics?from=&to=

GET    /admin/users?search=&page=&limit=
GET    /admin/users/:userId
PUT    /admin/users/:userId
POST   /admin/users/:userId/ban
DELETE /admin/users/:userId/ban

GET    /admin/economy/transactions?page=&limit=
POST   /admin/economy/manual-credit

GET    /admin/clubs?search=&page=&limit=
GET    /admin/clubs/:clubId
DELETE /admin/clubs/:clubId
PUT    /admin/clubs/:clubId/points

GET    /admin/shop/items?category=&page=&limit=
POST   /admin/shop/items
PUT    /admin/shop/items/:itemId
DELETE /admin/shop/items/:itemId

GET    /admin/missions
POST   /admin/missions
PUT    /admin/missions/:missionId
DELETE /admin/missions/:missionId

GET    /admin/matches?page=&limit=
GET    /admin/matches/:matchId
POST   /admin/matches/:matchId/void

POST   /admin/notifications/broadcast

GET    /admin/settings
PUT    /admin/settings
```
