import { ApiError } from '../api/client';

export const NOT_OFFICIAL =
  'Research prototype. Not a medical device. Not an official Government of the Republic of Zambia service.';

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.isNetwork) return 'Cannot reach the server. Check your connection.';
    if (e.code === 'RATE_LIMITED') {
      return `Too many requests. Please wait ${e.retryAfter ?? 60} seconds and try again.`;
    }
    return e.message;
  }
  return 'Something went wrong. Please try again.';
}
