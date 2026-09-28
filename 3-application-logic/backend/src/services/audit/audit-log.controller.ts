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
import {
  AuditChainView,
  AuditLogPage,
  ListAuditLogsQuery,
} from './audit-log.dto';
import { AuditLogService } from './audit-log.service';

/** The audit log, read-only, for administrators (UC-09, FR-10). */
@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/audit-logs')
export class AuditLogController {
  constructor(private readonly logs: AuditLogService) {}

  @Get()
  @RequirePermissions('audit:read')
  @ApiOperation({ summary: 'Read the audit log, newest first (audited)' })
  @ApiOkResponse({ type: AuditLogPage })
  list(
    @Query() query: ListAuditLogsQuery,
    @CurrentUser() user: AuthenticatedUser,
    @Ctx() ctx: RequestContext,
  ): Promise<AuditLogPage> {
    return this.logs.list(query, user, ctx);
  }

  @Get('verify')
  @RequirePermissions('audit:read')
  @ApiOperation({
    summary:
      'Check that the hash chain is unbroken (nothing changed or removed)',
  })
  @ApiOkResponse({ type: AuditChainView })
  verify(
    @CurrentUser() user: AuthenticatedUser,
    @Ctx() ctx: RequestContext,
  ): Promise<AuditChainView> {
    return this.logs.verify(user, ctx);
  }
}
