import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { pipeline } from 'node:stream/promises';
import {
  Ctx,
  CurrentUser,
  RequirePermissions,
  type AuthenticatedUser,
  type RequestContext,
} from '../../gateway/access/access.decorators';
import {
  ImagingStudyView,
  ImagingUploadForm,
  ReviewSpecimenDto,
  SlideUploadForm,
  SpecimenView,
} from './imaging.dto';
import { ImagingService, type FileContent } from './imaging.service';

const uuid = () => new ParseUUIDPipe();

/** Streams a stored file as a download; never rendered inline by a browser. */
async function sendFile(res: Response, content: FileContent): Promise<void> {
  res.setHeader('Content-Type', content.mimeType);
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${content.fileName}"`,
  );
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  await pipeline(content.body, res);
}

/** Uploads and lists nested under a patient. */
@ApiTags('imaging')
@ApiBearerAuth()
@Controller('patients')
export class PatientFilesController {
  constructor(private readonly imaging: ImagingService) {}

  @Post(':id/imaging')
  @RequirePermissions('imaging:upload')
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: ImagingUploadForm })
  @ApiCreatedResponse({ type: ImagingStudyView })
  @ApiOkResponse({
    type: ImagingStudyView,
    description: 'Same clientUuid already uploaded (idempotent retry)',
  })
  async uploadImaging(
    @Param('id', uuid()) id: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @CurrentUser() user: AuthenticatedUser,
    @Ctx() ctx: RequestContext,
  ): Promise<ImagingStudyView> {
    const { study, created } = await this.imaging.uploadImaging(
      id,
      req,
      user,
      ctx,
    );
    res.status(created ? HttpStatus.CREATED : HttpStatus.OK);
    return study;
  }

  @Get(':id/imaging')
  @RequirePermissions('imaging:read')
  @ApiOkResponse({ type: [ImagingStudyView] })
  listImaging(
    @Param('id', uuid()) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Ctx() ctx: RequestContext,
  ): Promise<ImagingStudyView[]> {
    return this.imaging.listImaging(id, user, ctx);
  }

  @Post(':id/histopathology')
  @RequirePermissions('histopathology:submit')
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: SlideUploadForm })
  @ApiCreatedResponse({ type: SpecimenView })
  @ApiOkResponse({
    type: SpecimenView,
    description: 'Same clientUuid already uploaded (idempotent retry)',
  })
  async uploadSlide(
    @Param('id', uuid()) id: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @CurrentUser() user: AuthenticatedUser,
    @Ctx() ctx: RequestContext,
  ): Promise<SpecimenView> {
    const { specimen, created } = await this.imaging.uploadSlide(
      id,
      req,
      user,
      ctx,
    );
    res.status(created ? HttpStatus.CREATED : HttpStatus.OK);
    return specimen;
  }

  @Get(':id/histopathology')
  @RequirePermissions('histopathology:read')
  @ApiOkResponse({ type: [SpecimenView] })
  listSlides(
    @Param('id', uuid()) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Ctx() ctx: RequestContext,
  ): Promise<SpecimenView[]> {
    return this.imaging.listSlides(id, user, ctx);
  }
}

@ApiTags('imaging')
@ApiBearerAuth()
@Controller('imaging')
export class ImagingController {
  constructor(private readonly imaging: ImagingService) {}

  @Get(':id')
  @RequirePermissions('imaging:read')
  @ApiOkResponse({ type: ImagingStudyView })
  get(
    @Param('id', uuid()) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ImagingStudyView> {
    return this.imaging.getImaging(id, user);
  }

  @Get(':id/content')
  @RequirePermissions('imaging:read')
  @ApiProduces('application/dicom', 'image/jpeg', 'image/png')
  @ApiOkResponse({ description: 'The stored file, as a download' })
  async content(
    @Param('id', uuid()) id: string,
    @Res() res: Response,
    @CurrentUser() user: AuthenticatedUser,
    @Ctx() ctx: RequestContext,
  ): Promise<void> {
    await sendFile(res, await this.imaging.imagingContent(id, user, ctx));
  }
}

@ApiTags('imaging')
@ApiBearerAuth()
@Controller('histopathology')
export class HistopathologyController {
  constructor(private readonly imaging: ImagingService) {}

  // Declared before ':id' so that "review-queue" is not read as an id.
  @Get('review-queue')
  @RequirePermissions('histopathology:review')
  @ApiOkResponse({
    type: [SpecimenView],
    description: 'Unreviewed slides in your facility, oldest first',
  })
  queue(@CurrentUser() user: AuthenticatedUser): Promise<SpecimenView[]> {
    return this.imaging.reviewQueue(user);
  }

  @Get(':id')
  @RequirePermissions('histopathology:read')
  @ApiOkResponse({ type: SpecimenView })
  get(
    @Param('id', uuid()) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SpecimenView> {
    return this.imaging.getSlide(id, user);
  }

  @Get(':id/content')
  @RequirePermissions('histopathology:read')
  @ApiProduces('image/tiff')
  @ApiOkResponse({ description: 'The stored slide, as a download' })
  async content(
    @Param('id', uuid()) id: string,
    @Res() res: Response,
    @CurrentUser() user: AuthenticatedUser,
    @Ctx() ctx: RequestContext,
  ): Promise<void> {
    await sendFile(res, await this.imaging.slideContent(id, user, ctx));
  }

  @Post(':id/review')
  @RequirePermissions('histopathology:review')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    type: SpecimenView,
    description: 'Gleason patterns saved; the ISUP grade group is computed',
  })
  review(
    @Param('id', uuid()) id: string,
    @Body() dto: ReviewSpecimenDto,
    @CurrentUser() user: AuthenticatedUser,
    @Ctx() ctx: RequestContext,
  ): Promise<SpecimenView> {
    return this.imaging.review(id, dto, user, ctx);
  }
}
