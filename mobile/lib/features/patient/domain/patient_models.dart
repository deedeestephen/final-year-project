/// Data a patient sees about themselves. Parsed from the API views.
library;

class PatientProfile {
  const PatientProfile({
    required this.givenName,
    required this.familyName,
    required this.mrn,
    required this.dateOfBirth,
    required this.regionClass,
    this.district,
    this.phone,
    this.nationalIdMasked,
  });

  factory PatientProfile.fromJson(Map<String, dynamic> j) => PatientProfile(
    givenName: j['givenName'] as String,
    familyName: j['familyName'] as String,
    mrn: j['mrn'] as String,
    dateOfBirth: j['dateOfBirth'] as String,
    regionClass: j['regionClass'] as String,
    district: j['district'] as String?,
    phone: j['phone'] as String?,
    nationalIdMasked: j['nationalIdMasked'] as String?,
  );

  final String givenName;
  final String familyName;
  final String mrn;
  final String dateOfBirth;
  final String regionClass;
  final String? district;
  final String? phone;
  final String? nationalIdMasked;
}

class ScreeningRecord {
  const ScreeningRecord({
    required this.id,
    required this.encounterDate,
    required this.dreFinding,
    this.psaNgMl,
    this.freePsaNgMl,
    this.piradsScore,
    this.prostateVolumeMl,
  });

  factory ScreeningRecord.fromJson(Map<String, dynamic> j) => ScreeningRecord(
    id: j['id'] as String,
    encounterDate: j['encounterDate'] as String,
    dreFinding: j['dreFinding'] as String,
    psaNgMl: (j['psaNgMl'] as num?)?.toDouble(),
    freePsaNgMl: (j['freePsaNgMl'] as num?)?.toDouble(),
    piradsScore: j['piradsScore'] as int?,
    prostateVolumeMl: (j['prostateVolumeMl'] as num?)?.toDouble(),
  );

  final String id;
  final String encounterDate;
  final String dreFinding;
  final double? psaNgMl;
  final double? freePsaNgMl;
  final int? piradsScore;
  final double? prostateVolumeMl;
}

class ConsentItem {
  const ConsentItem({
    required this.id,
    required this.type,
    required this.status,
    required this.grantedAt,
    this.withdrawnAt,
  });

  factory ConsentItem.fromJson(Map<String, dynamic> j) => ConsentItem(
    id: j['id'] as String,
    type: j['type'] as String,
    status: j['status'] as String,
    grantedAt: DateTime.parse(j['grantedAt'] as String),
    withdrawnAt: j['withdrawnAt'] == null
        ? null
        : DateTime.parse(j['withdrawnAt'] as String),
  );

  final String id;
  final String type;
  final String status; // GRANTED | WITHDRAWN
  final DateTime grantedAt;
  final DateTime? withdrawnAt;

  bool get isActive => status == 'GRANTED';
}

class NotificationItem {
  const NotificationItem({
    required this.id,
    required this.title,
    required this.body,
    required this.createdAt,
    this.readAt,
  });

  factory NotificationItem.fromJson(Map<String, dynamic> j) => NotificationItem(
    id: j['id'] as String,
    title: j['title'] as String,
    body: j['body'] as String,
    createdAt: DateTime.parse(j['createdAt'] as String),
    readAt: j['readAt'] == null ? null : DateTime.parse(j['readAt'] as String),
  );

  final String id;
  final String title;
  final String body;
  final DateTime createdAt;
  final DateTime? readAt;

  bool get isUnread => readAt == null;
}

class Inbox {
  const Inbox({required this.items, required this.unreadCount});

  factory Inbox.fromJson(Map<String, dynamic> j) => Inbox(
    items: [
      for (final n in (j['items'] as List).cast<Map<String, dynamic>>())
        NotificationItem.fromJson(n),
    ],
    unreadCount: j['unreadCount'] as int,
  );

  final List<NotificationItem> items;
  final int unreadCount;
}

/// A value from the server, or the last saved copy when offline.
class Cached<T> {
  const Cached(this.value, {required this.fetchedAt, this.offline = false});

  final T value;
  final DateTime fetchedAt;

  /// True when the server could not be reached and this is the saved copy.
  final bool offline;
}
