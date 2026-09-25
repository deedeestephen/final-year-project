import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
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
  FacilityView,
  ListPatientAccountsQuery,
  PatientAccountPage,
  PatientAccountView,
  PermissionInfo,
  RecordMatchView,
  RoleView,
  UpdateRolePermissionsDto,
} from './admin.dto';
import { AdminService } from './admin.service';

const uuid = () => new ParseUUIDPipe();

/** Administration: roles and permissions, facilities, patient account links. */
@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('permissions')
  @RequirePermissions('user:manage')
  @ApiOkResponse({ type: [PermissionInfo] })
  permissions(): PermissionInfo[] {
    return this.admin.permissionCatalogue();
  }

  @Get('roles')
  @RequirePermissions('user:manage')
  @ApiOkResponse({ type: [RoleView] })
  roles(): Promise<RoleView[]> {
    return this.admin.roles();
  }

  @Put('roles/:name/permissions')
  @RequirePermissions('role:manage')
  @ApiOkResponse({
    type: RoleView,
    description:
      "Replaces the role's permissions. Takes effect on the next request of every user with the role.",
  })
  setPermissions(
    @Param('name') name: string,
    @Body() dto: UpdateRolePermissionsDto,
    @CurrentUser() user: AuthenticatedUser,
    @Ctx() ctx: RequestContext,
  ): Promise<RoleView> {
    return this.admin.setRolePermissions(name, dto.permissions, user, ctx);
  }

  @Post('roles/:name/reset')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('role:manage')
  @ApiOkResponse({ type: RoleView })
  resetRole(
    @Param('name') name: string,
    @CurrentUser() user: AuthenticatedUser,
    @Ctx() ctx: RequestContext,
  ): Promise<RoleView> {
    return this.admin.resetRole(name, user, ctx);
  }

  @Get('facilities')
  @RequirePermissions('user:manage')
  @ApiOkResponse({ type: [FacilityView] })
  facilities(): Promise<FacilityView[]> {
    return this.admin.facilities();
  }

  @Get('patient-accounts')
  @RequirePermissions('patient_account:link')
  @ApiOkResponse({ type: PatientAccountPage })
  patientAccounts(
    @Query() query: ListPatientAccountsQuery,
  ): Promise<PatientAccountPage> {
    return this.admin.patientAccounts(query);
  }

  @Post('patient-accounts/:userId/match')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('patient_account:link')
  @ApiOkResponse({
    type: RecordMatchView,
    description:
      'The clinic record with the same NRC (record number and facility only)',
  })
  match(@Param('userId', uuid()) userId: string): Promise<RecordMatchView> {
    return this.admin.matchRecord(userId);
  }

  @Post('patient-accounts/:userId/link')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('patient_account:link')
  @ApiOkResponse({ type: PatientAccountView })
  link(
    @Param('userId', uuid()) userId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Ctx() ctx: RequestContext,
  ): Promise<PatientAccountView> {
    return this.admin.link(userId, user, ctx);
  }

  @Post('patient-accounts/:userId/unlink')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('patient_account:link')
  @ApiOkResponse({ type: PatientAccountView })
  unlink(
    @Param('userId', uuid()) userId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Ctx() ctx: RequestContext,
  ): Promise<PatientAccountView> {
    return this.admin.unlink(userId, user, ctx);
  }
}
