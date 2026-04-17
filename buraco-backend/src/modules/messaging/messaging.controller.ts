import { Controller, Get, Param, Post, Put, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { MessagingService } from './messaging.service';

@ApiTags('Messaging')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('messaging')
export class MessagingController {
  constructor(private readonly messagingService: MessagingService) {}

  @Get('conversations')
  @ApiOperation({ summary: 'Get all conversations' })
  getConversations(@CurrentUser('id') userId: string) {
    return this.messagingService.getConversations(userId);
  }

  @Get('conversations/:conversationId/messages')
  @ApiOperation({ summary: 'Get message history' })
  getHistory(
    @Param('conversationId') conversationId: string,
    @CurrentUser('id') userId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 50,
  ) {
    return this.messagingService.getHistory(conversationId, userId, +page, +limit);
  }

  @Post('conversations/:conversationId/voice')
  @ApiOperation({ summary: 'Upload and send a voice message' })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 } }))
  sendVoiceMessage(
    @Param('conversationId') conversationId: string,
    @CurrentUser('id') userId: string,
    @UploadedFile() _file: Express.Multer.File,
  ) {
    // TODO: upload to S3 then call sendVoiceMessage
    return { message: 'Voice upload endpoint — S3 integration pending' };
  }

  @Put('conversations/:conversationId/read')
  @ApiOperation({ summary: 'Mark all messages in conversation as read' })
  markAsRead(@Param('conversationId') conversationId: string, @CurrentUser('id') userId: string) {
    return this.messagingService.markAsRead(conversationId, userId);
  }
}
