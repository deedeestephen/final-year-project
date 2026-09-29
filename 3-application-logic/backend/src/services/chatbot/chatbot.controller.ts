import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import {
  Ctx,
  CurrentUser,
  RequirePermissions,
  type AuthenticatedUser,
  type RequestContext,
} from '../../gateway/access/access.decorators';
import {
  AskDto,
  AskResponse,
  ConversationPage,
  ConversationView,
  CreateConversationDto,
  ListConversationsQuery,
} from './chatbot.dto';
import { ChatRateLimitedError, ChatbotService } from './chatbot.service';

/** The assistant for patients and clinicians (Phase 13, UC-07). */
@ApiTags('chat')
@ApiBearerAuth()
@Controller('chat/conversations')
export class ChatbotController {
  constructor(private readonly chat: ChatbotService) {}

  @Post()
  @RequirePermissions('chatbot:use')
  @ApiOperation({
    summary: 'Start a conversation (the audience comes from the role)',
  })
  @ApiCreatedResponse({ type: ConversationView })
  create(
    @Body() dto: CreateConversationDto,
    @CurrentUser() user: AuthenticatedUser,
    @Ctx() ctx: RequestContext,
  ): Promise<ConversationView> {
    return this.chat.create(dto.language, user, ctx);
  }

  @Get()
  @RequirePermissions('chatbot:use')
  @ApiOperation({ summary: "The caller's own conversations, newest first" })
  @ApiOkResponse({ type: ConversationPage })
  list(
    @Query() query: ListConversationsQuery,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ConversationPage> {
    return this.chat.list(query, user);
  }

  @Get(':id')
  @RequirePermissions('chatbot:use')
  @ApiOkResponse({ type: ConversationView })
  get(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ConversationView> {
    return this.chat.get(id, user);
  }

  @Post(':id/messages')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('chatbot:use')
  @ApiOperation({
    summary:
      'Ask a question: an answer quoted from reviewed sources, or urgent-care guidance, a polite refusal, or "no reviewed information"',
  })
  @ApiOkResponse({ type: AskResponse })
  async ask(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AskDto,
    @CurrentUser() user: AuthenticatedUser,
    @Ctx() ctx: RequestContext,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AskResponse> {
    try {
      return await this.chat.ask(id, dto.text.trim(), user, ctx);
    } catch (err) {
      if (err instanceof ChatRateLimitedError) {
        res.setHeader('Retry-After', String(err.retryAfterSeconds));
        throw new HttpException(
          {
            code: 'RATE_LIMITED',
            message:
              'Too many questions in the last hour. Please try again later.',
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      throw err;
    }
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('chatbot:use')
  @ApiNoContentResponse()
  remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Ctx() ctx: RequestContext,
  ): Promise<void> {
    return this.chat.remove(id, user, ctx);
  }
}
