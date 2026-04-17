import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { FriendsService } from './friends.service';

@ApiTags('Friends')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('friends')
export class FriendsController {
  constructor(private readonly friendsService: FriendsService) {}

  @Get()
  @ApiOperation({ summary: 'Get friend list' })
  getFriends(@CurrentUser('id') userId: string) {
    return this.friendsService.getFriends(userId);
  }

  @Get('requests/incoming')
  @ApiOperation({ summary: 'Get incoming friend requests' })
  getPendingRequests(@CurrentUser('id') userId: string) {
    return this.friendsService.getPendingRequests(userId);
  }

  @Get('requests/sent')
  @ApiOperation({ summary: 'Get sent friend requests' })
  getSentRequests(@CurrentUser('id') userId: string) {
    return this.friendsService.getSentRequests(userId);
  }

  @Get('blocked')
  @ApiOperation({ summary: 'Get blocked users' })
  getBlockedUsers(@CurrentUser('id') userId: string) {
    return this.friendsService.getBlockedUsers(userId);
  }

  @Post('request')
  @ApiOperation({ summary: 'Send a friend request' })
  sendRequest(@CurrentUser('id') userId: string, @Body('userId') targetId: string) {
    return this.friendsService.sendRequest(userId, targetId);
  }

  @Put('request/:requestId/accept')
  @ApiOperation({ summary: 'Accept a friend request' })
  acceptRequest(@CurrentUser('id') userId: string, @Param('requestId') requestId: string) {
    return this.friendsService.acceptRequest(userId, requestId);
  }

  @Put('request/:requestId/decline')
  @ApiOperation({ summary: 'Decline a friend request' })
  declineRequest(@CurrentUser('id') userId: string, @Param('requestId') requestId: string) {
    return this.friendsService.declineRequest(userId, requestId);
  }

  @Delete(':friendId')
  @ApiOperation({ summary: 'Remove a friend' })
  removeFriend(@CurrentUser('id') userId: string, @Param('friendId') friendId: string) {
    return this.friendsService.removeFriend(userId, friendId);
  }

  @Post('block')
  @ApiOperation({ summary: 'Block a user' })
  blockUser(@CurrentUser('id') userId: string, @Body('userId') targetId: string) {
    return this.friendsService.blockUser(userId, targetId);
  }

  @Delete('block/:userId')
  @ApiOperation({ summary: 'Unblock a user' })
  unblockUser(@CurrentUser('id') userId: string, @Param('userId') targetId: string) {
    return this.friendsService.unblockUser(userId, targetId);
  }
}
