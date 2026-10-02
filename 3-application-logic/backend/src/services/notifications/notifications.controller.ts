import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
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
  PushDeviceView,
  RegisterDeviceDto,
} from './notifications.dto';
import { NotificationsService } from './notifications.service';
import { PushDevicesService } from './push/push-devices.service';

/** The caller's own in-app notifications, and the phones they are pushed to. */
@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly devices: PushDevicesService,
  ) {}

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

  /** This phone receives the caller's notifications as pushes (ADR-014). */
  @Post('devices')
  @RequirePermissions('notification:read')
  @ApiCreatedResponse({ type: PushDeviceView })
  registerDevice(
    @Body() dto: RegisterDeviceDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PushDeviceView> {
    return this.devices.register(dto, user);
  }

  /** Stops the pushes to one of the caller's phones (at sign-out). */
  @Delete('devices/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('notification:read')
  @ApiNoContentResponse()
  removeDevice(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    return this.devices.remove(id, user);
  }
}
