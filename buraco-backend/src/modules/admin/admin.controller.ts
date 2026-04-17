import {
  Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { Public } from '../../common/decorators/public.decorator';
import { AdminJwtGuard } from '../../common/guards/admin-jwt.guard';
import { AdminRolesGuard } from '../../common/guards/admin-roles.guard';
import { AdminRoles } from '../../common/decorators/admin-roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AdminService } from './admin.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { BanUserDto } from './dto/ban-user.dto';
import { CreditUserDto } from './dto/credit-user.dto';
import { BroadcastDto } from './dto/broadcast.dto';
import { CreatePromoDto } from './dto/create-promo.dto';
import { SystemConfigDto } from './dto/system-config.dto';
import { CreateShopItemDto } from './dto/create-shop-item.dto';

@ApiTags('Admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ─── Public ───────────────────────────────────────────────────────────────

  @Post('auth/login')
  @Public()
  @ApiOperation({ summary: 'Admin login' })
  login(@Body() dto: AdminLoginDto) {
    return this.adminService.login(dto);
  }

  // ─── All admin routes below require admin JWT ─────────────────────────────

  @Get('dashboard')
  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Dashboard statistics' })
  getDashboard() {
    return this.adminService.getDashboard();
  }

  // ─── Users ────────────────────────────────────────────────────────────────

  @Get('users')
  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List users with pagination and search' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  listUsers(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('search') search?: string,
  ) {
    return this.adminService.listUsers(+page, +limit, search);
  }

  @Get('users/:userId')
  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user detail with stats, transactions, notes' })
  getUser(@Param('userId') userId: string) {
    return this.adminService.getUser(userId);
  }

  @Patch('users/:userId/ban')
  @UseGuards(AdminJwtGuard, AdminRolesGuard)
  @AdminRoles(AdminRole.SUPER_ADMIN, AdminRole.MODERATOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Ban or unban a user' })
  banUser(@CurrentUser('id') adminId: string, @Param('userId') userId: string, @Body() dto: BanUserDto) {
    return this.adminService.banUser(adminId, userId, dto);
  }

  @Post('users/:userId/notes')
  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add admin note to user' })
  addNote(@CurrentUser('id') adminId: string, @Param('userId') userId: string, @Body('content') content: string) {
    return this.adminService.addNote(adminId, userId, content);
  }

  @Post('users/:userId/credit')
  @UseGuards(AdminJwtGuard, AdminRolesGuard)
  @AdminRoles(AdminRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Credit coins or diamonds to user' })
  creditUser(@CurrentUser('id') adminId: string, @Param('userId') userId: string, @Body() dto: CreditUserDto) {
    return this.adminService.creditUser(adminId, userId, dto);
  }

  @Post('users/:userId/deduct')
  @UseGuards(AdminJwtGuard, AdminRolesGuard)
  @AdminRoles(AdminRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Deduct coins or diamonds from user' })
  deductUser(@CurrentUser('id') adminId: string, @Param('userId') userId: string, @Body() dto: CreditUserDto) {
    return this.adminService.deductUser(adminId, userId, dto);
  }

  // ─── Games ────────────────────────────────────────────────────────────────

  @Get('games')
  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List game sessions' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'status', required: false })
  listGames(@Query('page') page = 1, @Query('limit') limit = 20, @Query('status') status?: string) {
    return this.adminService.listGames(+page, +limit, status);
  }

  @Patch('games/:gameId/void')
  @UseGuards(AdminJwtGuard, AdminRolesGuard)
  @AdminRoles(AdminRole.SUPER_ADMIN, AdminRole.MODERATOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Void a game session' })
  voidGame(@CurrentUser('id') adminId: string, @Param('gameId') gameId: string, @Body('reason') reason: string) {
    return this.adminService.voidGame(adminId, gameId, reason);
  }

  // ─── Shop ─────────────────────────────────────────────────────────────────

  @Post('shop/items')
  @UseGuards(AdminJwtGuard, AdminRolesGuard)
  @AdminRoles(AdminRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create shop item' })
  createShopItem(@CurrentUser('id') adminId: string, @Body() dto: CreateShopItemDto) {
    return this.adminService.createShopItem(adminId, dto);
  }

  @Patch('shop/items/:itemId/toggle')
  @UseGuards(AdminJwtGuard, AdminRolesGuard)
  @AdminRoles(AdminRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Activate or deactivate a shop item' })
  toggleShopItem(@CurrentUser('id') adminId: string, @Param('itemId') itemId: string, @Body('isActive') isActive: boolean) {
    return this.adminService.toggleShopItem(adminId, itemId, isActive);
  }

  // ─── Promos ───────────────────────────────────────────────────────────────

  @Post('promos')
  @UseGuards(AdminJwtGuard, AdminRolesGuard)
  @AdminRoles(AdminRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create promo code' })
  createPromo(@CurrentUser('id') adminId: string, @Body() dto: CreatePromoDto) {
    return this.adminService.createPromo(adminId, dto);
  }

  @Get('promos')
  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List promo codes' })
  listPromos(@Query('page') page = 1, @Query('limit') limit = 20) {
    return this.adminService.listPromos(+page, +limit);
  }

  @Patch('promos/:promoId/toggle')
  @UseGuards(AdminJwtGuard, AdminRolesGuard)
  @AdminRoles(AdminRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Activate or deactivate a promo code' })
  togglePromo(@CurrentUser('id') adminId: string, @Param('promoId') promoId: string, @Body('isActive') isActive: boolean) {
    return this.adminService.togglePromo(adminId, promoId, isActive);
  }

  // ─── Broadcast ────────────────────────────────────────────────────────────

  @Post('broadcast')
  @UseGuards(AdminJwtGuard, AdminRolesGuard)
  @AdminRoles(AdminRole.SUPER_ADMIN, AdminRole.MODERATOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Send broadcast notification to all users' })
  broadcast(@CurrentUser('id') adminId: string, @Body() dto: BroadcastDto) {
    return this.adminService.broadcast(adminId, dto);
  }

  // ─── Config ───────────────────────────────────────────────────────────────

  @Get('config')
  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all system config keys' })
  listConfig() {
    return this.adminService.listConfig();
  }

  @Put('config/:key')
  @UseGuards(AdminJwtGuard, AdminRolesGuard)
  @AdminRoles(AdminRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Set a system config value' })
  setConfig(@CurrentUser('id') adminId: string, @Param('key') key: string, @Body() dto: SystemConfigDto) {
    return this.adminService.setConfig(adminId, key, dto);
  }

  // ─── Audit Logs ───────────────────────────────────────────────────────────

  @Get('audit-logs')
  @UseGuards(AdminJwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get admin audit logs' })
  getAuditLogs(@Query('page') page = 1, @Query('limit') limit = 50) {
    return this.adminService.getAuditLogs(+page, +limit);
  }
}
