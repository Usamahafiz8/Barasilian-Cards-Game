import { Body, Controller, Get, Param, Post, Put, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation,
  ApiParam, ApiResponse, ApiTags,
} from '@nestjs/swagger';
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
  @ApiOperation({ summary: 'Get own full profile with stats' })
  @ApiResponse({ status: 200, description: 'Profile returned' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getMyProfile(@CurrentUser('id') userId: string) {
    return this.profileService.getProfile(userId);
  }

  @Get(':userId')
  @ApiOperation({ summary: "Get another player's public profile" })
  @ApiParam({ name: 'userId', description: 'Target player UUID' })
  @ApiResponse({ status: 200, description: 'Public profile returned' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Player not found' })
  getPublicProfile(@Param('userId') userId: string) {
    return this.profileService.getPublicProfile(userId);
  }

  @Put('username')
  @ApiOperation({ summary: 'Update own username' })
  @ApiResponse({ status: 200, description: 'Username updated' })
  @ApiResponse({ status: 400, description: 'Invalid username format' })
  @ApiResponse({ status: 409, description: 'Username already taken' })
  updateUsername(@CurrentUser('id') userId: string, @Body() dto: UpdateProfileDto) {
    return this.profileService.updateUsername(userId, dto.username!);
  }

  @Post('avatar/upload')
  @ApiOperation({ summary: 'Upload custom avatar image (max 5 MB)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary', description: 'Image file (jpg/png/webp)' } },
      required: ['file'],
    },
  })
  @ApiResponse({ status: 201, description: 'Avatar uploaded, URL returned' })
  @ApiResponse({ status: 400, description: 'File too large or invalid type' })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  uploadAvatar(@CurrentUser('id') userId: string, @UploadedFile() file: Express.Multer.File) {
    return this.profileService.uploadAvatar(userId, file);
  }

  @Put('avatar/predefined')
  @ApiOperation({ summary: 'Set a predefined avatar by ID' })
  @ApiBody({ schema: { type: 'object', properties: { predefinedId: { type: 'string' } }, required: ['predefinedId'] } })
  @ApiResponse({ status: 200, description: 'Avatar updated' })
  @ApiResponse({ status: 400, description: 'Invalid predefined avatar ID' })
  setPredefinedAvatar(@CurrentUser('id') userId: string, @Body('predefinedId') predefinedId: string) {
    return this.profileService.setPredefinedAvatar(userId, predefinedId);
  }

  @Get('avatars/predefined')
  @ApiOperation({ summary: 'List all available predefined avatars' })
  @ApiResponse({ status: 200, description: 'Array of predefined avatar options' })
  getPredefinedAvatars() {
    return this.profileService.getPredefinedAvatars();
  }
}
