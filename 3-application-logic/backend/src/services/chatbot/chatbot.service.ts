import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { APP_CONFIG, type AppConfig } from '../../config/app-config';
import type {
  AuthenticatedUser,
  RequestContext,
} from '../../gateway/access/access.decorators';
import { MongoService } from '../../persistence/database/mongo.service';
import type { ChatAudience } from '../ai/ai-contract';
import { AiBrokerService, AiServiceError } from '../ai/ai-broker.service';
import { AuditService } from '../audit/audit.service';
import {
  DISCLAIMER,
  FIXED_TEXT,
  checkAnswer,
  checkQuestion,
  smallTalk,
  type ChatSafety,
} from './chat-safety';
import type {
  AskResponse,
  ChatMessageView,
  ConversationPage,
  ConversationSummaryView,
  ConversationView,
  ListConversationsQuery,
} from './chatbot.dto';

/** Languages with human-verified content (ADR-009); others answer 409. */
export const AVAILABLE_CHAT_LANGUAGES: readonly string[] = ['en'];

interface StoredMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  at: Date;
  sources?: { name: string; url: string }[];
  safety?: ChatSafety;
  mode?: 'EXTRACTIVE' | 'GENERATED' | 'FIXED';
  reviewStatus?: string;
  kbVersion?: string;
  /** The Claude model that wrote a GENERATED answer. */
  model?: string;
}

interface StoredConversation {
  _id: string;
  userId: string;
  language: string;
  audience: ChatAudience;
  messages: StoredMessage[];
  createdAt: Date;
  updatedAt: Date;
  /** MongoDB deletes the conversation at this time (TTL index). */
  expiresAt: Date;
}

/** Thrown when the caller asked too many questions in the last hour. */
export class ChatRateLimitedError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super('Too many questions in the last hour');
    this.name = 'ChatRateLimitedError';
  }
}

const HOUR_MS = 3_600_000;

/**
 * The chatbot (Phase 13, UC-07): safety checks, answers quoted from the
 * reviewed knowledge base by the AI service, and the caller's own
 * conversations. The audit log records that a question was asked and how it
 * was handled, never its text.
 */
@Injectable()
export class ChatbotService {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly mongo: MongoService,
    private readonly ai: AiBrokerService,
    private readonly audit: AuditService,
  ) {}

  private async collection() {
    return (await this.mongo.db()).collection<StoredConversation>(
      'chatbot_conversations',
    );
  }

  /** Patients get patient content; clinicians also get reference cards. */
  static audienceOf(user: AuthenticatedUser): ChatAudience {
    return user.roles.includes('CLINICIAN') ? 'clinician' : 'patient';
  }

  private expiry(from: Date): Date {
    return new Date(
      from.getTime() + this.config.chat.retentionDays * 24 * HOUR_MS,
    );
  }

  async create(
    language: string,
    user: AuthenticatedUser,
    ctx: RequestContext,
  ): Promise<ConversationView> {
    if (!AVAILABLE_CHAT_LANGUAGES.includes(language)) {
      throw new ConflictException({
        code: 'LANGUAGE_NOT_AVAILABLE',
        message:
          'There is no verified content in this language yet. Please use English.',
      });
    }
    const now = new Date();
    const conversation: StoredConversation = {
      _id: randomUUID(),
      userId: user.id,
      language,
      audience: ChatbotService.audienceOf(user),
      messages: [],
      createdAt: now,
      updatedAt: now,
      expiresAt: this.expiry(now),
    };
    await (await this.collection()).insertOne(conversation);
    await this.audit.record({
      action: 'chat.conversation.created',
      entityType: 'chat_conversation',
      entityId: conversation._id,
      outcome: 'SUCCESS',
      actorUserId: user.id,
      actorRole: user.roles.join(','),
      details: { language, audience: conversation.audience },
      ...ctx,
    });
    return toView(conversation);
  }

  async list(
    query: ListConversationsQuery,
    user: AuthenticatedUser,
  ): Promise<ConversationPage> {
    const col = await this.collection();
    const [items, total] = await Promise.all([
      col
        .aggregate<{
          _id: string;
          language: string;
          audience: string;
          createdAt: Date;
          updatedAt: Date;
          messageCount: number;
          first: StoredMessage | null;
        }>([
          { $match: { userId: user.id } },
          { $sort: { updatedAt: -1 } },
          { $skip: (query.page - 1) * query.pageSize },
          { $limit: query.pageSize },
          {
            $project: {
              language: 1,
              audience: 1,
              createdAt: 1,
              updatedAt: 1,
              messageCount: { $size: '$messages' },
              first: { $arrayElemAt: ['$messages', 0] },
            },
          },
        ])
        .toArray(),
      col.countDocuments({ userId: user.id }),
    ]);
    return {
      items: items.map((c) => ({
        id: c._id,
        language: c.language,
        audience: c.audience,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
        messageCount: c.messageCount,
        preview: c.first ? shorten(c.first.text) : null,
      })),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  async get(id: string, user: AuthenticatedUser): Promise<ConversationView> {
    return toView(await this.requireOwn(id, user));
  }

  async remove(
    id: string,
    user: AuthenticatedUser,
    ctx: RequestContext,
  ): Promise<void> {
    const result = await (
      await this.collection()
    ).deleteOne({ _id: id, userId: user.id });
    if (result.deletedCount === 0) throw notFound();
    await this.audit.record({
      action: 'chat.conversation.deleted',
      entityType: 'chat_conversation',
      entityId: id,
      outcome: 'SUCCESS',
      actorUserId: user.id,
      actorRole: user.roles.join(','),
      ...ctx,
    });
  }

  async ask(
    id: string,
    text: string,
    user: AuthenticatedUser,
    ctx: RequestContext,
  ): Promise<AskResponse> {
    const conversation = await this.requireOwn(id, user);
    await this.checkRate(user);
    const now = new Date();
    const question: StoredMessage = {
      id: randomUUID(),
      role: 'user',
      text,
      at: now,
    };
    const { answer, reason } = await this.answer(
      text,
      conversation.audience,
      conversation.language,
      conversation.messages,
    );
    await (
      await this.collection()
    ).updateOne(
      { _id: conversation._id, userId: user.id },
      {
        $push: { messages: { $each: [question, answer] } },
        $set: { updatedAt: answer.at, expiresAt: this.expiry(answer.at) },
      },
    );
    await this.audit.record({
      action: 'chat.asked',
      entityType: 'chat_conversation',
      entityId: conversation._id,
      outcome: 'SUCCESS',
      actorUserId: user.id,
      actorRole: user.roles.join(','),
      details: {
        safety: answer.safety,
        reason,
        mode: answer.mode,
        sources: answer.sources?.length ?? 0,
        ...(answer.kbVersion ? { knowledgeBase: answer.kbVersion } : {}),
        ...(answer.model ? { model: answer.model } : {}),
      },
      ...ctx,
    });
    return {
      question: messageView(question, conversation.audience),
      answer: messageView(answer, conversation.audience),
    };
  }

  /** Safety check, then the quoted answer, then the output check. */
  private async answer(
    text: string,
    audience: ChatAudience,
    language: string,
    earlier: StoredMessage[],
  ): Promise<{ answer: StoredMessage; reason: string }> {
    const fixed = (safety: ChatSafety, fixedText: string, reason: string) => ({
      answer: {
        id: randomUUID(),
        role: 'assistant' as const,
        text: fixedText,
        at: new Date(),
        sources: [],
        safety,
        mode: 'FIXED' as const,
      },
      reason,
    });
    const decision = checkQuestion(text, audience);
    if (decision.safety !== 'OK') {
      return fixed(decision.safety, decision.text!, decision.reason);
    }
    // The number of earlier questions varies repeated replies ("Hi again!",
    // another joke).
    const friendly = smallTalk(
      text,
      audience,
      earlier.filter((m) => m.role === 'user').length,
    );
    if (friendly) return fixed('OK', friendly, 'small-talk');
    const noSource =
      audience === 'patient'
        ? FIXED_TEXT.noSourcePatient
        : FIXED_TEXT.noSourceClinician;
    let result;
    try {
      result = await this.ai.chatAnswer({
        question: text,
        audience,
        language,
        // The last three questions and answers, for follow-ups.
        history: earlier.slice(-6).map((m) => ({ role: m.role, text: m.text })),
      });
    } catch (err) {
      if (err instanceof AiServiceError && err.status === 409) {
        throw new ConflictException({
          code: 'LANGUAGE_NOT_AVAILABLE',
          message: 'There is no verified content in this language yet.',
        });
      }
      throw new ServiceUnavailableException({
        code: 'CHAT_UNAVAILABLE',
        message: 'The assistant is not available right now. Please try later.',
      });
    }
    if (!result.matched) return fixed('NO_SOURCE', noSource, 'no-match');
    const check = checkAnswer(result.text, result.sources.length);
    if (!check.ok) return fixed('NO_SOURCE', noSource, check.reason);
    return {
      answer: {
        id: randomUUID(),
        role: 'assistant',
        text: result.text!,
        at: new Date(),
        sources: result.sources,
        safety: 'OK',
        mode: result.mode,
        reviewStatus: result.knowledgeBase.reviewStatus,
        kbVersion: result.knowledgeBase.version,
        ...(result.model ? { model: result.model } : {}),
      },
      reason: 'answered',
    };
  }

  /** At most CHAT_MAX_QUESTIONS_PER_HOUR questions in any hour. */
  private async checkRate(user: AuthenticatedUser): Promise<void> {
    const since = new Date(Date.now() - HOUR_MS);
    const recent = await (
      await this.collection()
    )
      .aggregate<{ at: Date }>([
        { $match: { userId: user.id, updatedAt: { $gte: since } } },
        { $unwind: '$messages' },
        { $match: { 'messages.role': 'user', 'messages.at': { $gte: since } } },
        { $project: { _id: 0, at: '$messages.at' } },
        { $sort: { at: 1 } },
      ])
      .toArray();
    const limit = this.config.chat.maxQuestionsPerHour;
    if (recent.length >= limit) {
      const oldest = recent[recent.length - limit].at.getTime();
      throw new ChatRateLimitedError(
        Math.max(1, Math.ceil((oldest + HOUR_MS - Date.now()) / 1000)),
      );
    }
  }

  private async requireOwn(
    id: string,
    user: AuthenticatedUser,
  ): Promise<StoredConversation> {
    const found = await (
      await this.collection()
    ).findOne({ _id: id, userId: user.id });
    // Someone else's conversation looks the same as a missing one.
    if (!found) throw notFound();
    return found;
  }
}

const notFound = () =>
  new NotFoundException({
    code: 'NOT_FOUND',
    message: 'Conversation not found',
  });

const shorten = (text: string) =>
  text.length > 80 ? `${text.slice(0, 77)}…` : text;

function messageView(
  m: StoredMessage,
  audience: ChatAudience,
): ChatMessageView {
  const view: ChatMessageView = {
    id: m.id,
    role: m.role,
    text: m.text,
    at: m.at.toISOString(),
  };
  if (m.role === 'assistant') {
    view.sources = m.sources ?? [];
    view.safety = m.safety;
    view.mode = m.mode;
    view.disclaimer = DISCLAIMER[audience];
    if (m.reviewStatus) view.reviewStatus = m.reviewStatus;
    if (m.model) view.model = m.model;
  }
  return view;
}

function toView(c: StoredConversation): ConversationView {
  const summary: ConversationSummaryView = {
    id: c._id,
    language: c.language,
    audience: c.audience,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    messageCount: c.messages.length,
    preview: c.messages[0] ? shorten(c.messages[0].text) : null,
  };
  return {
    ...summary,
    messages: c.messages.map((m) => messageView(m, c.audience)),
  };
}
