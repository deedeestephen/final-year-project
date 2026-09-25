import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiOkResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  Ctx,
  CurrentUser,
  RequirePermissions,
  type AuthenticatedUser,
  type RequestContext,
} from '../access/access.decorators';
import { AiJobView, AiModelView } from './ai.dto';
import { AiService } from './ai.service';

const uuid = () => new ParseUUIDPipe();

@ApiTags('ai')
@ApiBearerAuth()
@Controller('patients')
export class PatientAiController {
  constructor(private readonly ai: AiService) {}

  @Post(':id/ai-jobs')
  @RequirePermissions('ai:request')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiAcceptedResponse({
    type: AiJobView,
    description: 'Queued; poll GET /ai-jobs/{id} for the result',
  })
  @ApiConflictResponse({
    description:
      'CONSENT_REQUIRED, CLINICAL_RECORD_REQUIRED or AI_JOB_IN_PROGRESS',
  })
  @ApiServiceUnavailableResponse({
    description: 'AI_UNAVAILABLE: AI analysis is switched off',
  })
  request(
    @Param('id', uuid()) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Ctx() ctx: RequestContext,
  ): Promise<AiJobView> {
    return this.ai.request(id, user, ctx);
  }

  @Get(':id/ai-jobs')
  @RequirePermissions('ai:read')
  @ApiOkResponse({ type: [AiJobView], description: 'Newest first, no reports' })
  list(
    @Param('id', uuid()) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AiJobView[]> {
    return this.ai.list(id, user);
  }
}

@ApiTags('ai')
@ApiBearerAuth()
@Controller('ai-jobs')
export class AiJobsController {
  constructor(private readonly ai: AiService) {}

  @Get(':id')
  @RequirePermissions('ai:read')
  @ApiOkResponse({
    type: AiJobView,
    description: 'Includes the report once the job has succeeded',
  })
  get(
    @Param('id', uuid()) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Ctx() ctx: RequestContext,
  ): Promise<AiJobView> {
    return this.ai.get(id, user, ctx);
  }
}

@ApiTags('ai')
@ApiBearerAuth()
@Controller('ai')
export class AiModelsController {
  constructor(private readonly ai: AiService) {}

  @Get('models')
  @RequirePermissions('ai:models:read')
  @ApiOkResponse({
    type: [AiModelView],
    description: 'The model registry; MOCK models are development placeholders',
  })
  models(): Promise<AiModelView[]> {
    return this.ai.models();
  }
}
