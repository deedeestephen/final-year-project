import {
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
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiOkResponse,
  ApiProduces,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  Ctx,
  CurrentUser,
  RequirePermissions,
  type AuthenticatedUser,
  type RequestContext,
} from '../../gateway/access/access.decorators';
import type { Response } from 'express';
import { pipeline } from 'node:stream/promises';
import {
  AiJobView,
  AiModelView,
  EvaluationView,
  ExplanationView,
} from './ai.dto';
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

  @Get(':id/explanations')
  @RequirePermissions('ai:read')
  @ApiOkResponse({
    type: [ExplanationView],
    description:
      'One per module that ran: an image, SHAP values, or the reason there is none',
  })
  explanations(
    @Param('id', uuid()) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ExplanationView[]> {
    return this.ai.explanations(id, user);
  }
}

@ApiTags('ai')
@ApiBearerAuth()
@Controller('explanations')
export class ExplanationsController {
  constructor(private readonly ai: AiService) {}

  @Get(':id/content')
  @RequirePermissions('ai:read')
  @ApiProduces('image/png')
  @ApiOkResponse({ description: 'The explanation image (e.g. Grad-CAM)' })
  async content(
    @Param('id', uuid()) id: string,
    @Res() res: Response,
    @CurrentUser() user: AuthenticatedUser,
    @Ctx() ctx: RequestContext,
  ): Promise<void> {
    const { body, fileName } = await this.ai.explanationContent(id, user, ctx);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    await pipeline(body, res);
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

  @Get('models/:id/evaluation')
  @RequirePermissions('ai:models:read')
  @ApiOkResponse({
    type: EvaluationView,
    description:
      'Stored evaluation and fairness figures, or "Evaluation data not yet available."',
  })
  evaluation(@Param('id', uuid()) id: string): Promise<EvaluationView> {
    return this.ai.evaluation(id);
  }
}
