import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ClubRole } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ClubsService } from './clubs.service';
import { CreateClubDto } from './dto/create-club.dto';

@ApiTags('Clubs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('clubs')
export class ClubsController {
  constructor(private readonly clubsService: ClubsService) {}

  @Get()
  @ApiOperation({ summary: 'Search / browse clubs' })
  searchClubs(
    @Query('search') search?: string,
    @Query('mode') mode?: string,
    @Query('type') type?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.clubsService.searchClubs(search, mode, type, +page, +limit);
  }

  @Get(':clubId')
  @ApiOperation({ summary: 'Get club details' })
  getClub(@Param('clubId') clubId: string, @CurrentUser('id') userId: string) {
    return this.clubsService.getClub(clubId, userId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a club' })
  createClub(@CurrentUser('id') userId: string, @Body() dto: CreateClubDto) {
    return this.clubsService.createClub(userId, dto);
  }

  @Put(':clubId')
  @ApiOperation({ summary: 'Update club settings (Leader only)' })
  updateClub(@CurrentUser('id') userId: string, @Param('clubId') clubId: string, @Body() dto: Partial<CreateClubDto>) {
    return this.clubsService.updateClub(userId, clubId, dto);
  }

  @Delete(':clubId')
  @ApiOperation({ summary: 'Delete club (Leader only)' })
  deleteClub(@CurrentUser('id') userId: string, @Param('clubId') clubId: string) {
    return this.clubsService.deleteClub(userId, clubId);
  }

  @Post(':clubId/join')
  @ApiOperation({ summary: 'Join an open club' })
  joinClub(@CurrentUser('id') userId: string, @Param('clubId') clubId: string) {
    return this.clubsService.joinClub(userId, clubId);
  }

  @Post(':clubId/request')
  @ApiOperation({ summary: 'Request to join a club' })
  requestToJoin(@CurrentUser('id') userId: string, @Param('clubId') clubId: string) {
    return this.clubsService.requestToJoin(userId, clubId);
  }

  @Put(':clubId/requests/:userId/accept')
  @ApiOperation({ summary: 'Accept join request (Leader/ViceLeader)' })
  acceptRequest(@CurrentUser('id') leaderId: string, @Param('clubId') clubId: string, @Param('userId') memberId: string) {
    return this.clubsService.respondToRequest(leaderId, clubId, memberId, true);
  }

  @Put(':clubId/requests/:userId/decline')
  @ApiOperation({ summary: 'Decline join request (Leader/ViceLeader)' })
  declineRequest(@CurrentUser('id') leaderId: string, @Param('clubId') clubId: string, @Param('userId') memberId: string) {
    return this.clubsService.respondToRequest(leaderId, clubId, memberId, false);
  }

  @Delete(':clubId/members/:userId')
  @ApiOperation({ summary: 'Remove a member (Leader/ViceLeader)' })
  removeMember(@CurrentUser('id') leaderId: string, @Param('clubId') clubId: string, @Param('userId') memberId: string) {
    return this.clubsService.removeMember(leaderId, clubId, memberId);
  }

  @Put(':clubId/members/:userId/role')
  @ApiOperation({ summary: 'Change member role (Leader only)' })
  assignRole(
    @CurrentUser('id') leaderId: string,
    @Param('clubId') clubId: string,
    @Param('userId') memberId: string,
    @Body('role') role: ClubRole,
  ) {
    return this.clubsService.assignRole(leaderId, clubId, memberId, role);
  }

  @Post(':clubId/leave')
  @ApiOperation({ summary: 'Leave the club' })
  leaveClub(@CurrentUser('id') userId: string, @Param('clubId') clubId: string) {
    return this.clubsService.leaveClub(userId, clubId);
  }
}
