import { registerDecorator, type ValidationOptions } from 'class-validator';

// C0 control characters except tab, newline and carriage return, plus DEL.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
// Anything that looks like an HTML/XML tag or a script URL.
const MARKUP = /<\s*\/?\s*[a-z!?][^>]*>|javascript\s*:/i;

/** True when free text is safe to store and later display as plain text. */
export function isSafeText(value: unknown): boolean {
  return (
    typeof value === 'string' &&
    !CONTROL_CHARS.test(value) &&
    !MARKUP.test(value)
  );
}

/**
 * Input sanitisation for free-text fields (clinical notes, names, chatbot
 * questions): rejects control characters and markup instead of silently
 * rewriting clinical data. Output is always JSON and rendered as plain text
 * by the app, so this is defence in depth against stored XSS in any future
 * web or admin view.
 */
export function IsSafeText(options?: ValidationOptions): PropertyDecorator {
  return (object, propertyName) => {
    registerDecorator({
      name: 'isSafeText',
      target: object.constructor,
      propertyName: propertyName as string,
      options: {
        message:
          '$property must be plain text without markup or control characters',
        ...options,
      },
      validator: { validate: isSafeText },
    });
  };
}
