import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { APP_CONFIG, type AppConfig } from './config/app-config';
import { configureApp } from './gateway/configure-app';
import { setupOpenApi } from './gateway/openapi';
import { loadRootEnv } from './config/repo-root';

async function bootstrap() {
  // Local development reads the repository-root .env; deployments inject variables.
  loadRootEnv();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    bodyParser: false, // re-enabled with explicit size limits in configureApp
  });
  app.useLogger(app.get(Logger));
  const config = app.get<AppConfig>(APP_CONFIG);
  configureApp(app, config);
  if (config.apiDocsEnabled) setupOpenApi(app);
  await app.listen(config.port);
}
void bootstrap();
