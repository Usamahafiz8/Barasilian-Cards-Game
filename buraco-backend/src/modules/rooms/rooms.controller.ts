import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
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
  @ApiOperation({ summary: 'Get list of active rooms' })
  getRooms(@Query('mode') mode?: GameMode, @Query('variant') variant?: GameVariant) {
    return this.roomsService.getRoomList(mode, variant);
  }

  @Get(':roomId')
  @ApiOperation({ summary: 'Get single room detail' })
  getRoom(@Param('roomId') roomId: string) {
    return this.roomsService.getRoom(roomId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new game table' })
  createRoom(@CurrentUser('id') userId: string, @Body() body: any) {
    return this.roomsService.createRoom(userId, body);
  }

  @Post(':roomId/join')
  @ApiOperation({ summary: 'Join an existing room' })
  joinRoom(@CurrentUser('id') userId: string, @Param('roomId') roomId: string) {
    return this.roomsService.joinRoom(userId, roomId);
  }

  @Post(':roomId/leave')
  @ApiOperation({ summary: 'Leave a room' })
  leaveRoom(@CurrentUser('id') userId: string, @Param('roomId') roomId: string) {
    return this.roomsService.leaveRoom(userId, roomId);
  }
}
