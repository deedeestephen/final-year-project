import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import {
  Ctx,
  CurrentUser,
  RequirePermissions,
  type AuthenticatedUser,
  type RequestContext,
} from '../access/access.decorators';
import {
  ClinicalRecordView,
  ConsentView,
  CreateClinicalRecordDto,
  GrantConsentDto,
} from './clinical.dto';
import { ClinicalService } from './clinical.service';

const uuid = () => new ParseUUIDPipe();

/** Clinical records and consents nested under a patient. `me` routes come first. */
@ApiTags('clinical')
@ApiBearerAuth()
@Controller('patients')
export class PatientClinicalController {
  constructor(private readonly clinical: ClinicalService) {}

  @Get('me/consents')
  @RequirePermissions('consent:read_self')
  @ApiOkResponse({ type: [ConsentView] })
  myConsents(@CurrentUser() user: AuthenticatedUser): Promise<ConsentView[]> {
    return this.clinical.listOwnConsents(user);
  }

  @Post('me/consents/:consentId/withdraw')
  @RequirePermissions('consent:withdraw_self')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: ConsentView })
  withdrawMyConsent(
    @Param('consentId', uuid()) consentId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Ctx() ctx: RequestContext,
  ): Promise<ConsentView> {
    return this.clinical.withdrawOwnConsent(consentId, user, ctx);
  }

  @Post(':id/clinical-records')
  @RequirePermissions('clinical:create')
  @ApiCreatedResponse({ type: ClinicalRecordView })
  @ApiOkResponse({
    type: ClinicalRecordView,
    description: 'Same clientUuid already recorded (idempotent retry)',
  })
  async createRecord(
    @Param('id', uuid()) patientId: string,
    @Body() dto: CreateClinicalRecordDto,
    @CurrentUser() user: AuthenticatedUser,
    @Ctx() ctx: RequestContext,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ClinicalRecordView> {
    const { record, created } = await this.clinical.createRecord(
      patientId,
      dto,
      user,
      ctx,
    );
    res.status(created ? HttpStatus.CREATED : HttpStatus.OK);
    return record;
  }

  @Get(':id/clinical-records')
  @RequirePermissions('clinical:read')
  @ApiOkResponse({
    type: [ClinicalRecordView],
    description: 'Patient history, newest first',
  })
  listRecords(
    @Param('id', uuid()) patientId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Ctx() ctx: RequestContext,
  ): Promise<ClinicalRecordView[]> {
    return this.clinical.listRecords(patientId, user, ctx);
  }

  @Post(':id/consents')
  @RequirePermissions('consent:manage')
  @ApiCreatedResponse({ type: ConsentView })
  grantConsent(
    @Param('id', uuid()) patientId: string,
    @Body() dto: GrantConsentDto,
    @CurrentUser() user: AuthenticatedUser,
    @Ctx() ctx: RequestContext,
  ): Promise<ConsentView> {
    return this.clinical.grantConsent(patientId, dto, user, ctx);
  }

  @Get(':id/consents')
  @RequirePermissions('consent:manage')
  @ApiOkResponse({ type: [ConsentView] })
  listConsents(
    @Param('id', uuid()) patientId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ConsentView[]> {
    return this.clinical.listConsents(patientId, user);
  }

  @Post(':id/consents/:consentId/withdraw')
  @RequirePermissions('consent:manage')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: ConsentView })
  withdrawConsent(
    @Param('id', uuid()) patientId: string,
    @Param('consentId', uuid()) consentId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Ctx() ctx: RequestContext,
  ): Promise<ConsentView> {
    return this.clinical.withdrawConsent(patientId, consentId, user, ctx);
  }
}

@ApiTags('clinical')
@ApiBearerAuth()
@Controller('clinical-records')
export class ClinicalRecordsController {
  constructor(private readonly clinical: ClinicalService) {}

  @Get(':id')
  @RequirePermissions('clinical:read')
  @ApiOkResponse({ type: ClinicalRecordView })
  get(
    @Param('id', uuid()) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Ctx() ctx: RequestContext,
  ): Promise<ClinicalRecordView> {
    return this.clinical.getRecord(id, user, ctx);
  }
}
