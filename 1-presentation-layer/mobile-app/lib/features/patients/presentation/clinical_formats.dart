import '../../../core/db/app_database.dart';
import '../../../shared/widgets/sync_status_badge.dart';

/// Labels and client-side checks that mirror the API rules, so users see
/// problems before saving. The server validates everything again.

const regionLabels = {
  'URBAN': 'Urban',
  'PERI_URBAN': 'Peri-urban',
  'RURAL': 'Rural',
};

const dreLabels = {
  'NORMAL': 'Normal',
  'ENLARGED_SMOOTH': 'Enlarged, smooth',
  'NODULAR': 'Nodular',
  'INDURATED': 'Hard (indurated)',
  'NOT_PERFORMED': 'Not performed',
};

SyncStatus rowSyncStatus(String state) => switch (state) {
  RowSync.synced => const Synced(),
  RowSync.pending => const SavedOffline(),
  _ => const NeedsAttention(),
};

final _markup = RegExp(
  r'<\s*/?\s*[a-z!?][^>]*>|javascript\s*:',
  caseSensitive: false,
);
final _control = RegExp(r'[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]');

String? validateName(String? v, String label) {
  final t = v?.trim() ?? '';
  if (t.isEmpty) return 'Enter the $label.';
  if (t.length > 80) return 'Use at most 80 characters.';
  return _unsafe(t);
}

String? validateOptionalText(String? v, {int max = 80}) {
  final t = v?.trim() ?? '';
  if (t.isEmpty) return null;
  if (t.length > max) return 'Use at most $max characters.';
  return _unsafe(t);
}

String? _unsafe(String t) => _markup.hasMatch(t) || _control.hasMatch(t)
    ? 'Remove special characters such as < and >.'
    : null;

String? validatePhone(String? v) {
  final t = v?.trim() ?? '';
  if (t.isEmpty) return null;
  return RegExp(r'^\+?[0-9 ]{7,20}$').hasMatch(t)
      ? null
      : 'Enter a phone number, e.g. +260971234567.';
}

String? validateRequiredPhone(String? v) {
  if ((v?.trim() ?? '').isEmpty) return 'Enter your phone number.';
  return validatePhone(v);
}

/// NRC as printed on the card: 123456/78/1 (spaces are ignored).
String? validateNrc(String? v) {
  final t = (v ?? '').replaceAll(RegExp(r'\s+'), '');
  if (t.isEmpty) return 'Enter your NRC number.';
  return RegExp(r'^\d{6}/\d{2}/\d$').hasMatch(t)
      ? null
      : 'Enter the NRC number like 123456/78/1.';
}

String? validatePassport(String? v) {
  final t = (v ?? '').replaceAll(RegExp(r'\s+'), '').toUpperCase();
  if (t.isEmpty) return 'Enter your passport number.';
  return RegExp(r'^[A-Z0-9]{6,12}$').hasMatch(t)
      ? null
      : 'A passport number has 6 to 12 letters or digits.';
}

String? validateNationalId(String? v) {
  final t = v?.trim() ?? '';
  if (t.isEmpty) return null;
  return RegExp(r'^[0-9A-Za-z/ -]{4,30}$').hasMatch(t)
      ? null
      : 'Enter the NRC number, e.g. 123456/78/1.';
}

/// A real calendar date between 1900-01-01 and [today], as YYYY-MM-DD.
String? validatePastDate(String? v, {required DateTime today}) {
  final t = v?.trim() ?? '';
  final match = RegExp(r'^(\d{4})-(\d{2})-(\d{2})$').firstMatch(t);
  if (match == null) return 'Use the format YYYY-MM-DD.';
  final y = int.parse(match[1]!),
      m = int.parse(match[2]!),
      d = int.parse(match[3]!);
  final date = DateTime(y, m, d);
  if (date.year != y || date.month != m || date.day != d) {
    return 'This date does not exist.';
  }
  final end = DateTime(today.year, today.month, today.day);
  if (y < 1900 || date.isAfter(end)) {
    return 'The date must be between 1900 and today.';
  }
  return null;
}

String formatDate(DateTime d) =>
    '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

/// Parses an optional decimal with at most [decimals] places in [min]..[max].
({double? value, String? error}) parseMeasurement(
  String? v, {
  required double min,
  required double max,
  required int decimals,
}) {
  final t = v?.trim() ?? '';
  if (t.isEmpty) return (value: null, error: null);
  final ok = RegExp('^\\d+(\\.\\d{1,$decimals})?\$').hasMatch(t);
  final value = double.tryParse(t);
  if (!ok || value == null) {
    return (
      value: null,
      error: 'Enter a number with up to $decimals decimals.',
    );
  }
  if (value < min || value > max) {
    return (value: null, error: 'Enter a value from ${_n(min)} to ${_n(max)}.');
  }
  return (value: value, error: null);
}

String _n(double v) => v == v.roundToDouble() ? v.toInt().toString() : '$v';

int ageInYears(String dateOfBirth, DateTime today) {
  final dob = DateTime.parse(dateOfBirth);
  var age = today.year - dob.year;
  if (today.month < dob.month ||
      (today.month == dob.month && today.day < dob.day)) {
    age--;
  }
  return age;
}

String formatMeasurement(double? v, String unit) =>
    v == null ? '—' : '${_n(double.parse(v.toStringAsFixed(3)))} $unit';
