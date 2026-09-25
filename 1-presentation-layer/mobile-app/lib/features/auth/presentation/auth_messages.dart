import '../../../core/network/api_exception.dart';

/// Plain-language messages for authentication errors. Sign-in failures never
/// say whether the email exists (the API does not reveal it either).
String authErrorMessage(ApiException e) => switch (e.code) {
  'INVALID_CREDENTIALS' => 'Email or password is incorrect.',
  'ACCOUNT_LOCKED' =>
    'This account is temporarily locked after too many attempts. '
        'Try again later or contact your administrator.',
  'RATE_LIMITED' => 'Too many attempts. Wait a minute, then try again.',
  'INVALID_CURRENT_PASSWORD' => 'Your current password is incorrect.',
  ApiException.networkUnavailable =>
    'Cannot reach the server. Check your connection and try again.',
  'VALIDATION_FAILED' => 'Please check the highlighted fields.',
  _ => 'Something went wrong. Please try again.',
};

/// Client-side email check: a quick hint only; the server validates again.
String? validateEmail(String? value) {
  final v = value?.trim() ?? '';
  if (v.isEmpty) return 'Enter your email address.';
  if (!RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(v)) {
    return 'Enter a valid email address.';
  }
  return null;
}

/// Mirrors the server's length rule so users see it before submitting.
const passwordMinLength = 12;
const passwordMaxLength = 128;
