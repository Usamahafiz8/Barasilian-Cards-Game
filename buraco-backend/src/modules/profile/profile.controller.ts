import { Body, Controller, Get, Param, Post, Put, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ProfileService } from './profile.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@ApiTags('Profile')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get own full profile' })
  getMyProfile(@CurrentUser('id') userId: string) {
    return this.profileService.getProfile(userId);
  }

  @Get(':userId')
  @ApiOperation({ summary: 'Get public profile of another player' })
  getPublicProfile(@Param('userId') userId: string) {
    return this.profileService.getPublicProfile(userId);
  }

  @Put('username')
  @ApiOperation({ summary: 'Update username' })
  updateUsername(@CurrentUser('id') userId: string, @Body() dto: UpdateProfileDto) {
    return this.profileService.updateUsername(userId, dto.username!);
  }

  @Post('avatar/upload')
  @ApiOperation({ summary: 'Upload avatar image' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  uploadAvatar(@CurrentUser('id') userId: string, @UploadedFile() file: Express.Multer.File) {
    return this.profileService.uploadAvatar(userId, file);
  }

  @Put('avatar/predefined')
  @ApiOperation({ summary: 'Set a predefined avatar' })
  setPredefinedAvatar(@CurrentUser('id') userId: string, @Body('predefinedId') predefinedId: string) {
    return this.profileService.setPredefinedAvatar(userId, predefinedId);
  }

  @Get('avatars/predefined')
  @ApiOperation({ summary: 'Get list of predefined avatars' })
  getPredefinedAvatars() {
    return this.profileService.getPredefinedAvatars();
  }
}
