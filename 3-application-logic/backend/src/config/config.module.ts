import { Global, Module } from '@nestjs/common';
import { APP_CONFIG, loadConfig } from './app-config';

/** Validated configuration, available everywhere via `@Inject(APP_CONFIG)`. */
@Global()
@Module({
  providers: [
    { provide: APP_CONFIG, useFactory: () => loadConfig(process.env) },
  ],
  exports: [APP_CONFIG],
})
export class AppConfigModule {}
