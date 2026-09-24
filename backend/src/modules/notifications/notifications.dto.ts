import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export class ListNotificationsQuery {
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  unreadOnly = false;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;
}

export class NotificationView {
  @ApiProperty() id!: string;
  @ApiProperty({
    description: 'e.g. clinical_record.created, consent.withdrawn',
  })
  type!: string;
  @ApiProperty() title!: string;
  @ApiProperty() body!: string;
  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  readAt!: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
}

export class NotificationPage {
  @ApiProperty({ type: [NotificationView] }) items!: NotificationView[];
  @ApiProperty() unreadCount!: number;
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
  @ApiProperty() total!: number;
}

export class MarkedReadResponse {
  @ApiProperty({ description: 'How many notifications changed to read' })
  updated!: number;
}
