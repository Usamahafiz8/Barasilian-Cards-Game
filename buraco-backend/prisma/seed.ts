import { PrismaClient, MissionType, MissionRequirement, AdminRole, ShopCategory } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcryptjs';
import 'dotenv/config';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  console.log('Seeding database...');

  // ─── Super Admin ──────────────────────────────────────────────────────────
  const adminExists = await prisma.adminUser.findUnique({ where: { email: 'admin@buraco.game' } });
  if (!adminExists) {
    await prisma.adminUser.create({
      data: {
        email: 'admin@buraco.game',
        passwordHash: await bcrypt.hash('Admin@123!', 12),
        name: 'Super Admin',
        role: AdminRole.SUPER_ADMIN,
      },
    });
    console.log('Created super admin: admin@buraco.game / Admin@123!');
  }

  // ─── System Config ────────────────────────────────────────────────────────
  const configs = [
    { key: 'maintenance_mode', value: 'false' },
    { key: 'min_version_ios', value: '1.0.0' },
    { key: 'min_version_android', value: '1.0.0' },
    { key: 'classic_entry_fee', value: '100' },
    { key: 'professional_entry_fee', value: '500' },
    { key: 'daily_login_reward_coins', value: '200' },
    { key: 'max_club_members', value: '50' },
    { key: 'turn_duration_seconds', value: '30' },
    { key: 'disconnect_timeout_seconds', value: '60' },
  ];

  for (const cfg of configs) {
    await prisma.systemConfig.upsert({
      where: { key: cfg.key },
      update: { value: cfg.value },
      create: { key: cfg.key, value: cfg.value },
    });
  }
  console.log('Upserted system config entries:', configs.length);

  // ─── Daily Missions ───────────────────────────────────────────────────────
  const dailyMissions = [
    { title: 'Play 3 Games', description: 'Complete 3 games today', type: MissionType.DAILY, requirement: MissionRequirement.PLAY_GAMES, targetValue: 3, rewardCoins: 150 },
    { title: 'Win 1 Game', description: 'Win at least 1 game today', type: MissionType.DAILY, requirement: MissionRequirement.WIN_GAMES, targetValue: 1, rewardCoins: 300 },
    { title: 'Earn 500 Points', description: 'Accumulate 500 points in matches', type: MissionType.DAILY, requirement: MissionRequirement.EARN_POINTS, targetValue: 500, rewardCoins: 200 },
    { title: 'Send 5 Messages', description: 'Chat with friends or club members', type: MissionType.DAILY, requirement: MissionRequirement.SEND_MESSAGES, targetValue: 5, rewardCoins: 100 },
    { title: 'Play Classic Mode', description: 'Complete a Classic mode game', type: MissionType.DAILY, requirement: MissionRequirement.PLAY_CLASSIC, targetValue: 1, rewardCoins: 150 },
  ];

  // ─── Weekly Missions ──────────────────────────────────────────────────────
  const weeklyMissions = [
    { title: 'Win 10 Games', description: 'Win 10 games this week', type: MissionType.WEEKLY, requirement: MissionRequirement.WIN_GAMES, targetValue: 10, rewardCoins: 1500, rewardDiamonds: 5 },
    { title: 'Play 25 Games', description: 'Play 25 games this week', type: MissionType.WEEKLY, requirement: MissionRequirement.PLAY_GAMES, targetValue: 25, rewardCoins: 1000 },
    { title: 'Win Streak of 3', description: 'Win 3 games in a row', type: MissionType.WEEKLY, requirement: MissionRequirement.WIN_STREAK, targetValue: 3, rewardCoins: 800, rewardDiamonds: 3 },
    { title: 'Play Professional Mode', description: 'Complete 5 Professional mode games', type: MissionType.WEEKLY, requirement: MissionRequirement.PLAY_PROFESSIONAL, targetValue: 5, rewardCoins: 1200, rewardDiamonds: 2 },
    { title: 'Join a Club', description: 'Be a member of any club', type: MissionType.WEEKLY, requirement: MissionRequirement.JOIN_CLUB, targetValue: 1, rewardCoins: 500 },
  ];

  const allMissions = [...dailyMissions, ...weeklyMissions];
  for (const m of allMissions) {
    await prisma.mission.upsert({
      where: { id: (await prisma.mission.findFirst({ where: { title: m.title, type: m.type } }))?.id ?? 'nonexistent' },
      update: {},
      create: { ...m, rewardDiamonds: (m as any).rewardDiamonds ?? 0 },
    });
  }
  console.log('Seeded missions:', allMissions.length);

  // ─── Shop Items ───────────────────────────────────────────────────────────
  const shopItems = [
    // Subscriptions
    { name: 'Basic Subscription', description: 'Monthly Basic plan — ad-free + bonus coins', category: ShopCategory.SUBSCRIPTIONS, priceDiamonds: 50, isConsumable: false },
    { name: 'Premium Subscription', description: 'Monthly Premium plan — all features unlocked', category: ShopCategory.SUBSCRIPTIONS, priceDiamonds: 150, isConsumable: false },
    // Coins
    { name: '1,000 Coins', description: 'Pack of 1,000 coins', category: ShopCategory.COINS, priceDiamonds: 10, isConsumable: true },
    { name: '5,000 Coins', description: 'Pack of 5,000 coins', category: ShopCategory.COINS, priceDiamonds: 45, isConsumable: true },
    { name: '15,000 Coins', description: 'Pack of 15,000 coins', category: ShopCategory.COINS, priceDiamonds: 120, isConsumable: true },
    // Card Decks
    { name: 'Classic Blue Deck', description: 'Default classic card deck', category: ShopCategory.CARDS, priceCoins: 500, isConsumable: false },
    { name: 'Gold Foil Deck', description: 'Premium gold foil card design', category: ShopCategory.CARDS, priceDiamonds: 30, isConsumable: false },
    { name: 'Night Sky Deck', description: 'Dark themed starfield card deck', category: ShopCategory.CARDS, priceDiamonds: 25, isConsumable: false },
    // Tables
    { name: 'Classic Green Table', description: 'Standard green felt table', category: ShopCategory.TABLES, priceCoins: 1000, isConsumable: false },
    { name: 'Marble Table', description: 'Elegant marble surface table', category: ShopCategory.TABLES, priceDiamonds: 40, isConsumable: false },
    { name: 'Beach Table', description: 'Casual beach-themed table', category: ShopCategory.TABLES, priceDiamonds: 20, isConsumable: false },
    // Emojis
    { name: 'Basic Emoji Pack', description: '10 standard in-game emojis', category: ShopCategory.EMOJIS, priceCoins: 300, isConsumable: false },
    { name: 'Animated Emoji Pack', description: '5 animated emojis', category: ShopCategory.EMOJIS, priceDiamonds: 15, isConsumable: false },
    // Special
    { name: 'Double XP (1 day)', description: 'Earn double XP for 24 hours', category: ShopCategory.SPECIAL, priceDiamonds: 10, isConsumable: true },
    { name: 'Name Change Token', description: 'Change your username once', category: ShopCategory.SPECIAL, priceDiamonds: 20, isConsumable: true },
  ];

  for (const item of shopItems) {
    const existing = await prisma.shopItem.findFirst({ where: { name: item.name } });
    if (!existing) {
      await prisma.shopItem.create({ data: item });
    }
  }
  console.log('Seeded shop items:', shopItems.length);

  console.log('Seed complete.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
