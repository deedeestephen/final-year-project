import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  Ctx,
  CurrentUser,
  RequirePermissions,
  type AuthenticatedUser,
  type RequestContext,
} from '../../gateway/access/access.decorators';
import { ActivityQuery, ActivityView } from './activity.dto';
import { ActivityService } from './activity.service';

/** The admin dashboard: what happens in the apps, as counts (audited). */
@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/activity')
export class ActivityController {
  constructor(private readonly activity: ActivityService) {}

  @Get()
  @RequirePermissions('audit:read')
  @ApiOperation({
    summary:
      'Activity in the phone app and the admin website: counts, days, sync health, recent phone actions',
  })
  @ApiOkResponse({ type: ActivityView })
  get(
    @Query() query: ActivityQuery,
    @CurrentUser() user: AuthenticatedUser,
    @Ctx() ctx: RequestContext,
  ): Promise<ActivityView> {
    return this.activity.activity(query.days, user, ctx);
  }
}
