import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  Ctx,
  CurrentUser,
  RequirePermissions,
  type AuthenticatedUser,
  type RequestContext,
} from '../../gateway/access/access.decorators';
import {
  SyncBatchDto,
  SyncBatchResponse,
  SyncChangesQuery,
  SyncChangesResponse,
} from './sync.dto';
import { SyncService } from './sync.service';

@ApiTags('sync')
@ApiBearerAuth()
@Controller('sync')
export class SyncController {
  constructor(private readonly sync: SyncService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('sync:write')
  @ApiOkResponse({
    type: SyncBatchResponse,
    description:
      'One result per operation, in order: APPLIED, CONFLICT (with the server copy) or REJECTED (permanent; fix and resubmit with a new key). Retrying a key returns the stored result.',
  })
  push(
    @Body() batch: SyncBatchDto,
    @CurrentUser() user: AuthenticatedUser,
    @Ctx() ctx: RequestContext,
  ): Promise<SyncBatchResponse> {
    return this.sync.push(batch, user, ctx);
  }

  @Get('changes')
  @RequirePermissions('patient:read', 'clinical:read')
  @ApiOkResponse({ type: SyncChangesResponse })
  changes(
    @Query() query: SyncChangesQuery,
    @CurrentUser() user: AuthenticatedUser,
    @Ctx() ctx: RequestContext,
  ): Promise<SyncChangesResponse> {
    return this.sync.changes(query, user, ctx);
  }
}
