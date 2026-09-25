import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
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
} from '../../gateway/access/access.decorators';
import {
  CreatePatientDto,
  ListPatientsQuery,
  PatientPage,
  PatientView,
  UpdatePatientDto,
} from './patients.dto';
import { PatientsService } from './patients.service';

@ApiTags('patients')
@ApiBearerAuth()
@Controller('patients')
export class PatientsController {
  constructor(private readonly patients: PatientsService) {}

  @Post()
  @RequirePermissions('patient:create')
  @ApiCreatedResponse({ type: PatientView })
  @ApiOkResponse({
    type: PatientView,
    description: 'Same clientUuid already registered (idempotent retry)',
  })
  @ApiConflictResponse({
    description: 'A patient with this national ID or MRN already exists',
  })
  async create(
    @Body() dto: CreatePatientDto,
    @CurrentUser() user: AuthenticatedUser,
    @Ctx() ctx: RequestContext,
    @Res({ passthrough: true }) res: Response,
  ): Promise<PatientView> {
    const { patient, created } = await this.patients.create(dto, user, ctx);
    res.status(created ? HttpStatus.CREATED : HttpStatus.OK);
    return patient;
  }

  @Get()
  @RequirePermissions('patient:read')
  @ApiOkResponse({ type: PatientPage })
  list(
    @Query() query: ListPatientsQuery,
    @CurrentUser() user: AuthenticatedUser,
    @Ctx() ctx: RequestContext,
  ): Promise<PatientPage> {
    return this.patients.list(query, user, ctx);
  }

  @Get('me')
  @RequirePermissions('patient:read_self')
  @ApiOkResponse({
    type: PatientView,
    description: "The caller's own patient record",
  })
  me(
    @CurrentUser() user: AuthenticatedUser,
    @Ctx() ctx: RequestContext,
  ): Promise<PatientView> {
    return this.patients.getOwn(user, ctx);
  }

  @Get(':id')
  @RequirePermissions('patient:read')
  @ApiOkResponse({ type: PatientView })
  get(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Ctx() ctx: RequestContext,
  ): Promise<PatientView> {
    return this.patients.get(id, user, ctx);
  }

  @Patch(':id')
  @RequirePermissions('patient:update')
  @ApiOkResponse({ type: PatientView })
  @ApiConflictResponse({
    description: 'VERSION_CONFLICT: the record changed since it was read',
  })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdatePatientDto,
    @CurrentUser() user: AuthenticatedUser,
    @Ctx() ctx: RequestContext,
  ): Promise<PatientView> {
    return this.patients.update(id, dto, user, ctx);
  }
}
