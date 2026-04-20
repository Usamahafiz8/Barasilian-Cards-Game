import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GameMode, GameVariant } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RoomsService } from './rooms.service';

@ApiTags('Rooms')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Get()
  @ApiOperation({ summary: 'Get list of active / waiting rooms' })
  @ApiQuery({ name: 'mode',    required: false, enum: GameMode,    description: 'Filter by game mode' })
  @ApiQuery({ name: 'variant', required: false, enum: GameVariant, description: 'Filter by game variant' })
  @ApiResponse({ status: 200, description: 'Array of rooms with current player count' })
  getRooms(@Query('mode') mode?: GameMode, @Query('variant') variant?: GameVariant) {
    return this.roomsService.getRoomList(mode, variant);
  }

  @Get(':roomId')
  @ApiOperation({ summary: 'Get a single room with full player list' })
  @ApiParam({ name: 'roomId', description: 'Room UUID' })
  @ApiResponse({ status: 200, description: 'Room detail' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  getRoom(@Param('roomId') roomId: string) {
    return this.roomsService.getRoom(roomId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new game table (private room)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        mode:          { type: 'string', enum: Object.values(GameMode) },
        variant:       { type: 'string', enum: Object.values(GameVariant) },
        turnDuration:  { type: 'number', description: 'Seconds per turn (default 30)' },
        entryFeeCoins: { type: 'number', description: 'Entry fee in coins (default 0)' },
        minLevel:      { type: 'number', description: 'Minimum player level to join' },
        minPoints:     { type: 'number', description: 'Minimum ranking points to join' },
      },
      required: ['mode', 'variant'],
    },
  })
  @ApiResponse({ status: 201, description: 'Room created' })
  @ApiResponse({ status: 400, description: 'Invalid configuration' })
  createRoom(@CurrentUser('id') userId: string, @Body() body: any) {
    return this.roomsService.createRoom(userId, body);
  }

  @Post(':roomId/join')
  @ApiOperation({ summary: 'Join an existing room' })
  @ApiParam({ name: 'roomId', description: 'Room UUID' })
  @ApiResponse({ status: 200, description: 'Joined room. Connect via WebSocket room:join event.' })
  @ApiResponse({ status: 400, description: 'Room full, already in another room, or level/entry-fee requirements not met' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  joinRoom(@CurrentUser('id') userId: string, @Param('roomId') roomId: string) {
    return this.roomsService.joinRoom(userId, roomId);
  }

  @Post(':roomId/leave')
  @ApiOperation({ summary: 'Leave a room before game starts' })
  @ApiParam({ name: 'roomId', description: 'Room UUID' })
  @ApiResponse({ status: 200, description: 'Left room' })
  @ApiResponse({ status: 404, description: 'Room not found or player not in room' })
  leaveRoom(@CurrentUser('id') userId: string, @Param('roomId') roomId: string) {
    return this.roomsService.leaveRoom(userId, roomId);
  }
}
