import { BadRequestException, Body, Controller, Get, Param, Post, Put, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation,
  ApiParam, ApiQuery, ApiResponse, ApiTags,
} from '@nestjs/swagger';
import { v4 as uuidv4 } from 'uuid';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { S3Service } from '../../common/s3/s3.service';
import { SocketService } from '../../common/socket/socket.service';
import { MessagingService } from './messaging.service';

const ALLOWED_AUDIO_TYPES = ['audio/mpeg', 'audio/mp4', 'audio/webm', 'audio/ogg', 'audio/wav', 'audio/aac', 'audio/x-m4a'];

@ApiTags('Messaging')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('messaging')
export class MessagingController {
  constructor(
    private readonly messagingService: MessagingService,
    private readonly s3: S3Service,
    private readonly socketService: SocketService,
  ) {}

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
  @ApiOperation({ summary: 'Upload a voice message (multipart/form-data, max 5 MB). Fields: file (audio), duration (seconds).' })
  @ApiParam({ name: 'conversationId', description: 'Conversation UUID' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'duration'],
      properties: {
        file:     { type: 'string', format: 'binary', description: 'Audio file (mp3, m4a, webm, ogg, wav, aac)' },
        duration: { type: 'number', description: 'Recording duration in seconds' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Voice message sent; also emitted on chat:message WS event' })
  @ApiResponse({ status: 400, description: 'Missing file, unsupported audio format, or invalid duration' })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async sendVoiceMessage(
    @Param('conversationId') conversationId: string,
    @CurrentUser('id') userId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('duration') rawDuration: string,
  ) {
    if (!file) throw new BadRequestException('No audio file provided');
    if (!ALLOWED_AUDIO_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(`Unsupported audio format: ${file.mimetype}`);
    }

    const duration = parseFloat(rawDuration);
    if (!Number.isFinite(duration) || duration <= 0) {
      throw new BadRequestException('duration must be a positive number (seconds)');
    }

    const ext = file.originalname.split('.').pop() ?? 'audio';
    const key = `voice-messages/${conversationId}/${uuidv4()}.${ext}`;
    const voiceUrl = await this.s3.upload(key, file.buffer, file.mimetype);

    const message = await this.messagingService.sendVoiceMessage(conversationId, userId, voiceUrl, duration);

    // Broadcast to all conversation members connected over WebSocket
    this.socketService.emitToRoom(`conv:${conversationId}`, 'chat:message', message);

    return message;
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
