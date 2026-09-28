import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import type { Bundle } from 'fhir/r4';
import {
  Ctx,
  CurrentUser,
  RequirePermissions,
  type AuthenticatedUser,
  type RequestContext,
} from '../../gateway/access/access.decorators';
import {
  FhirExportDto,
  FhirExportQuery,
  FhirExportSummaryView,
  FhirPushDto,
  FhirPushResultView,
} from './fhir.dto';
import { FhirExportService } from './fhir-export.service';

/** De-identified HL7 FHIR R4 export for research and SmartCare Pro (UC-08). */
@ApiTags('fhir')
@ApiBearerAuth()
@Controller('fhir/export')
export class FhirController {
  constructor(private readonly fhir: FhirExportService) {}

  @Get('summary')
  @RequirePermissions('fhir:export')
  @ApiOperation({
    summary: 'What an export would contain, without exporting anything',
  })
  @ApiOkResponse({ type: FhirExportSummaryView })
  summary(@Query() query: FhirExportQuery): Promise<FhirExportSummaryView> {
    return this.fhir.summary(query);
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('fhir:export')
  @ApiOperation({
    summary: 'Download a de-identified FHIR R4 Bundle (type collection)',
    description:
      'Safe Harbor de-identification (docs/security.md): no names, contact ' +
      'details, national ids or record numbers; dates reduced to the year; ' +
      'pseudonymous ids. Development mock AI results are never included. Audited.',
  })
  @ApiProduces('application/fhir+json')
  @ApiOkResponse({
    description: 'FHIR R4 Bundle',
    schema: { type: 'object', additionalProperties: true },
  })
  async export(
    @Body() dto: FhirExportDto,
    @CurrentUser() user: AuthenticatedUser,
    @Ctx() ctx: RequestContext,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Bundle> {
    const bundle = await this.fhir.export(dto, user, ctx);
    const day = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/fhir+json; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="pca-mhealth-fhir-${dto.purpose.toLowerCase()}-${day}.json"`,
    );
    res.setHeader('Cache-Control', 'no-store');
    return bundle;
  }

  @Post('push')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('fhir:export')
  @ApiOperation({
    summary: 'Send the national-EHR export to SmartCare Pro',
    description:
      'Patients with EHR-sharing consent only. 503 when no SmartCare Pro ' +
      'address is set; 502/504 when it cannot be reached or refuses. Audited.',
  })
  @ApiOkResponse({ type: FhirPushResultView })
  push(
    @Body() dto: FhirPushDto,
    @CurrentUser() user: AuthenticatedUser,
    @Ctx() ctx: RequestContext,
  ): Promise<FhirPushResultView> {
    return this.fhir.push(dto.facilityId, user, ctx);
  }
}
