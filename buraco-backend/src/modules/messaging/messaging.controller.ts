import { Controller, Get, Param, Post, Put, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation,
  ApiParam, ApiQuery, ApiResponse, ApiTags,
} from '@nestjs/swagger';
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
  @ApiOperation({ summary: 'Get all conversations (direct + club) for current user' })
  @ApiResponse({ status: 200, description: 'Array of conversations with last message preview' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getConversations(@CurrentUser('id') userId: string) {
    return this.messagingService.getConversations(userId);
  }

  @Get('conversations/:conversationId/messages')
  @ApiOperation({ summary: 'Get paginated message history for a conversation' })
  @ApiParam({ name: 'conversationId', description: 'Conversation UUID' })
  @ApiQuery({ name: 'page',  required: false, type: Number, description: 'Page number (default 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Messages per page (default 50)' })
  @ApiResponse({ status: 200, description: 'Paginated messages array' })
  @ApiResponse({ status: 403, description: 'Not a member of this conversation' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  getHistory(
    @Param('conversationId') conversationId: string,
    @CurrentUser('id') userId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 50,
  ) {
    return this.messagingService.getHistory(conversationId, userId, +page, +limit);
  }

  @Post('conversations/:conversationId/voice')
  @ApiOperation({ summary: 'Upload a voice message (max 2 MB). S3 upload pending.' })
  @ApiParam({ name: 'conversationId', description: 'Conversation UUID' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary', description: 'Voice audio file' } },
      required: ['file'],
    },
  })
  @ApiResponse({ status: 201, description: 'Voice message uploaded and sent' })
  @ApiResponse({ status: 400, description: 'File too large or wrong format' })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 } }))
  sendVoiceMessage(
    @Param('conversationId') conversationId: string,
    @CurrentUser('id') userId: string,
    @UploadedFile() _file: Express.Multer.File,
  ) {
    return { message: 'Voice upload endpoint — S3 integration pending' };
  }

  @Put('conversations/:conversationId/read')
  @ApiOperation({ summary: 'Mark all messages in a conversation as read' })
  @ApiParam({ name: 'conversationId', description: 'Conversation UUID' })
  @ApiResponse({ status: 200, description: 'All messages marked as read' })
  @ApiResponse({ status: 403, description: 'Not a member of this conversation' })
  markAsRead(@Param('conversationId') conversationId: string, @CurrentUser('id') userId: string) {
    return this.messagingService.markAsRead(conversationId, userId);
  }
}
