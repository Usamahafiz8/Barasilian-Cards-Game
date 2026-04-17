# Buraco Card Game — System Architecture

## Core Principle

The backend is **fully server-authoritative**. All game logic, validation, state management, and synchronization happen on the server. The Unity client is a pure presentation layer. The Next.js admin panel manages the platform.

---

## Technology Stack

### Backend
| Layer | Technology | Purpose |
|-------|-----------|---------|
| Framework | NestJS (Node.js) | Modular REST + WebSocket server |
| Language | TypeScript | Type safety across all modules |
| Database | PostgreSQL | Primary relational store |
| Cache / Queue | Redis | Sessions, matchmaking queues, active game state, rate limiting |
| ORM | Prisma | Type-safe DB access, migrations |
| WebSocket | Socket.io (NestJS Gateway) | Real-time gameplay, chat, room events |
| Auth | JWT + Passport.js | OAuth2 (Apple/Google) + email/password |
| File Storage | AWS S3 (or compatible) | Avatars, voice messages |
| Task Scheduler | @nestjs/schedule | Cron jobs for missions reset, daily rewards |
| Validation | class-validator + class-transformer | DTO validation on all inputs |
| Rate Limiting | @nestjs/throttler + Redis | Per-user, per-endpoint limiting |
| Testing | Jest | Unit + integration tests |
| Containerization | Docker + Docker Compose | Local dev and deployment |

### Admin Panel
| Layer | Technology | Purpose |
|-------|-----------|---------|
| Framework | Next.js 14 (App Router) | SSR admin dashboard |
| Language | TypeScript | Type safety |
| UI | shadcn/ui + Tailwind CSS | Component library |
| State | Zustand | Client-side state |
| Data Fetching | TanStack Query | Server state, caching |
| Charts | Recharts | Analytics dashboards |
| Auth | NextAuth.js (admin-only JWT) | Admin authentication |
| Tables | TanStack Table | Data grids |

### Unity Client (Consumer)
- Communicates via REST HTTP (non-realtime features)
- Communicates via Socket.io WebSocket (realtime features)
- No game logic — receives state, renders it

---

## System Communication Map

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENTS                              │
│                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌───────────────┐ │
│  │  Unity App   │    │  Unity App   │    │  Next.js      │ │
│  │  (Player 1)  │    │  (Player 2)  │    │  Admin Panel  │ │
│  └──────┬───────┘    └──────┬───────┘    └───────┬───────┘ │
└─────────┼────────────────── ┼────────────────────┼─────────┘
          │                   │                    │
          │ REST + WebSocket   │                    │ REST (Admin JWT)
          ▼                   ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│                    NestJS Backend                           │
│                                                             │
│  ┌─────────────┐  ┌──────────────────┐  ┌───────────────┐  │
│  │ REST API    │  │  WebSocket       │  │  Admin API    │  │
│  │ Controllers │  │  Gateways        │  │  Controllers  │  │
│  └──────┬──────┘  └────────┬─────────┘  └───────┬───────┘  │
│         │                  │                    │           │
│         └──────────────────┼────────────────────┘           │
│                            ▼                                │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                 Service Layer                       │    │
│  │  Auth │ Profile │ Economy │ Game Engine │ etc.      │    │
│  └───────────────────────┬─────────────────────────────┘    │
│                          │                                  │
│         ┌────────────────┴──────────────────┐               │
│         ▼                                   ▼               │
│  ┌──────────────┐                   ┌──────────────┐        │
│  │  PostgreSQL  │                   │    Redis     │        │
│  │  (Prisma)    │                   │  Cache/Queue │        │
│  └──────────────┘                   └──────────────┘        │
│                                                             │
│  ┌──────────────┐                                           │
│  │   AWS S3     │  (Avatars, Voice Messages)                │
│  └──────────────┘                                           │
└─────────────────────────────────────────────────────────────┘
```

---

## Module Dependency Graph (Build Order)

```
Phase 1 — Foundation
├── PrismaModule (DB connection)
├── RedisModule (cache connection)
├── AuthModule ──────────────────── depends on: Users
├── UsersModule
├── ProfileModule ───────────────── depends on: Users, S3
├── StatsModule ─────────────────── depends on: Users
└── SecurityModule (guards, throttler, validators)

Phase 2 — Social & Economy
├── EconomyModule ───────────────── depends on: Users
├── MissionsModule ──────────────── depends on: Economy, Stats
├── FriendsModule ───────────────── depends on: Users, Notifications
├── ClubsModule ─────────────────── depends on: Users, Stats, Economy
├── RankingsModule ──────────────── depends on: Stats, Clubs
├── NotificationsModule ─────────── depends on: Users
└── ShopModule ──────────────────── depends on: Economy, Profile

Phase 3 — Real-Time
├── WebSocketGateway ────────────── depends on: Auth (JWT handshake)
├── MessagingModule ─────────────── depends on: WebSocket, Friends, Clubs
├── RoomsModule ─────────────────── depends on: WebSocket, Matchmaking
└── MatchmakingModule ───────────── depends on: Stats, Economy

Phase 4 — Game Core
├── GameEngineModule ────────────── depends on: Rooms, Stats, Economy
├── ReconnectionModule ──────────── depends on: GameEngine, Redis
└── MatchHistoryModule ──────────── depends on: GameEngine, Stats

Phase 5 — Extensions
├── CloudScriptingModule ────────── depends on: GameEngine (hooks only)
└── AdminModule ─────────────────── depends on: all modules (read/write)
```

---

## Environment Variables

```env
# App
NODE_ENV=development
PORT=3000
APP_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/buraco_db

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=your-refresh-secret
JWT_REFRESH_EXPIRES_IN=30d

# OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
APPLE_CLIENT_ID=
APPLE_TEAM_ID=
APPLE_KEY_ID=
APPLE_PRIVATE_KEY=

# AWS S3
AWS_REGION=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET=

# Admin
ADMIN_JWT_SECRET=admin-secret-key

# Rate Limiting
THROTTLE_TTL=60
THROTTLE_LIMIT=100
```

---

## Project Folder Structure

```
buraco-backend/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── common/
│   │   ├── decorators/
│   │   ├── filters/
│   │   ├── guards/
│   │   ├── interceptors/
│   │   ├── pipes/
│   │   └── utils/
│   ├── config/
│   │   └── configuration.ts
│   ├── modules/
│   │   ├── auth/
│   │   ├── users/
│   │   ├── profile/
│   │   ├── stats/
│   │   ├── economy/
│   │   ├── missions/
│   │   ├── friends/
│   │   ├── clubs/
│   │   ├── rankings/
│   │   ├── shop/
│   │   ├── notifications/
│   │   ├── matchmaking/
│   │   ├── rooms/
│   │   ├── game-engine/
│   │   ├── messaging/
│   │   ├── reconnection/
│   │   ├── match-history/
│   │   ├── cloud-scripting/
│   │   └── admin/
│   └── websocket/
│       └── gateway.ts
├── test/
├── docker-compose.yml
├── Dockerfile
└── package.json

buraco-admin/                    ← Next.js Admin Panel
├── app/
│   ├── (auth)/
│   ├── (dashboard)/
│   │   ├── users/
│   │   ├── economy/
│   │   ├── clubs/
│   │   ├── shop/
│   │   ├── matches/
│   │   ├── notifications/
│   │   └── analytics/
│   └── layout.tsx
├── components/
├── lib/
└── package.json
```
