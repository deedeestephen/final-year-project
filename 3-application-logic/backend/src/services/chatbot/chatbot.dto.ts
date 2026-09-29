import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import { IsSafeText } from '../../gateway/validation/safe-text';
import { CHAT_LANGUAGES } from '../../persistence/mongo/collections';

export class CreateConversationDto {
  @ApiPropertyOptional({
    enum: CHAT_LANGUAGES,
    default: 'en',
    description: 'bem and nya only once human-verified content exists',
  })
  @IsOptional()
  @IsIn(CHAT_LANGUAGES)
  language: (typeof CHAT_LANGUAGES)[number] = 'en';
}

export class AskDto {
  @ApiProperty({ minLength: 1, maxLength: 1000 })
  @IsString()
  @Length(1, 1000)
  @IsSafeText()
  text!: string;
}

export class ListConversationsQuery {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize = 20;
}

export class ChatSourceView {
  @ApiProperty() name!: string;
  @ApiProperty({ description: 'Empty for project documents' }) url!: string;
}

export class ChatMessageView {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: ['user', 'assistant'] }) role!: 'user' | 'assistant';
  @ApiProperty() text!: string;
  @ApiProperty() at!: string;
  @ApiPropertyOptional({ type: [ChatSourceView] }) sources?: ChatSourceView[];
  @ApiPropertyOptional({ enum: ['OK', 'URGENT_CARE', 'DECLINED', 'NO_SOURCE'] })
  safety?: string;
  @ApiPropertyOptional() disclaimer?: string;
  @ApiPropertyOptional({
    description: 'Review status of the quoted documents',
  })
  reviewStatus?: string;
  @ApiPropertyOptional({
    enum: ['EXTRACTIVE', 'GENERATED', 'FIXED'],
    description:
      'EXTRACTIVE: quoted; GENERATED: written by Claude from the quoted sources; FIXED: a fixed text',
  })
  mode?: string;
  @ApiPropertyOptional({
    description: 'The Claude model that wrote a GENERATED answer',
  })
  model?: string;
}

export class ConversationSummaryView {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: CHAT_LANGUAGES }) language!: string;
  @ApiProperty({ enum: ['patient', 'clinician'] }) audience!: string;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
  @ApiProperty() messageCount!: number;
  @ApiPropertyOptional({
    nullable: true,
    type: String,
    description: 'The first question, shortened',
  })
  preview!: string | null;
}

export class ConversationView extends ConversationSummaryView {
  @ApiProperty({ type: [ChatMessageView] }) messages!: ChatMessageView[];
}

export class ConversationPage {
  @ApiProperty({ type: [ConversationSummaryView] })
  items!: ConversationSummaryView[];
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
  @ApiProperty() total!: number;
}

export class AskResponse {
  @ApiProperty({ type: ChatMessageView }) question!: ChatMessageView;
  @ApiProperty({ type: ChatMessageView }) answer!: ChatMessageView;
}
