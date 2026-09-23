import {
  BadRequestException,
  ValidationPipe,
  type ValidationError,
} from '@nestjs/common';

export interface FieldError {
  field: string;
  errors: string[];
}

/** Flattens nested class-validator errors into `[{ field: 'a.b', errors: [...] }]`. */
export function flattenValidationErrors(
  errors: ValidationError[],
  parent = '',
): FieldError[] {
  return errors.flatMap((e) => {
    const field = parent ? `${parent}.${e.property}` : e.property;
    const own = e.constraints
      ? [{ field, errors: Object.values(e.constraints) }]
      : [];
    return [...own, ...flattenValidationErrors(e.children ?? [], field)];
  });
}

/**
 * Global input validation: unknown properties are rejected (not silently
 * dropped), payloads are transformed into DTO instances, and failures use
 * the standard error envelope with code VALIDATION_FAILED.
 */
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    stopAtFirstError: false,
    validationError: { target: false, value: false },
    exceptionFactory: (errors) =>
      new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Request validation failed',
        details: flattenValidationErrors(errors),
      }),
  });
}
