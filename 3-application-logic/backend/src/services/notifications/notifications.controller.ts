import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  RequirePermissions,
  type AuthenticatedUser,
} from '../../gateway/access/access.decorators';
import {
  ListNotificationsQuery,
  MarkedReadResponse,
  NotificationPage,
  NotificationView,
} from './notifications.dto';
import { NotificationsService } from './notifications.service';

/** The caller's own in-app notifications. */
@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @RequirePermissions('notification:read')
  @ApiOkResponse({ type: NotificationPage })
  list(
    @Query() query: ListNotificationsQuery,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<NotificationPage> {
    return this.notifications.list(query, user);
  }

  // Declared before ':id/read' so "read-all" is not taken as an id.
  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('notification:read')
  @ApiOkResponse({ type: MarkedReadResponse })
  markAllRead(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MarkedReadResponse> {
    return this.notifications.markAllRead(user);
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('notification:read')
  @ApiOkResponse({ type: NotificationView })
  markRead(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<NotificationView> {
    return this.notifications.markRead(id, user);
  }
}
