import { Global, Module } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../../config/app-config';
import { FieldCrypto } from './field-crypto';

/** Column encryption for patient identifiers, keyed from validated configuration. */
@Global()
@Module({
  providers: [
    {
      provide: FieldCrypto,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) =>
        new FieldCrypto(config.fieldEncryptionKey, config.fieldHmacKey),
    },
  ],
  exports: [FieldCrypto],
})
export class CryptoModule {}
