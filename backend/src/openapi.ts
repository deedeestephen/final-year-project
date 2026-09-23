import type { INestApplication } from '@nestjs/common';
import {
  DocumentBuilder,
  SwaggerModule,
  type OpenAPIObject,
} from '@nestjs/swagger';

export const OPENAPI_PATH = 'api/docs';

/** OpenAPI 3.0 description of the public REST API (proposal §3.3: OpenAPI 3.0 endpoints). */
export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('PCa mHealth API')
    .setDescription(
      'REST API of the AI-driven prostate cancer mHealth research prototype (ZCAS University). ' +
        'Research prototype: no AI output is a clinical diagnosis. Errors use the envelope ' +
        '{ "error": { status, code, message, details?, requestId } }.',
    )
    .setVersion('0.1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
    .build();
  return SwaggerModule.createDocument(app, config);
}

export function setupOpenApi(app: INestApplication): void {
  SwaggerModule.setup(OPENAPI_PATH, app, () => buildOpenApiDocument(app), {
    jsonDocumentUrl: `${OPENAPI_PATH}/openapi.json`,
  });
}
