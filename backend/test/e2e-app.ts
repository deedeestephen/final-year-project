import { Body, Controller, Get, Post, type Type } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { IsNumber, IsString, Length, Min } from 'class-validator';
import { AppModule } from '../src/app.module';
import { loadConfig } from '../src/config/app-config';
import { configureApp } from '../src/configure-app';
import { MongoService } from '../src/infrastructure/database/mongo.service';
import { PrismaService } from '../src/infrastructure/database/prisma.service';

export class EchoDto {
  @IsString()
  @Length(1, 50)
  name!: string;

  @IsNumber()
  @Min(0)
  psaNgMl!: number;
}

/** Routes that exist only in tests, to exercise gateway behaviour. */
@Controller('test')
export class GatewayTestController {
  @Post('echo')
  echo(@Body() body: EchoDto): EchoDto {
    return body;
  }

  @Get('ping')
  ping(): { pong: true } {
    return { pong: true };
  }

  @Get('boom')
  boom(): never {
    throw new Error('connection to postgres://pca:secret-password@db failed');
  }

  @Get('duplicate')
  duplicate(): never {
    throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: 'test',
      meta: { target: ['email'] },
    });
  }
}

export interface FakeDependencies {
  postgresUp?: boolean;
  mongoUp?: boolean;
}

const pinger = (up: boolean) => ({
  ping: () => (up ? Promise.resolve() : Promise.reject(new Error('down'))),
  onModuleDestroy: () => Promise.resolve(),
});

export async function createTestApp(
  deps: FakeDependencies = {},
  extraControllers: Type[] = [GatewayTestController],
): Promise<NestExpressApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
    controllers: extraControllers,
  })
    .overrideProvider(PrismaService)
    .useValue(pinger(deps.postgresUp ?? true))
    .overrideProvider(MongoService)
    .useValue(pinger(deps.mongoUp ?? true))
    .compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>({
    bodyParser: false,
    logger: false,
  });
  configureApp(app, loadConfig(process.env));
  await app.init();
  return app;
}
