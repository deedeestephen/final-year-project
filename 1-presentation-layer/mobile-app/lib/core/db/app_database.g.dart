// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'app_database.dart';

// ignore_for_file: type=lint
class $LocalPatientsTable extends LocalPatients
    with TableInfo<$LocalPatientsTable, LocalPatient> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $LocalPatientsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
    'id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _serverIdMeta = const VerificationMeta(
    'serverId',
  );
  @override
  late final GeneratedColumn<String> serverId = GeneratedColumn<String>(
    'server_id',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways('UNIQUE'),
  );
  static const VerificationMeta _mrnMeta = const VerificationMeta('mrn');
  @override
  late final GeneratedColumn<String> mrn = GeneratedColumn<String>(
    'mrn',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _givenNameMeta = const VerificationMeta(
    'givenName',
  );
  @override
  late final GeneratedColumn<String> givenName = GeneratedColumn<String>(
    'given_name',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _familyNameMeta = const VerificationMeta(
    'familyName',
  );
  @override
  late final GeneratedColumn<String> familyName = GeneratedColumn<String>(
    'family_name',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _dateOfBirthMeta = const VerificationMeta(
    'dateOfBirth',
  );
  @override
  late final GeneratedColumn<String> dateOfBirth = GeneratedColumn<String>(
    'date_of_birth',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _regionClassMeta = const VerificationMeta(
    'regionClass',
  );
  @override
  late final GeneratedColumn<String> regionClass = GeneratedColumn<String>(
    'region_class',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _districtMeta = const VerificationMeta(
    'district',
  );
  @override
  late final GeneratedColumn<String> district = GeneratedColumn<String>(
    'district',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _phoneMeta = const VerificationMeta('phone');
  @override
  late final GeneratedColumn<String> phone = GeneratedColumn<String>(
    'phone',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _nationalIdMaskedMeta = const VerificationMeta(
    'nationalIdMasked',
  );
  @override
  late final GeneratedColumn<String> nationalIdMasked = GeneratedColumn<String>(
    'national_id_masked',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _versionMeta = const VerificationMeta(
    'version',
  );
  @override
  late final GeneratedColumn<int> version = GeneratedColumn<int>(
    'version',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(0),
  );
  static const VerificationMeta _syncStateMeta = const VerificationMeta(
    'syncState',
  );
  @override
  late final GeneratedColumn<String> syncState = GeneratedColumn<String>(
    'sync_state',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _updatedAtMeta = const VerificationMeta(
    'updatedAt',
  );
  @override
  late final GeneratedColumn<DateTime> updatedAt = GeneratedColumn<DateTime>(
    'updated_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [
    id,
    serverId,
    mrn,
    givenName,
    familyName,
    dateOfBirth,
    regionClass,
    district,
    phone,
    nationalIdMasked,
    version,
    syncState,
    updatedAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'local_patients';
  @override
  VerificationContext validateIntegrity(
    Insertable<LocalPatient> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('server_id')) {
      context.handle(
        _serverIdMeta,
        serverId.isAcceptableOrUnknown(data['server_id']!, _serverIdMeta),
      );
    }
    if (data.containsKey('mrn')) {
      context.handle(
        _mrnMeta,
        mrn.isAcceptableOrUnknown(data['mrn']!, _mrnMeta),
      );
    }
    if (data.containsKey('given_name')) {
      context.handle(
        _givenNameMeta,
        givenName.isAcceptableOrUnknown(data['given_name']!, _givenNameMeta),
      );
    } else if (isInserting) {
      context.missing(_givenNameMeta);
    }
    if (data.containsKey('family_name')) {
      context.handle(
        _familyNameMeta,
        familyName.isAcceptableOrUnknown(data['family_name']!, _familyNameMeta),
      );
    } else if (isInserting) {
      context.missing(_familyNameMeta);
    }
    if (data.containsKey('date_of_birth')) {
      context.handle(
        _dateOfBirthMeta,
        dateOfBirth.isAcceptableOrUnknown(
          data['date_of_birth']!,
          _dateOfBirthMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_dateOfBirthMeta);
    }
    if (data.containsKey('region_class')) {
      context.handle(
        _regionClassMeta,
        regionClass.isAcceptableOrUnknown(
          data['region_class']!,
          _regionClassMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_regionClassMeta);
    }
    if (data.containsKey('district')) {
      context.handle(
        _districtMeta,
        district.isAcceptableOrUnknown(data['district']!, _districtMeta),
      );
    }
    if (data.containsKey('phone')) {
      context.handle(
        _phoneMeta,
        phone.isAcceptableOrUnknown(data['phone']!, _phoneMeta),
      );
    }
    if (data.containsKey('national_id_masked')) {
      context.handle(
        _nationalIdMaskedMeta,
        nationalIdMasked.isAcceptableOrUnknown(
          data['national_id_masked']!,
          _nationalIdMaskedMeta,
        ),
      );
    }
    if (data.containsKey('version')) {
      context.handle(
        _versionMeta,
        version.isAcceptableOrUnknown(data['version']!, _versionMeta),
      );
    }
    if (data.containsKey('sync_state')) {
      context.handle(
        _syncStateMeta,
        syncState.isAcceptableOrUnknown(data['sync_state']!, _syncStateMeta),
      );
    } else if (isInserting) {
      context.missing(_syncStateMeta);
    }
    if (data.containsKey('updated_at')) {
      context.handle(
        _updatedAtMeta,
        updatedAt.isAcceptableOrUnknown(data['updated_at']!, _updatedAtMeta),
      );
    } else if (isInserting) {
      context.missing(_updatedAtMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  LocalPatient map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return LocalPatient(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}id'],
      )!,
      serverId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}server_id'],
      ),
      mrn: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}mrn'],
      ),
      givenName: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}given_name'],
      )!,
      familyName: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}family_name'],
      )!,
      dateOfBirth: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}date_of_birth'],
      )!,
      regionClass: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}region_class'],
      )!,
      district: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}district'],
      ),
      phone: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}phone'],
      ),
      nationalIdMasked: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}national_id_masked'],
      ),
      version: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}version'],
      )!,
      syncState: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}sync_state'],
      )!,
      updatedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}updated_at'],
      )!,
    );
  }

  @override
  $LocalPatientsTable createAlias(String alias) {
    return $LocalPatientsTable(attachedDatabase, alias);
  }
}

class LocalPatient extends DataClass implements Insertable<LocalPatient> {
  final String id;
  final String? serverId;
  final String? mrn;
  final String givenName;
  final String familyName;
  final String dateOfBirth;
  final String regionClass;
  final String? district;
  final String? phone;
  final String? nationalIdMasked;

  /// Server version this row is based on; 0 until the server has it.
  final int version;
  final String syncState;
  final DateTime updatedAt;
  const LocalPatient({
    required this.id,
    this.serverId,
    this.mrn,
    required this.givenName,
    required this.familyName,
    required this.dateOfBirth,
    required this.regionClass,
    this.district,
    this.phone,
    this.nationalIdMasked,
    required this.version,
    required this.syncState,
    required this.updatedAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    if (!nullToAbsent || serverId != null) {
      map['server_id'] = Variable<String>(serverId);
    }
    if (!nullToAbsent || mrn != null) {
      map['mrn'] = Variable<String>(mrn);
    }
    map['given_name'] = Variable<String>(givenName);
    map['family_name'] = Variable<String>(familyName);
    map['date_of_birth'] = Variable<String>(dateOfBirth);
    map['region_class'] = Variable<String>(regionClass);
    if (!nullToAbsent || district != null) {
      map['district'] = Variable<String>(district);
    }
    if (!nullToAbsent || phone != null) {
      map['phone'] = Variable<String>(phone);
    }
    if (!nullToAbsent || nationalIdMasked != null) {
      map['national_id_masked'] = Variable<String>(nationalIdMasked);
    }
    map['version'] = Variable<int>(version);
    map['sync_state'] = Variable<String>(syncState);
    map['updated_at'] = Variable<DateTime>(updatedAt);
    return map;
  }

  LocalPatientsCompanion toCompanion(bool nullToAbsent) {
    return LocalPatientsCompanion(
      id: Value(id),
      serverId: serverId == null && nullToAbsent
          ? const Value.absent()
          : Value(serverId),
      mrn: mrn == null && nullToAbsent ? const Value.absent() : Value(mrn),
      givenName: Value(givenName),
      familyName: Value(familyName),
      dateOfBirth: Value(dateOfBirth),
      regionClass: Value(regionClass),
      district: district == null && nullToAbsent
          ? const Value.absent()
          : Value(district),
      phone: phone == null && nullToAbsent
          ? const Value.absent()
          : Value(phone),
      nationalIdMasked: nationalIdMasked == null && nullToAbsent
          ? const Value.absent()
          : Value(nationalIdMasked),
      version: Value(version),
      syncState: Value(syncState),
      updatedAt: Value(updatedAt),
    );
  }

  factory LocalPatient.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return LocalPatient(
      id: serializer.fromJson<String>(json['id']),
      serverId: serializer.fromJson<String?>(json['serverId']),
      mrn: serializer.fromJson<String?>(json['mrn']),
      givenName: serializer.fromJson<String>(json['givenName']),
      familyName: serializer.fromJson<String>(json['familyName']),
      dateOfBirth: serializer.fromJson<String>(json['dateOfBirth']),
      regionClass: serializer.fromJson<String>(json['regionClass']),
      district: serializer.fromJson<String?>(json['district']),
      phone: serializer.fromJson<String?>(json['phone']),
      nationalIdMasked: serializer.fromJson<String?>(json['nationalIdMasked']),
      version: serializer.fromJson<int>(json['version']),
      syncState: serializer.fromJson<String>(json['syncState']),
      updatedAt: serializer.fromJson<DateTime>(json['updatedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'serverId': serializer.toJson<String?>(serverId),
      'mrn': serializer.toJson<String?>(mrn),
      'givenName': serializer.toJson<String>(givenName),
      'familyName': serializer.toJson<String>(familyName),
      'dateOfBirth': serializer.toJson<String>(dateOfBirth),
      'regionClass': serializer.toJson<String>(regionClass),
      'district': serializer.toJson<String?>(district),
      'phone': serializer.toJson<String?>(phone),
      'nationalIdMasked': serializer.toJson<String?>(nationalIdMasked),
      'version': serializer.toJson<int>(version),
      'syncState': serializer.toJson<String>(syncState),
      'updatedAt': serializer.toJson<DateTime>(updatedAt),
    };
  }

  LocalPatient copyWith({
    String? id,
    Value<String?> serverId = const Value.absent(),
    Value<String?> mrn = const Value.absent(),
    String? givenName,
    String? familyName,
    String? dateOfBirth,
    String? regionClass,
    Value<String?> district = const Value.absent(),
    Value<String?> phone = const Value.absent(),
    Value<String?> nationalIdMasked = const Value.absent(),
    int? version,
    String? syncState,
    DateTime? updatedAt,
  }) => LocalPatient(
    id: id ?? this.id,
    serverId: serverId.present ? serverId.value : this.serverId,
    mrn: mrn.present ? mrn.value : this.mrn,
    givenName: givenName ?? this.givenName,
    familyName: familyName ?? this.familyName,
    dateOfBirth: dateOfBirth ?? this.dateOfBirth,
    regionClass: regionClass ?? this.regionClass,
    district: district.present ? district.value : this.district,
    phone: phone.present ? phone.value : this.phone,
    nationalIdMasked: nationalIdMasked.present
        ? nationalIdMasked.value
        : this.nationalIdMasked,
    version: version ?? this.version,
    syncState: syncState ?? this.syncState,
    updatedAt: updatedAt ?? this.updatedAt,
  );
  LocalPatient copyWithCompanion(LocalPatientsCompanion data) {
    return LocalPatient(
      id: data.id.present ? data.id.value : this.id,
      serverId: data.serverId.present ? data.serverId.value : this.serverId,
      mrn: data.mrn.present ? data.mrn.value : this.mrn,
      givenName: data.givenName.present ? data.givenName.value : this.givenName,
      familyName: data.familyName.present
          ? data.familyName.value
          : this.familyName,
      dateOfBirth: data.dateOfBirth.present
          ? data.dateOfBirth.value
          : this.dateOfBirth,
      regionClass: data.regionClass.present
          ? data.regionClass.value
          : this.regionClass,
      district: data.district.present ? data.district.value : this.district,
      phone: data.phone.present ? data.phone.value : this.phone,
      nationalIdMasked: data.nationalIdMasked.present
          ? data.nationalIdMasked.value
          : this.nationalIdMasked,
      version: data.version.present ? data.version.value : this.version,
      syncState: data.syncState.present ? data.syncState.value : this.syncState,
      updatedAt: data.updatedAt.present ? data.updatedAt.value : this.updatedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('LocalPatient(')
          ..write('id: $id, ')
          ..write('serverId: $serverId, ')
          ..write('mrn: $mrn, ')
          ..write('givenName: $givenName, ')
          ..write('familyName: $familyName, ')
          ..write('dateOfBirth: $dateOfBirth, ')
          ..write('regionClass: $regionClass, ')
          ..write('district: $district, ')
          ..write('phone: $phone, ')
          ..write('nationalIdMasked: $nationalIdMasked, ')
          ..write('version: $version, ')
          ..write('syncState: $syncState, ')
          ..write('updatedAt: $updatedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    id,
    serverId,
    mrn,
    givenName,
    familyName,
    dateOfBirth,
    regionClass,
    district,
    phone,
    nationalIdMasked,
    version,
    syncState,
    updatedAt,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is LocalPatient &&
          other.id == this.id &&
          other.serverId == this.serverId &&
          other.mrn == this.mrn &&
          other.givenName == this.givenName &&
          other.familyName == this.familyName &&
          other.dateOfBirth == this.dateOfBirth &&
          other.regionClass == this.regionClass &&
          other.district == this.district &&
          other.phone == this.phone &&
          other.nationalIdMasked == this.nationalIdMasked &&
          other.version == this.version &&
          other.syncState == this.syncState &&
          other.updatedAt == this.updatedAt);
}

class LocalPatientsCompanion extends UpdateCompanion<LocalPatient> {
  final Value<String> id;
  final Value<String?> serverId;
  final Value<String?> mrn;
  final Value<String> givenName;
  final Value<String> familyName;
  final Value<String> dateOfBirth;
  final Value<String> regionClass;
  final Value<String?> district;
  final Value<String?> phone;
  final Value<String?> nationalIdMasked;
  final Value<int> version;
  final Value<String> syncState;
  final Value<DateTime> updatedAt;
  final Value<int> rowid;
  const LocalPatientsCompanion({
    this.id = const Value.absent(),
    this.serverId = const Value.absent(),
    this.mrn = const Value.absent(),
    this.givenName = const Value.absent(),
    this.familyName = const Value.absent(),
    this.dateOfBirth = const Value.absent(),
    this.regionClass = const Value.absent(),
    this.district = const Value.absent(),
    this.phone = const Value.absent(),
    this.nationalIdMasked = const Value.absent(),
    this.version = const Value.absent(),
    this.syncState = const Value.absent(),
    this.updatedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  LocalPatientsCompanion.insert({
    required String id,
    this.serverId = const Value.absent(),
    this.mrn = const Value.absent(),
    required String givenName,
    required String familyName,
    required String dateOfBirth,
    required String regionClass,
    this.district = const Value.absent(),
    this.phone = const Value.absent(),
    this.nationalIdMasked = const Value.absent(),
    this.version = const Value.absent(),
    required String syncState,
    required DateTime updatedAt,
    this.rowid = const Value.absent(),
  }) : id = Value(id),
       givenName = Value(givenName),
       familyName = Value(familyName),
       dateOfBirth = Value(dateOfBirth),
       regionClass = Value(regionClass),
       syncState = Value(syncState),
       updatedAt = Value(updatedAt);
  static Insertable<LocalPatient> custom({
    Expression<String>? id,
    Expression<String>? serverId,
    Expression<String>? mrn,
    Expression<String>? givenName,
    Expression<String>? familyName,
    Expression<String>? dateOfBirth,
    Expression<String>? regionClass,
    Expression<String>? district,
    Expression<String>? phone,
    Expression<String>? nationalIdMasked,
    Expression<int>? version,
    Expression<String>? syncState,
    Expression<DateTime>? updatedAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (serverId != null) 'server_id': serverId,
      if (mrn != null) 'mrn': mrn,
      if (givenName != null) 'given_name': givenName,
      if (familyName != null) 'family_name': familyName,
      if (dateOfBirth != null) 'date_of_birth': dateOfBirth,
      if (regionClass != null) 'region_class': regionClass,
      if (district != null) 'district': district,
      if (phone != null) 'phone': phone,
      if (nationalIdMasked != null) 'national_id_masked': nationalIdMasked,
      if (version != null) 'version': version,
      if (syncState != null) 'sync_state': syncState,
      if (updatedAt != null) 'updated_at': updatedAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  LocalPatientsCompanion copyWith({
    Value<String>? id,
    Value<String?>? serverId,
    Value<String?>? mrn,
    Value<String>? givenName,
    Value<String>? familyName,
    Value<String>? dateOfBirth,
    Value<String>? regionClass,
    Value<String?>? district,
    Value<String?>? phone,
    Value<String?>? nationalIdMasked,
    Value<int>? version,
    Value<String>? syncState,
    Value<DateTime>? updatedAt,
    Value<int>? rowid,
  }) {
    return LocalPatientsCompanion(
      id: id ?? this.id,
      serverId: serverId ?? this.serverId,
      mrn: mrn ?? this.mrn,
      givenName: givenName ?? this.givenName,
      familyName: familyName ?? this.familyName,
      dateOfBirth: dateOfBirth ?? this.dateOfBirth,
      regionClass: regionClass ?? this.regionClass,
      district: district ?? this.district,
      phone: phone ?? this.phone,
      nationalIdMasked: nationalIdMasked ?? this.nationalIdMasked,
      version: version ?? this.version,
      syncState: syncState ?? this.syncState,
      updatedAt: updatedAt ?? this.updatedAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (serverId.present) {
      map['server_id'] = Variable<String>(serverId.value);
    }
    if (mrn.present) {
      map['mrn'] = Variable<String>(mrn.value);
    }
    if (givenName.present) {
      map['given_name'] = Variable<String>(givenName.value);
    }
    if (familyName.present) {
      map['family_name'] = Variable<String>(familyName.value);
    }
    if (dateOfBirth.present) {
      map['date_of_birth'] = Variable<String>(dateOfBirth.value);
    }
    if (regionClass.present) {
      map['region_class'] = Variable<String>(regionClass.value);
    }
    if (district.present) {
      map['district'] = Variable<String>(district.value);
    }
    if (phone.present) {
      map['phone'] = Variable<String>(phone.value);
    }
    if (nationalIdMasked.present) {
      map['national_id_masked'] = Variable<String>(nationalIdMasked.value);
    }
    if (version.present) {
      map['version'] = Variable<int>(version.value);
    }
    if (syncState.present) {
      map['sync_state'] = Variable<String>(syncState.value);
    }
    if (updatedAt.present) {
      map['updated_at'] = Variable<DateTime>(updatedAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('LocalPatientsCompanion(')
          ..write('id: $id, ')
          ..write('serverId: $serverId, ')
          ..write('mrn: $mrn, ')
          ..write('givenName: $givenName, ')
          ..write('familyName: $familyName, ')
          ..write('dateOfBirth: $dateOfBirth, ')
          ..write('regionClass: $regionClass, ')
          ..write('district: $district, ')
          ..write('phone: $phone, ')
          ..write('nationalIdMasked: $nationalIdMasked, ')
          ..write('version: $version, ')
          ..write('syncState: $syncState, ')
          ..write('updatedAt: $updatedAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $LocalClinicalRecordsTable extends LocalClinicalRecords
    with TableInfo<$LocalClinicalRecordsTable, LocalClinicalRecord> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $LocalClinicalRecordsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
    'id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _serverIdMeta = const VerificationMeta(
    'serverId',
  );
  @override
  late final GeneratedColumn<String> serverId = GeneratedColumn<String>(
    'server_id',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways('UNIQUE'),
  );
  static const VerificationMeta _patientIdMeta = const VerificationMeta(
    'patientId',
  );
  @override
  late final GeneratedColumn<String> patientId = GeneratedColumn<String>(
    'patient_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _patientServerIdMeta = const VerificationMeta(
    'patientServerId',
  );
  @override
  late final GeneratedColumn<String> patientServerId = GeneratedColumn<String>(
    'patient_server_id',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _encounterDateMeta = const VerificationMeta(
    'encounterDate',
  );
  @override
  late final GeneratedColumn<String> encounterDate = GeneratedColumn<String>(
    'encounter_date',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _psaNgMlMeta = const VerificationMeta(
    'psaNgMl',
  );
  @override
  late final GeneratedColumn<double> psaNgMl = GeneratedColumn<double>(
    'psa_ng_ml',
    aliasedName,
    true,
    type: DriftSqlType.double,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _freePsaNgMlMeta = const VerificationMeta(
    'freePsaNgMl',
  );
  @override
  late final GeneratedColumn<double> freePsaNgMl = GeneratedColumn<double>(
    'free_psa_ng_ml',
    aliasedName,
    true,
    type: DriftSqlType.double,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _dreFindingMeta = const VerificationMeta(
    'dreFinding',
  );
  @override
  late final GeneratedColumn<String> dreFinding = GeneratedColumn<String>(
    'dre_finding',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _piradsScoreMeta = const VerificationMeta(
    'piradsScore',
  );
  @override
  late final GeneratedColumn<int> piradsScore = GeneratedColumn<int>(
    'pirads_score',
    aliasedName,
    true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _prostateVolumeMlMeta = const VerificationMeta(
    'prostateVolumeMl',
  );
  @override
  late final GeneratedColumn<double> prostateVolumeMl = GeneratedColumn<double>(
    'prostate_volume_ml',
    aliasedName,
    true,
    type: DriftSqlType.double,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _notesMeta = const VerificationMeta('notes');
  @override
  late final GeneratedColumn<String> notes = GeneratedColumn<String>(
    'notes',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _syncStateMeta = const VerificationMeta(
    'syncState',
  );
  @override
  late final GeneratedColumn<String> syncState = GeneratedColumn<String>(
    'sync_state',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _createdAtMeta = const VerificationMeta(
    'createdAt',
  );
  @override
  late final GeneratedColumn<DateTime> createdAt = GeneratedColumn<DateTime>(
    'created_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [
    id,
    serverId,
    patientId,
    patientServerId,
    encounterDate,
    psaNgMl,
    freePsaNgMl,
    dreFinding,
    piradsScore,
    prostateVolumeMl,
    notes,
    syncState,
    createdAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'local_clinical_records';
  @override
  VerificationContext validateIntegrity(
    Insertable<LocalClinicalRecord> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('server_id')) {
      context.handle(
        _serverIdMeta,
        serverId.isAcceptableOrUnknown(data['server_id']!, _serverIdMeta),
      );
    }
    if (data.containsKey('patient_id')) {
      context.handle(
        _patientIdMeta,
        patientId.isAcceptableOrUnknown(data['patient_id']!, _patientIdMeta),
      );
    } else if (isInserting) {
      context.missing(_patientIdMeta);
    }
    if (data.containsKey('patient_server_id')) {
      context.handle(
        _patientServerIdMeta,
        patientServerId.isAcceptableOrUnknown(
          data['patient_server_id']!,
          _patientServerIdMeta,
        ),
      );
    }
    if (data.containsKey('encounter_date')) {
      context.handle(
        _encounterDateMeta,
        encounterDate.isAcceptableOrUnknown(
          data['encounter_date']!,
          _encounterDateMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_encounterDateMeta);
    }
    if (data.containsKey('psa_ng_ml')) {
      context.handle(
        _psaNgMlMeta,
        psaNgMl.isAcceptableOrUnknown(data['psa_ng_ml']!, _psaNgMlMeta),
      );
    }
    if (data.containsKey('free_psa_ng_ml')) {
      context.handle(
        _freePsaNgMlMeta,
        freePsaNgMl.isAcceptableOrUnknown(
          data['free_psa_ng_ml']!,
          _freePsaNgMlMeta,
        ),
      );
    }
    if (data.containsKey('dre_finding')) {
      context.handle(
        _dreFindingMeta,
        dreFinding.isAcceptableOrUnknown(data['dre_finding']!, _dreFindingMeta),
      );
    } else if (isInserting) {
      context.missing(_dreFindingMeta);
    }
    if (data.containsKey('pirads_score')) {
      context.handle(
        _piradsScoreMeta,
        piradsScore.isAcceptableOrUnknown(
          data['pirads_score']!,
          _piradsScoreMeta,
        ),
      );
    }
    if (data.containsKey('prostate_volume_ml')) {
      context.handle(
        _prostateVolumeMlMeta,
        prostateVolumeMl.isAcceptableOrUnknown(
          data['prostate_volume_ml']!,
          _prostateVolumeMlMeta,
        ),
      );
    }
    if (data.containsKey('notes')) {
      context.handle(
        _notesMeta,
        notes.isAcceptableOrUnknown(data['notes']!, _notesMeta),
      );
    }
    if (data.containsKey('sync_state')) {
      context.handle(
        _syncStateMeta,
        syncState.isAcceptableOrUnknown(data['sync_state']!, _syncStateMeta),
      );
    } else if (isInserting) {
      context.missing(_syncStateMeta);
    }
    if (data.containsKey('created_at')) {
      context.handle(
        _createdAtMeta,
        createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta),
      );
    } else if (isInserting) {
      context.missing(_createdAtMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  LocalClinicalRecord map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return LocalClinicalRecord(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}id'],
      )!,
      serverId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}server_id'],
      ),
      patientId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}patient_id'],
      )!,
      patientServerId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}patient_server_id'],
      ),
      encounterDate: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}encounter_date'],
      )!,
      psaNgMl: attachedDatabase.typeMapping.read(
        DriftSqlType.double,
        data['${effectivePrefix}psa_ng_ml'],
      ),
      freePsaNgMl: attachedDatabase.typeMapping.read(
        DriftSqlType.double,
        data['${effectivePrefix}free_psa_ng_ml'],
      ),
      dreFinding: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}dre_finding'],
      )!,
      piradsScore: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}pirads_score'],
      ),
      prostateVolumeMl: attachedDatabase.typeMapping.read(
        DriftSqlType.double,
        data['${effectivePrefix}prostate_volume_ml'],
      ),
      notes: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}notes'],
      ),
      syncState: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}sync_state'],
      )!,
      createdAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}created_at'],
      )!,
    );
  }

  @override
  $LocalClinicalRecordsTable createAlias(String alias) {
    return $LocalClinicalRecordsTable(attachedDatabase, alias);
  }
}

class LocalClinicalRecord extends DataClass
    implements Insertable<LocalClinicalRecord> {
  final String id;
  final String? serverId;

  /// Local patient id, and the patient's server id once known.
  final String patientId;
  final String? patientServerId;
  final String encounterDate;
  final double? psaNgMl;
  final double? freePsaNgMl;
  final String dreFinding;
  final int? piradsScore;
  final double? prostateVolumeMl;
  final String? notes;
  final String syncState;
  final DateTime createdAt;
  const LocalClinicalRecord({
    required this.id,
    this.serverId,
    required this.patientId,
    this.patientServerId,
    required this.encounterDate,
    this.psaNgMl,
    this.freePsaNgMl,
    required this.dreFinding,
    this.piradsScore,
    this.prostateVolumeMl,
    this.notes,
    required this.syncState,
    required this.createdAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    if (!nullToAbsent || serverId != null) {
      map['server_id'] = Variable<String>(serverId);
    }
    map['patient_id'] = Variable<String>(patientId);
    if (!nullToAbsent || patientServerId != null) {
      map['patient_server_id'] = Variable<String>(patientServerId);
    }
    map['encounter_date'] = Variable<String>(encounterDate);
    if (!nullToAbsent || psaNgMl != null) {
      map['psa_ng_ml'] = Variable<double>(psaNgMl);
    }
    if (!nullToAbsent || freePsaNgMl != null) {
      map['free_psa_ng_ml'] = Variable<double>(freePsaNgMl);
    }
    map['dre_finding'] = Variable<String>(dreFinding);
    if (!nullToAbsent || piradsScore != null) {
      map['pirads_score'] = Variable<int>(piradsScore);
    }
    if (!nullToAbsent || prostateVolumeMl != null) {
      map['prostate_volume_ml'] = Variable<double>(prostateVolumeMl);
    }
    if (!nullToAbsent || notes != null) {
      map['notes'] = Variable<String>(notes);
    }
    map['sync_state'] = Variable<String>(syncState);
    map['created_at'] = Variable<DateTime>(createdAt);
    return map;
  }

  LocalClinicalRecordsCompanion toCompanion(bool nullToAbsent) {
    return LocalClinicalRecordsCompanion(
      id: Value(id),
      serverId: serverId == null && nullToAbsent
          ? const Value.absent()
          : Value(serverId),
      patientId: Value(patientId),
      patientServerId: patientServerId == null && nullToAbsent
          ? const Value.absent()
          : Value(patientServerId),
      encounterDate: Value(encounterDate),
      psaNgMl: psaNgMl == null && nullToAbsent
          ? const Value.absent()
          : Value(psaNgMl),
      freePsaNgMl: freePsaNgMl == null && nullToAbsent
          ? const Value.absent()
          : Value(freePsaNgMl),
      dreFinding: Value(dreFinding),
      piradsScore: piradsScore == null && nullToAbsent
          ? const Value.absent()
          : Value(piradsScore),
      prostateVolumeMl: prostateVolumeMl == null && nullToAbsent
          ? const Value.absent()
          : Value(prostateVolumeMl),
      notes: notes == null && nullToAbsent
          ? const Value.absent()
          : Value(notes),
      syncState: Value(syncState),
      createdAt: Value(createdAt),
    );
  }

  factory LocalClinicalRecord.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return LocalClinicalRecord(
      id: serializer.fromJson<String>(json['id']),
      serverId: serializer.fromJson<String?>(json['serverId']),
      patientId: serializer.fromJson<String>(json['patientId']),
      patientServerId: serializer.fromJson<String?>(json['patientServerId']),
      encounterDate: serializer.fromJson<String>(json['encounterDate']),
      psaNgMl: serializer.fromJson<double?>(json['psaNgMl']),
      freePsaNgMl: serializer.fromJson<double?>(json['freePsaNgMl']),
      dreFinding: serializer.fromJson<String>(json['dreFinding']),
      piradsScore: serializer.fromJson<int?>(json['piradsScore']),
      prostateVolumeMl: serializer.fromJson<double?>(json['prostateVolumeMl']),
      notes: serializer.fromJson<String?>(json['notes']),
      syncState: serializer.fromJson<String>(json['syncState']),
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'serverId': serializer.toJson<String?>(serverId),
      'patientId': serializer.toJson<String>(patientId),
      'patientServerId': serializer.toJson<String?>(patientServerId),
      'encounterDate': serializer.toJson<String>(encounterDate),
      'psaNgMl': serializer.toJson<double?>(psaNgMl),
      'freePsaNgMl': serializer.toJson<double?>(freePsaNgMl),
      'dreFinding': serializer.toJson<String>(dreFinding),
      'piradsScore': serializer.toJson<int?>(piradsScore),
      'prostateVolumeMl': serializer.toJson<double?>(prostateVolumeMl),
      'notes': serializer.toJson<String?>(notes),
      'syncState': serializer.toJson<String>(syncState),
      'createdAt': serializer.toJson<DateTime>(createdAt),
    };
  }

  LocalClinicalRecord copyWith({
    String? id,
    Value<String?> serverId = const Value.absent(),
    String? patientId,
    Value<String?> patientServerId = const Value.absent(),
    String? encounterDate,
    Value<double?> psaNgMl = const Value.absent(),
    Value<double?> freePsaNgMl = const Value.absent(),
    String? dreFinding,
    Value<int?> piradsScore = const Value.absent(),
    Value<double?> prostateVolumeMl = const Value.absent(),
    Value<String?> notes = const Value.absent(),
    String? syncState,
    DateTime? createdAt,
  }) => LocalClinicalRecord(
    id: id ?? this.id,
    serverId: serverId.present ? serverId.value : this.serverId,
    patientId: patientId ?? this.patientId,
    patientServerId: patientServerId.present
        ? patientServerId.value
        : this.patientServerId,
    encounterDate: encounterDate ?? this.encounterDate,
    psaNgMl: psaNgMl.present ? psaNgMl.value : this.psaNgMl,
    freePsaNgMl: freePsaNgMl.present ? freePsaNgMl.value : this.freePsaNgMl,
    dreFinding: dreFinding ?? this.dreFinding,
    piradsScore: piradsScore.present ? piradsScore.value : this.piradsScore,
    prostateVolumeMl: prostateVolumeMl.present
        ? prostateVolumeMl.value
        : this.prostateVolumeMl,
    notes: notes.present ? notes.value : this.notes,
    syncState: syncState ?? this.syncState,
    createdAt: createdAt ?? this.createdAt,
  );
  LocalClinicalRecord copyWithCompanion(LocalClinicalRecordsCompanion data) {
    return LocalClinicalRecord(
      id: data.id.present ? data.id.value : this.id,
      serverId: data.serverId.present ? data.serverId.value : this.serverId,
      patientId: data.patientId.present ? data.patientId.value : this.patientId,
      patientServerId: data.patientServerId.present
          ? data.patientServerId.value
          : this.patientServerId,
      encounterDate: data.encounterDate.present
          ? data.encounterDate.value
          : this.encounterDate,
      psaNgMl: data.psaNgMl.present ? data.psaNgMl.value : this.psaNgMl,
      freePsaNgMl: data.freePsaNgMl.present
          ? data.freePsaNgMl.value
          : this.freePsaNgMl,
      dreFinding: data.dreFinding.present
          ? data.dreFinding.value
          : this.dreFinding,
      piradsScore: data.piradsScore.present
          ? data.piradsScore.value
          : this.piradsScore,
      prostateVolumeMl: data.prostateVolumeMl.present
          ? data.prostateVolumeMl.value
          : this.prostateVolumeMl,
      notes: data.notes.present ? data.notes.value : this.notes,
      syncState: data.syncState.present ? data.syncState.value : this.syncState,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('LocalClinicalRecord(')
          ..write('id: $id, ')
          ..write('serverId: $serverId, ')
          ..write('patientId: $patientId, ')
          ..write('patientServerId: $patientServerId, ')
          ..write('encounterDate: $encounterDate, ')
          ..write('psaNgMl: $psaNgMl, ')
          ..write('freePsaNgMl: $freePsaNgMl, ')
          ..write('dreFinding: $dreFinding, ')
          ..write('piradsScore: $piradsScore, ')
          ..write('prostateVolumeMl: $prostateVolumeMl, ')
          ..write('notes: $notes, ')
          ..write('syncState: $syncState, ')
          ..write('createdAt: $createdAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    id,
    serverId,
    patientId,
    patientServerId,
    encounterDate,
    psaNgMl,
    freePsaNgMl,
    dreFinding,
    piradsScore,
    prostateVolumeMl,
    notes,
    syncState,
    createdAt,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is LocalClinicalRecord &&
          other.id == this.id &&
          other.serverId == this.serverId &&
          other.patientId == this.patientId &&
          other.patientServerId == this.patientServerId &&
          other.encounterDate == this.encounterDate &&
          other.psaNgMl == this.psaNgMl &&
          other.freePsaNgMl == this.freePsaNgMl &&
          other.dreFinding == this.dreFinding &&
          other.piradsScore == this.piradsScore &&
          other.prostateVolumeMl == this.prostateVolumeMl &&
          other.notes == this.notes &&
          other.syncState == this.syncState &&
          other.createdAt == this.createdAt);
}

class LocalClinicalRecordsCompanion
    extends UpdateCompanion<LocalClinicalRecord> {
  final Value<String> id;
  final Value<String?> serverId;
  final Value<String> patientId;
  final Value<String?> patientServerId;
  final Value<String> encounterDate;
  final Value<double?> psaNgMl;
  final Value<double?> freePsaNgMl;
  final Value<String> dreFinding;
  final Value<int?> piradsScore;
  final Value<double?> prostateVolumeMl;
  final Value<String?> notes;
  final Value<String> syncState;
  final Value<DateTime> createdAt;
  final Value<int> rowid;
  const LocalClinicalRecordsCompanion({
    this.id = const Value.absent(),
    this.serverId = const Value.absent(),
    this.patientId = const Value.absent(),
    this.patientServerId = const Value.absent(),
    this.encounterDate = const Value.absent(),
    this.psaNgMl = const Value.absent(),
    this.freePsaNgMl = const Value.absent(),
    this.dreFinding = const Value.absent(),
    this.piradsScore = const Value.absent(),
    this.prostateVolumeMl = const Value.absent(),
    this.notes = const Value.absent(),
    this.syncState = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  LocalClinicalRecordsCompanion.insert({
    required String id,
    this.serverId = const Value.absent(),
    required String patientId,
    this.patientServerId = const Value.absent(),
    required String encounterDate,
    this.psaNgMl = const Value.absent(),
    this.freePsaNgMl = const Value.absent(),
    required String dreFinding,
    this.piradsScore = const Value.absent(),
    this.prostateVolumeMl = const Value.absent(),
    this.notes = const Value.absent(),
    required String syncState,
    required DateTime createdAt,
    this.rowid = const Value.absent(),
  }) : id = Value(id),
       patientId = Value(patientId),
       encounterDate = Value(encounterDate),
       dreFinding = Value(dreFinding),
       syncState = Value(syncState),
       createdAt = Value(createdAt);
  static Insertable<LocalClinicalRecord> custom({
    Expression<String>? id,
    Expression<String>? serverId,
    Expression<String>? patientId,
    Expression<String>? patientServerId,
    Expression<String>? encounterDate,
    Expression<double>? psaNgMl,
    Expression<double>? freePsaNgMl,
    Expression<String>? dreFinding,
    Expression<int>? piradsScore,
    Expression<double>? prostateVolumeMl,
    Expression<String>? notes,
    Expression<String>? syncState,
    Expression<DateTime>? createdAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (serverId != null) 'server_id': serverId,
      if (patientId != null) 'patient_id': patientId,
      if (patientServerId != null) 'patient_server_id': patientServerId,
      if (encounterDate != null) 'encounter_date': encounterDate,
      if (psaNgMl != null) 'psa_ng_ml': psaNgMl,
      if (freePsaNgMl != null) 'free_psa_ng_ml': freePsaNgMl,
      if (dreFinding != null) 'dre_finding': dreFinding,
      if (piradsScore != null) 'pirads_score': piradsScore,
      if (prostateVolumeMl != null) 'prostate_volume_ml': prostateVolumeMl,
      if (notes != null) 'notes': notes,
      if (syncState != null) 'sync_state': syncState,
      if (createdAt != null) 'created_at': createdAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  LocalClinicalRecordsCompanion copyWith({
    Value<String>? id,
    Value<String?>? serverId,
    Value<String>? patientId,
    Value<String?>? patientServerId,
    Value<String>? encounterDate,
    Value<double?>? psaNgMl,
    Value<double?>? freePsaNgMl,
    Value<String>? dreFinding,
    Value<int?>? piradsScore,
    Value<double?>? prostateVolumeMl,
    Value<String?>? notes,
    Value<String>? syncState,
    Value<DateTime>? createdAt,
    Value<int>? rowid,
  }) {
    return LocalClinicalRecordsCompanion(
      id: id ?? this.id,
      serverId: serverId ?? this.serverId,
      patientId: patientId ?? this.patientId,
      patientServerId: patientServerId ?? this.patientServerId,
      encounterDate: encounterDate ?? this.encounterDate,
      psaNgMl: psaNgMl ?? this.psaNgMl,
      freePsaNgMl: freePsaNgMl ?? this.freePsaNgMl,
      dreFinding: dreFinding ?? this.dreFinding,
      piradsScore: piradsScore ?? this.piradsScore,
      prostateVolumeMl: prostateVolumeMl ?? this.prostateVolumeMl,
      notes: notes ?? this.notes,
      syncState: syncState ?? this.syncState,
      createdAt: createdAt ?? this.createdAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (serverId.present) {
      map['server_id'] = Variable<String>(serverId.value);
    }
    if (patientId.present) {
      map['patient_id'] = Variable<String>(patientId.value);
    }
    if (patientServerId.present) {
      map['patient_server_id'] = Variable<String>(patientServerId.value);
    }
    if (encounterDate.present) {
      map['encounter_date'] = Variable<String>(encounterDate.value);
    }
    if (psaNgMl.present) {
      map['psa_ng_ml'] = Variable<double>(psaNgMl.value);
    }
    if (freePsaNgMl.present) {
      map['free_psa_ng_ml'] = Variable<double>(freePsaNgMl.value);
    }
    if (dreFinding.present) {
      map['dre_finding'] = Variable<String>(dreFinding.value);
    }
    if (piradsScore.present) {
      map['pirads_score'] = Variable<int>(piradsScore.value);
    }
    if (prostateVolumeMl.present) {
      map['prostate_volume_ml'] = Variable<double>(prostateVolumeMl.value);
    }
    if (notes.present) {
      map['notes'] = Variable<String>(notes.value);
    }
    if (syncState.present) {
      map['sync_state'] = Variable<String>(syncState.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<DateTime>(createdAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('LocalClinicalRecordsCompanion(')
          ..write('id: $id, ')
          ..write('serverId: $serverId, ')
          ..write('patientId: $patientId, ')
          ..write('patientServerId: $patientServerId, ')
          ..write('encounterDate: $encounterDate, ')
          ..write('psaNgMl: $psaNgMl, ')
          ..write('freePsaNgMl: $freePsaNgMl, ')
          ..write('dreFinding: $dreFinding, ')
          ..write('piradsScore: $piradsScore, ')
          ..write('prostateVolumeMl: $prostateVolumeMl, ')
          ..write('notes: $notes, ')
          ..write('syncState: $syncState, ')
          ..write('createdAt: $createdAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $OutboxTable extends Outbox with TableInfo<$OutboxTable, OutboxData> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $OutboxTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _seqMeta = const VerificationMeta('seq');
  @override
  late final GeneratedColumn<int> seq = GeneratedColumn<int>(
    'seq',
    aliasedName,
    false,
    hasAutoIncrement: true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'PRIMARY KEY AUTOINCREMENT',
    ),
  );
  static const VerificationMeta _idempotencyKeyMeta = const VerificationMeta(
    'idempotencyKey',
  );
  @override
  late final GeneratedColumn<String> idempotencyKey = GeneratedColumn<String>(
    'idempotency_key',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
    defaultConstraints: GeneratedColumn.constraintIsAlways('UNIQUE'),
  );
  static const VerificationMeta _entityTypeMeta = const VerificationMeta(
    'entityType',
  );
  @override
  late final GeneratedColumn<String> entityType = GeneratedColumn<String>(
    'entity_type',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _operationMeta = const VerificationMeta(
    'operation',
  );
  @override
  late final GeneratedColumn<String> operation = GeneratedColumn<String>(
    'operation',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _entityLocalIdMeta = const VerificationMeta(
    'entityLocalId',
  );
  @override
  late final GeneratedColumn<String> entityLocalId = GeneratedColumn<String>(
    'entity_local_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _patientLocalIdMeta = const VerificationMeta(
    'patientLocalId',
  );
  @override
  late final GeneratedColumn<String> patientLocalId = GeneratedColumn<String>(
    'patient_local_id',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _baseVersionMeta = const VerificationMeta(
    'baseVersion',
  );
  @override
  late final GeneratedColumn<int> baseVersion = GeneratedColumn<int>(
    'base_version',
    aliasedName,
    true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _payloadMeta = const VerificationMeta(
    'payload',
  );
  @override
  late final GeneratedColumn<String> payload = GeneratedColumn<String>(
    'payload',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _createdAtMeta = const VerificationMeta(
    'createdAt',
  );
  @override
  late final GeneratedColumn<DateTime> createdAt = GeneratedColumn<DateTime>(
    'created_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _statusMeta = const VerificationMeta('status');
  @override
  late final GeneratedColumn<String> status = GeneratedColumn<String>(
    'status',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant('pending'),
  );
  static const VerificationMeta _attemptsMeta = const VerificationMeta(
    'attempts',
  );
  @override
  late final GeneratedColumn<int> attempts = GeneratedColumn<int>(
    'attempts',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(0),
  );
  static const VerificationMeta _lastErrorCodeMeta = const VerificationMeta(
    'lastErrorCode',
  );
  @override
  late final GeneratedColumn<String> lastErrorCode = GeneratedColumn<String>(
    'last_error_code',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _lastErrorMessageMeta = const VerificationMeta(
    'lastErrorMessage',
  );
  @override
  late final GeneratedColumn<String> lastErrorMessage = GeneratedColumn<String>(
    'last_error_message',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  @override
  List<GeneratedColumn> get $columns => [
    seq,
    idempotencyKey,
    entityType,
    operation,
    entityLocalId,
    patientLocalId,
    baseVersion,
    payload,
    createdAt,
    status,
    attempts,
    lastErrorCode,
    lastErrorMessage,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'outbox';
  @override
  VerificationContext validateIntegrity(
    Insertable<OutboxData> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('seq')) {
      context.handle(
        _seqMeta,
        seq.isAcceptableOrUnknown(data['seq']!, _seqMeta),
      );
    }
    if (data.containsKey('idempotency_key')) {
      context.handle(
        _idempotencyKeyMeta,
        idempotencyKey.isAcceptableOrUnknown(
          data['idempotency_key']!,
          _idempotencyKeyMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_idempotencyKeyMeta);
    }
    if (data.containsKey('entity_type')) {
      context.handle(
        _entityTypeMeta,
        entityType.isAcceptableOrUnknown(data['entity_type']!, _entityTypeMeta),
      );
    } else if (isInserting) {
      context.missing(_entityTypeMeta);
    }
    if (data.containsKey('operation')) {
      context.handle(
        _operationMeta,
        operation.isAcceptableOrUnknown(data['operation']!, _operationMeta),
      );
    } else if (isInserting) {
      context.missing(_operationMeta);
    }
    if (data.containsKey('entity_local_id')) {
      context.handle(
        _entityLocalIdMeta,
        entityLocalId.isAcceptableOrUnknown(
          data['entity_local_id']!,
          _entityLocalIdMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_entityLocalIdMeta);
    }
    if (data.containsKey('patient_local_id')) {
      context.handle(
        _patientLocalIdMeta,
        patientLocalId.isAcceptableOrUnknown(
          data['patient_local_id']!,
          _patientLocalIdMeta,
        ),
      );
    }
    if (data.containsKey('base_version')) {
      context.handle(
        _baseVersionMeta,
        baseVersion.isAcceptableOrUnknown(
          data['base_version']!,
          _baseVersionMeta,
        ),
      );
    }
    if (data.containsKey('payload')) {
      context.handle(
        _payloadMeta,
        payload.isAcceptableOrUnknown(data['payload']!, _payloadMeta),
      );
    } else if (isInserting) {
      context.missing(_payloadMeta);
    }
    if (data.containsKey('created_at')) {
      context.handle(
        _createdAtMeta,
        createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta),
      );
    } else if (isInserting) {
      context.missing(_createdAtMeta);
    }
    if (data.containsKey('status')) {
      context.handle(
        _statusMeta,
        status.isAcceptableOrUnknown(data['status']!, _statusMeta),
      );
    }
    if (data.containsKey('attempts')) {
      context.handle(
        _attemptsMeta,
        attempts.isAcceptableOrUnknown(data['attempts']!, _attemptsMeta),
      );
    }
    if (data.containsKey('last_error_code')) {
      context.handle(
        _lastErrorCodeMeta,
        lastErrorCode.isAcceptableOrUnknown(
          data['last_error_code']!,
          _lastErrorCodeMeta,
        ),
      );
    }
    if (data.containsKey('last_error_message')) {
      context.handle(
        _lastErrorMessageMeta,
        lastErrorMessage.isAcceptableOrUnknown(
          data['last_error_message']!,
          _lastErrorMessageMeta,
        ),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {seq};
  @override
  OutboxData map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return OutboxData(
      seq: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}seq'],
      )!,
      idempotencyKey: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}idempotency_key'],
      )!,
      entityType: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}entity_type'],
      )!,
      operation: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}operation'],
      )!,
      entityLocalId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}entity_local_id'],
      )!,
      patientLocalId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}patient_local_id'],
      ),
      baseVersion: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}base_version'],
      ),
      payload: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}payload'],
      )!,
      createdAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}created_at'],
      )!,
      status: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}status'],
      )!,
      attempts: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}attempts'],
      )!,
      lastErrorCode: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}last_error_code'],
      ),
      lastErrorMessage: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}last_error_message'],
      ),
    );
  }

  @override
  $OutboxTable createAlias(String alias) {
    return $OutboxTable(attachedDatabase, alias);
  }
}

class OutboxData extends DataClass implements Insertable<OutboxData> {
  final int seq;
  final String idempotencyKey;
  final String entityType;
  final String operation;
  final String entityLocalId;
  final String? patientLocalId;
  final int? baseVersion;
  final String payload;
  final DateTime createdAt;

  /// pending | sending | rejected
  final String status;
  final int attempts;
  final String? lastErrorCode;
  final String? lastErrorMessage;
  const OutboxData({
    required this.seq,
    required this.idempotencyKey,
    required this.entityType,
    required this.operation,
    required this.entityLocalId,
    this.patientLocalId,
    this.baseVersion,
    required this.payload,
    required this.createdAt,
    required this.status,
    required this.attempts,
    this.lastErrorCode,
    this.lastErrorMessage,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['seq'] = Variable<int>(seq);
    map['idempotency_key'] = Variable<String>(idempotencyKey);
    map['entity_type'] = Variable<String>(entityType);
    map['operation'] = Variable<String>(operation);
    map['entity_local_id'] = Variable<String>(entityLocalId);
    if (!nullToAbsent || patientLocalId != null) {
      map['patient_local_id'] = Variable<String>(patientLocalId);
    }
    if (!nullToAbsent || baseVersion != null) {
      map['base_version'] = Variable<int>(baseVersion);
    }
    map['payload'] = Variable<String>(payload);
    map['created_at'] = Variable<DateTime>(createdAt);
    map['status'] = Variable<String>(status);
    map['attempts'] = Variable<int>(attempts);
    if (!nullToAbsent || lastErrorCode != null) {
      map['last_error_code'] = Variable<String>(lastErrorCode);
    }
    if (!nullToAbsent || lastErrorMessage != null) {
      map['last_error_message'] = Variable<String>(lastErrorMessage);
    }
    return map;
  }

  OutboxCompanion toCompanion(bool nullToAbsent) {
    return OutboxCompanion(
      seq: Value(seq),
      idempotencyKey: Value(idempotencyKey),
      entityType: Value(entityType),
      operation: Value(operation),
      entityLocalId: Value(entityLocalId),
      patientLocalId: patientLocalId == null && nullToAbsent
          ? const Value.absent()
          : Value(patientLocalId),
      baseVersion: baseVersion == null && nullToAbsent
          ? const Value.absent()
          : Value(baseVersion),
      payload: Value(payload),
      createdAt: Value(createdAt),
      status: Value(status),
      attempts: Value(attempts),
      lastErrorCode: lastErrorCode == null && nullToAbsent
          ? const Value.absent()
          : Value(lastErrorCode),
      lastErrorMessage: lastErrorMessage == null && nullToAbsent
          ? const Value.absent()
          : Value(lastErrorMessage),
    );
  }

  factory OutboxData.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return OutboxData(
      seq: serializer.fromJson<int>(json['seq']),
      idempotencyKey: serializer.fromJson<String>(json['idempotencyKey']),
      entityType: serializer.fromJson<String>(json['entityType']),
      operation: serializer.fromJson<String>(json['operation']),
      entityLocalId: serializer.fromJson<String>(json['entityLocalId']),
      patientLocalId: serializer.fromJson<String?>(json['patientLocalId']),
      baseVersion: serializer.fromJson<int?>(json['baseVersion']),
      payload: serializer.fromJson<String>(json['payload']),
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
      status: serializer.fromJson<String>(json['status']),
      attempts: serializer.fromJson<int>(json['attempts']),
      lastErrorCode: serializer.fromJson<String?>(json['lastErrorCode']),
      lastErrorMessage: serializer.fromJson<String?>(json['lastErrorMessage']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'seq': serializer.toJson<int>(seq),
      'idempotencyKey': serializer.toJson<String>(idempotencyKey),
      'entityType': serializer.toJson<String>(entityType),
      'operation': serializer.toJson<String>(operation),
      'entityLocalId': serializer.toJson<String>(entityLocalId),
      'patientLocalId': serializer.toJson<String?>(patientLocalId),
      'baseVersion': serializer.toJson<int?>(baseVersion),
      'payload': serializer.toJson<String>(payload),
      'createdAt': serializer.toJson<DateTime>(createdAt),
      'status': serializer.toJson<String>(status),
      'attempts': serializer.toJson<int>(attempts),
      'lastErrorCode': serializer.toJson<String?>(lastErrorCode),
      'lastErrorMessage': serializer.toJson<String?>(lastErrorMessage),
    };
  }

  OutboxData copyWith({
    int? seq,
    String? idempotencyKey,
    String? entityType,
    String? operation,
    String? entityLocalId,
    Value<String?> patientLocalId = const Value.absent(),
    Value<int?> baseVersion = const Value.absent(),
    String? payload,
    DateTime? createdAt,
    String? status,
    int? attempts,
    Value<String?> lastErrorCode = const Value.absent(),
    Value<String?> lastErrorMessage = const Value.absent(),
  }) => OutboxData(
    seq: seq ?? this.seq,
    idempotencyKey: idempotencyKey ?? this.idempotencyKey,
    entityType: entityType ?? this.entityType,
    operation: operation ?? this.operation,
    entityLocalId: entityLocalId ?? this.entityLocalId,
    patientLocalId: patientLocalId.present
        ? patientLocalId.value
        : this.patientLocalId,
    baseVersion: baseVersion.present ? baseVersion.value : this.baseVersion,
    payload: payload ?? this.payload,
    createdAt: createdAt ?? this.createdAt,
    status: status ?? this.status,
    attempts: attempts ?? this.attempts,
    lastErrorCode: lastErrorCode.present
        ? lastErrorCode.value
        : this.lastErrorCode,
    lastErrorMessage: lastErrorMessage.present
        ? lastErrorMessage.value
        : this.lastErrorMessage,
  );
  OutboxData copyWithCompanion(OutboxCompanion data) {
    return OutboxData(
      seq: data.seq.present ? data.seq.value : this.seq,
      idempotencyKey: data.idempotencyKey.present
          ? data.idempotencyKey.value
          : this.idempotencyKey,
      entityType: data.entityType.present
          ? data.entityType.value
          : this.entityType,
      operation: data.operation.present ? data.operation.value : this.operation,
      entityLocalId: data.entityLocalId.present
          ? data.entityLocalId.value
          : this.entityLocalId,
      patientLocalId: data.patientLocalId.present
          ? data.patientLocalId.value
          : this.patientLocalId,
      baseVersion: data.baseVersion.present
          ? data.baseVersion.value
          : this.baseVersion,
      payload: data.payload.present ? data.payload.value : this.payload,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
      status: data.status.present ? data.status.value : this.status,
      attempts: data.attempts.present ? data.attempts.value : this.attempts,
      lastErrorCode: data.lastErrorCode.present
          ? data.lastErrorCode.value
          : this.lastErrorCode,
      lastErrorMessage: data.lastErrorMessage.present
          ? data.lastErrorMessage.value
          : this.lastErrorMessage,
    );
  }

  @override
  String toString() {
    return (StringBuffer('OutboxData(')
          ..write('seq: $seq, ')
          ..write('idempotencyKey: $idempotencyKey, ')
          ..write('entityType: $entityType, ')
          ..write('operation: $operation, ')
          ..write('entityLocalId: $entityLocalId, ')
          ..write('patientLocalId: $patientLocalId, ')
          ..write('baseVersion: $baseVersion, ')
          ..write('payload: $payload, ')
          ..write('createdAt: $createdAt, ')
          ..write('status: $status, ')
          ..write('attempts: $attempts, ')
          ..write('lastErrorCode: $lastErrorCode, ')
          ..write('lastErrorMessage: $lastErrorMessage')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    seq,
    idempotencyKey,
    entityType,
    operation,
    entityLocalId,
    patientLocalId,
    baseVersion,
    payload,
    createdAt,
    status,
    attempts,
    lastErrorCode,
    lastErrorMessage,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is OutboxData &&
          other.seq == this.seq &&
          other.idempotencyKey == this.idempotencyKey &&
          other.entityType == this.entityType &&
          other.operation == this.operation &&
          other.entityLocalId == this.entityLocalId &&
          other.patientLocalId == this.patientLocalId &&
          other.baseVersion == this.baseVersion &&
          other.payload == this.payload &&
          other.createdAt == this.createdAt &&
          other.status == this.status &&
          other.attempts == this.attempts &&
          other.lastErrorCode == this.lastErrorCode &&
          other.lastErrorMessage == this.lastErrorMessage);
}

class OutboxCompanion extends UpdateCompanion<OutboxData> {
  final Value<int> seq;
  final Value<String> idempotencyKey;
  final Value<String> entityType;
  final Value<String> operation;
  final Value<String> entityLocalId;
  final Value<String?> patientLocalId;
  final Value<int?> baseVersion;
  final Value<String> payload;
  final Value<DateTime> createdAt;
  final Value<String> status;
  final Value<int> attempts;
  final Value<String?> lastErrorCode;
  final Value<String?> lastErrorMessage;
  const OutboxCompanion({
    this.seq = const Value.absent(),
    this.idempotencyKey = const Value.absent(),
    this.entityType = const Value.absent(),
    this.operation = const Value.absent(),
    this.entityLocalId = const Value.absent(),
    this.patientLocalId = const Value.absent(),
    this.baseVersion = const Value.absent(),
    this.payload = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.status = const Value.absent(),
    this.attempts = const Value.absent(),
    this.lastErrorCode = const Value.absent(),
    this.lastErrorMessage = const Value.absent(),
  });
  OutboxCompanion.insert({
    this.seq = const Value.absent(),
    required String idempotencyKey,
    required String entityType,
    required String operation,
    required String entityLocalId,
    this.patientLocalId = const Value.absent(),
    this.baseVersion = const Value.absent(),
    required String payload,
    required DateTime createdAt,
    this.status = const Value.absent(),
    this.attempts = const Value.absent(),
    this.lastErrorCode = const Value.absent(),
    this.lastErrorMessage = const Value.absent(),
  }) : idempotencyKey = Value(idempotencyKey),
       entityType = Value(entityType),
       operation = Value(operation),
       entityLocalId = Value(entityLocalId),
       payload = Value(payload),
       createdAt = Value(createdAt);
  static Insertable<OutboxData> custom({
    Expression<int>? seq,
    Expression<String>? idempotencyKey,
    Expression<String>? entityType,
    Expression<String>? operation,
    Expression<String>? entityLocalId,
    Expression<String>? patientLocalId,
    Expression<int>? baseVersion,
    Expression<String>? payload,
    Expression<DateTime>? createdAt,
    Expression<String>? status,
    Expression<int>? attempts,
    Expression<String>? lastErrorCode,
    Expression<String>? lastErrorMessage,
  }) {
    return RawValuesInsertable({
      if (seq != null) 'seq': seq,
      if (idempotencyKey != null) 'idempotency_key': idempotencyKey,
      if (entityType != null) 'entity_type': entityType,
      if (operation != null) 'operation': operation,
      if (entityLocalId != null) 'entity_local_id': entityLocalId,
      if (patientLocalId != null) 'patient_local_id': patientLocalId,
      if (baseVersion != null) 'base_version': baseVersion,
      if (payload != null) 'payload': payload,
      if (createdAt != null) 'created_at': createdAt,
      if (status != null) 'status': status,
      if (attempts != null) 'attempts': attempts,
      if (lastErrorCode != null) 'last_error_code': lastErrorCode,
      if (lastErrorMessage != null) 'last_error_message': lastErrorMessage,
    });
  }

  OutboxCompanion copyWith({
    Value<int>? seq,
    Value<String>? idempotencyKey,
    Value<String>? entityType,
    Value<String>? operation,
    Value<String>? entityLocalId,
    Value<String?>? patientLocalId,
    Value<int?>? baseVersion,
    Value<String>? payload,
    Value<DateTime>? createdAt,
    Value<String>? status,
    Value<int>? attempts,
    Value<String?>? lastErrorCode,
    Value<String?>? lastErrorMessage,
  }) {
    return OutboxCompanion(
      seq: seq ?? this.seq,
      idempotencyKey: idempotencyKey ?? this.idempotencyKey,
      entityType: entityType ?? this.entityType,
      operation: operation ?? this.operation,
      entityLocalId: entityLocalId ?? this.entityLocalId,
      patientLocalId: patientLocalId ?? this.patientLocalId,
      baseVersion: baseVersion ?? this.baseVersion,
      payload: payload ?? this.payload,
      createdAt: createdAt ?? this.createdAt,
      status: status ?? this.status,
      attempts: attempts ?? this.attempts,
      lastErrorCode: lastErrorCode ?? this.lastErrorCode,
      lastErrorMessage: lastErrorMessage ?? this.lastErrorMessage,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (seq.present) {
      map['seq'] = Variable<int>(seq.value);
    }
    if (idempotencyKey.present) {
      map['idempotency_key'] = Variable<String>(idempotencyKey.value);
    }
    if (entityType.present) {
      map['entity_type'] = Variable<String>(entityType.value);
    }
    if (operation.present) {
      map['operation'] = Variable<String>(operation.value);
    }
    if (entityLocalId.present) {
      map['entity_local_id'] = Variable<String>(entityLocalId.value);
    }
    if (patientLocalId.present) {
      map['patient_local_id'] = Variable<String>(patientLocalId.value);
    }
    if (baseVersion.present) {
      map['base_version'] = Variable<int>(baseVersion.value);
    }
    if (payload.present) {
      map['payload'] = Variable<String>(payload.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<DateTime>(createdAt.value);
    }
    if (status.present) {
      map['status'] = Variable<String>(status.value);
    }
    if (attempts.present) {
      map['attempts'] = Variable<int>(attempts.value);
    }
    if (lastErrorCode.present) {
      map['last_error_code'] = Variable<String>(lastErrorCode.value);
    }
    if (lastErrorMessage.present) {
      map['last_error_message'] = Variable<String>(lastErrorMessage.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('OutboxCompanion(')
          ..write('seq: $seq, ')
          ..write('idempotencyKey: $idempotencyKey, ')
          ..write('entityType: $entityType, ')
          ..write('operation: $operation, ')
          ..write('entityLocalId: $entityLocalId, ')
          ..write('patientLocalId: $patientLocalId, ')
          ..write('baseVersion: $baseVersion, ')
          ..write('payload: $payload, ')
          ..write('createdAt: $createdAt, ')
          ..write('status: $status, ')
          ..write('attempts: $attempts, ')
          ..write('lastErrorCode: $lastErrorCode, ')
          ..write('lastErrorMessage: $lastErrorMessage')
          ..write(')'))
        .toString();
  }
}

class $SyncConflictsTable extends SyncConflicts
    with TableInfo<$SyncConflictsTable, SyncConflict> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $SyncConflictsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<int> id = GeneratedColumn<int>(
    'id',
    aliasedName,
    false,
    hasAutoIncrement: true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'PRIMARY KEY AUTOINCREMENT',
    ),
  );
  static const VerificationMeta _patientLocalIdMeta = const VerificationMeta(
    'patientLocalId',
  );
  @override
  late final GeneratedColumn<String> patientLocalId = GeneratedColumn<String>(
    'patient_local_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _localChangesMeta = const VerificationMeta(
    'localChanges',
  );
  @override
  late final GeneratedColumn<String> localChanges = GeneratedColumn<String>(
    'local_changes',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _serverCopyMeta = const VerificationMeta(
    'serverCopy',
  );
  @override
  late final GeneratedColumn<String> serverCopy = GeneratedColumn<String>(
    'server_copy',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _serverVersionMeta = const VerificationMeta(
    'serverVersion',
  );
  @override
  late final GeneratedColumn<int> serverVersion = GeneratedColumn<int>(
    'server_version',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _createdAtMeta = const VerificationMeta(
    'createdAt',
  );
  @override
  late final GeneratedColumn<DateTime> createdAt = GeneratedColumn<DateTime>(
    'created_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [
    id,
    patientLocalId,
    localChanges,
    serverCopy,
    serverVersion,
    createdAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'sync_conflicts';
  @override
  VerificationContext validateIntegrity(
    Insertable<SyncConflict> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    }
    if (data.containsKey('patient_local_id')) {
      context.handle(
        _patientLocalIdMeta,
        patientLocalId.isAcceptableOrUnknown(
          data['patient_local_id']!,
          _patientLocalIdMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_patientLocalIdMeta);
    }
    if (data.containsKey('local_changes')) {
      context.handle(
        _localChangesMeta,
        localChanges.isAcceptableOrUnknown(
          data['local_changes']!,
          _localChangesMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_localChangesMeta);
    }
    if (data.containsKey('server_copy')) {
      context.handle(
        _serverCopyMeta,
        serverCopy.isAcceptableOrUnknown(data['server_copy']!, _serverCopyMeta),
      );
    } else if (isInserting) {
      context.missing(_serverCopyMeta);
    }
    if (data.containsKey('server_version')) {
      context.handle(
        _serverVersionMeta,
        serverVersion.isAcceptableOrUnknown(
          data['server_version']!,
          _serverVersionMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_serverVersionMeta);
    }
    if (data.containsKey('created_at')) {
      context.handle(
        _createdAtMeta,
        createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta),
      );
    } else if (isInserting) {
      context.missing(_createdAtMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  SyncConflict map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return SyncConflict(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}id'],
      )!,
      patientLocalId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}patient_local_id'],
      )!,
      localChanges: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}local_changes'],
      )!,
      serverCopy: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}server_copy'],
      )!,
      serverVersion: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}server_version'],
      )!,
      createdAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}created_at'],
      )!,
    );
  }

  @override
  $SyncConflictsTable createAlias(String alias) {
    return $SyncConflictsTable(attachedDatabase, alias);
  }
}

class SyncConflict extends DataClass implements Insertable<SyncConflict> {
  final int id;
  final String patientLocalId;
  final String localChanges;
  final String serverCopy;
  final int serverVersion;
  final DateTime createdAt;
  const SyncConflict({
    required this.id,
    required this.patientLocalId,
    required this.localChanges,
    required this.serverCopy,
    required this.serverVersion,
    required this.createdAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<int>(id);
    map['patient_local_id'] = Variable<String>(patientLocalId);
    map['local_changes'] = Variable<String>(localChanges);
    map['server_copy'] = Variable<String>(serverCopy);
    map['server_version'] = Variable<int>(serverVersion);
    map['created_at'] = Variable<DateTime>(createdAt);
    return map;
  }

  SyncConflictsCompanion toCompanion(bool nullToAbsent) {
    return SyncConflictsCompanion(
      id: Value(id),
      patientLocalId: Value(patientLocalId),
      localChanges: Value(localChanges),
      serverCopy: Value(serverCopy),
      serverVersion: Value(serverVersion),
      createdAt: Value(createdAt),
    );
  }

  factory SyncConflict.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return SyncConflict(
      id: serializer.fromJson<int>(json['id']),
      patientLocalId: serializer.fromJson<String>(json['patientLocalId']),
      localChanges: serializer.fromJson<String>(json['localChanges']),
      serverCopy: serializer.fromJson<String>(json['serverCopy']),
      serverVersion: serializer.fromJson<int>(json['serverVersion']),
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<int>(id),
      'patientLocalId': serializer.toJson<String>(patientLocalId),
      'localChanges': serializer.toJson<String>(localChanges),
      'serverCopy': serializer.toJson<String>(serverCopy),
      'serverVersion': serializer.toJson<int>(serverVersion),
      'createdAt': serializer.toJson<DateTime>(createdAt),
    };
  }

  SyncConflict copyWith({
    int? id,
    String? patientLocalId,
    String? localChanges,
    String? serverCopy,
    int? serverVersion,
    DateTime? createdAt,
  }) => SyncConflict(
    id: id ?? this.id,
    patientLocalId: patientLocalId ?? this.patientLocalId,
    localChanges: localChanges ?? this.localChanges,
    serverCopy: serverCopy ?? this.serverCopy,
    serverVersion: serverVersion ?? this.serverVersion,
    createdAt: createdAt ?? this.createdAt,
  );
  SyncConflict copyWithCompanion(SyncConflictsCompanion data) {
    return SyncConflict(
      id: data.id.present ? data.id.value : this.id,
      patientLocalId: data.patientLocalId.present
          ? data.patientLocalId.value
          : this.patientLocalId,
      localChanges: data.localChanges.present
          ? data.localChanges.value
          : this.localChanges,
      serverCopy: data.serverCopy.present
          ? data.serverCopy.value
          : this.serverCopy,
      serverVersion: data.serverVersion.present
          ? data.serverVersion.value
          : this.serverVersion,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('SyncConflict(')
          ..write('id: $id, ')
          ..write('patientLocalId: $patientLocalId, ')
          ..write('localChanges: $localChanges, ')
          ..write('serverCopy: $serverCopy, ')
          ..write('serverVersion: $serverVersion, ')
          ..write('createdAt: $createdAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    id,
    patientLocalId,
    localChanges,
    serverCopy,
    serverVersion,
    createdAt,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is SyncConflict &&
          other.id == this.id &&
          other.patientLocalId == this.patientLocalId &&
          other.localChanges == this.localChanges &&
          other.serverCopy == this.serverCopy &&
          other.serverVersion == this.serverVersion &&
          other.createdAt == this.createdAt);
}

class SyncConflictsCompanion extends UpdateCompanion<SyncConflict> {
  final Value<int> id;
  final Value<String> patientLocalId;
  final Value<String> localChanges;
  final Value<String> serverCopy;
  final Value<int> serverVersion;
  final Value<DateTime> createdAt;
  const SyncConflictsCompanion({
    this.id = const Value.absent(),
    this.patientLocalId = const Value.absent(),
    this.localChanges = const Value.absent(),
    this.serverCopy = const Value.absent(),
    this.serverVersion = const Value.absent(),
    this.createdAt = const Value.absent(),
  });
  SyncConflictsCompanion.insert({
    this.id = const Value.absent(),
    required String patientLocalId,
    required String localChanges,
    required String serverCopy,
    required int serverVersion,
    required DateTime createdAt,
  }) : patientLocalId = Value(patientLocalId),
       localChanges = Value(localChanges),
       serverCopy = Value(serverCopy),
       serverVersion = Value(serverVersion),
       createdAt = Value(createdAt);
  static Insertable<SyncConflict> custom({
    Expression<int>? id,
    Expression<String>? patientLocalId,
    Expression<String>? localChanges,
    Expression<String>? serverCopy,
    Expression<int>? serverVersion,
    Expression<DateTime>? createdAt,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (patientLocalId != null) 'patient_local_id': patientLocalId,
      if (localChanges != null) 'local_changes': localChanges,
      if (serverCopy != null) 'server_copy': serverCopy,
      if (serverVersion != null) 'server_version': serverVersion,
      if (createdAt != null) 'created_at': createdAt,
    });
  }

  SyncConflictsCompanion copyWith({
    Value<int>? id,
    Value<String>? patientLocalId,
    Value<String>? localChanges,
    Value<String>? serverCopy,
    Value<int>? serverVersion,
    Value<DateTime>? createdAt,
  }) {
    return SyncConflictsCompanion(
      id: id ?? this.id,
      patientLocalId: patientLocalId ?? this.patientLocalId,
      localChanges: localChanges ?? this.localChanges,
      serverCopy: serverCopy ?? this.serverCopy,
      serverVersion: serverVersion ?? this.serverVersion,
      createdAt: createdAt ?? this.createdAt,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<int>(id.value);
    }
    if (patientLocalId.present) {
      map['patient_local_id'] = Variable<String>(patientLocalId.value);
    }
    if (localChanges.present) {
      map['local_changes'] = Variable<String>(localChanges.value);
    }
    if (serverCopy.present) {
      map['server_copy'] = Variable<String>(serverCopy.value);
    }
    if (serverVersion.present) {
      map['server_version'] = Variable<int>(serverVersion.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<DateTime>(createdAt.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('SyncConflictsCompanion(')
          ..write('id: $id, ')
          ..write('patientLocalId: $patientLocalId, ')
          ..write('localChanges: $localChanges, ')
          ..write('serverCopy: $serverCopy, ')
          ..write('serverVersion: $serverVersion, ')
          ..write('createdAt: $createdAt')
          ..write(')'))
        .toString();
  }
}

class $MetaTable extends Meta with TableInfo<$MetaTable, MetaData> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $MetaTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _keyMeta = const VerificationMeta('key');
  @override
  late final GeneratedColumn<String> key = GeneratedColumn<String>(
    'key',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _valueMeta = const VerificationMeta('value');
  @override
  late final GeneratedColumn<String> value = GeneratedColumn<String>(
    'value',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [key, value];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'meta';
  @override
  VerificationContext validateIntegrity(
    Insertable<MetaData> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('key')) {
      context.handle(
        _keyMeta,
        key.isAcceptableOrUnknown(data['key']!, _keyMeta),
      );
    } else if (isInserting) {
      context.missing(_keyMeta);
    }
    if (data.containsKey('value')) {
      context.handle(
        _valueMeta,
        value.isAcceptableOrUnknown(data['value']!, _valueMeta),
      );
    } else if (isInserting) {
      context.missing(_valueMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {key};
  @override
  MetaData map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return MetaData(
      key: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}key'],
      )!,
      value: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}value'],
      )!,
    );
  }

  @override
  $MetaTable createAlias(String alias) {
    return $MetaTable(attachedDatabase, alias);
  }
}

class MetaData extends DataClass implements Insertable<MetaData> {
  final String key;
  final String value;
  const MetaData({required this.key, required this.value});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['key'] = Variable<String>(key);
    map['value'] = Variable<String>(value);
    return map;
  }

  MetaCompanion toCompanion(bool nullToAbsent) {
    return MetaCompanion(key: Value(key), value: Value(value));
  }

  factory MetaData.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return MetaData(
      key: serializer.fromJson<String>(json['key']),
      value: serializer.fromJson<String>(json['value']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'key': serializer.toJson<String>(key),
      'value': serializer.toJson<String>(value),
    };
  }

  MetaData copyWith({String? key, String? value}) =>
      MetaData(key: key ?? this.key, value: value ?? this.value);
  MetaData copyWithCompanion(MetaCompanion data) {
    return MetaData(
      key: data.key.present ? data.key.value : this.key,
      value: data.value.present ? data.value.value : this.value,
    );
  }

  @override
  String toString() {
    return (StringBuffer('MetaData(')
          ..write('key: $key, ')
          ..write('value: $value')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(key, value);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is MetaData && other.key == this.key && other.value == this.value);
}

class MetaCompanion extends UpdateCompanion<MetaData> {
  final Value<String> key;
  final Value<String> value;
  final Value<int> rowid;
  const MetaCompanion({
    this.key = const Value.absent(),
    this.value = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  MetaCompanion.insert({
    required String key,
    required String value,
    this.rowid = const Value.absent(),
  }) : key = Value(key),
       value = Value(value);
  static Insertable<MetaData> custom({
    Expression<String>? key,
    Expression<String>? value,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (key != null) 'key': key,
      if (value != null) 'value': value,
      if (rowid != null) 'rowid': rowid,
    });
  }

  MetaCompanion copyWith({
    Value<String>? key,
    Value<String>? value,
    Value<int>? rowid,
  }) {
    return MetaCompanion(
      key: key ?? this.key,
      value: value ?? this.value,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (key.present) {
      map['key'] = Variable<String>(key.value);
    }
    if (value.present) {
      map['value'] = Variable<String>(value.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('MetaCompanion(')
          ..write('key: $key, ')
          ..write('value: $value, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $PendingUploadsTable extends PendingUploads
    with TableInfo<$PendingUploadsTable, PendingUpload> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $PendingUploadsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
    'id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _patientLocalIdMeta = const VerificationMeta(
    'patientLocalId',
  );
  @override
  late final GeneratedColumn<String> patientLocalId = GeneratedColumn<String>(
    'patient_local_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _patientServerIdMeta = const VerificationMeta(
    'patientServerId',
  );
  @override
  late final GeneratedColumn<String> patientServerId = GeneratedColumn<String>(
    'patient_server_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _kindMeta = const VerificationMeta('kind');
  @override
  late final GeneratedColumn<String> kind = GeneratedColumn<String>(
    'kind',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _modalityMeta = const VerificationMeta(
    'modality',
  );
  @override
  late final GeneratedColumn<String> modality = GeneratedColumn<String>(
    'modality',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _slideFormatMeta = const VerificationMeta(
    'slideFormat',
  );
  @override
  late final GeneratedColumn<String> slideFormat = GeneratedColumn<String>(
    'slide_format',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _stainMeta = const VerificationMeta('stain');
  @override
  late final GeneratedColumn<String> stain = GeneratedColumn<String>(
    'stain',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _filePathMeta = const VerificationMeta(
    'filePath',
  );
  @override
  late final GeneratedColumn<String> filePath = GeneratedColumn<String>(
    'file_path',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _fileNameMeta = const VerificationMeta(
    'fileName',
  );
  @override
  late final GeneratedColumn<String> fileName = GeneratedColumn<String>(
    'file_name',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _sizeBytesMeta = const VerificationMeta(
    'sizeBytes',
  );
  @override
  late final GeneratedColumn<int> sizeBytes = GeneratedColumn<int>(
    'size_bytes',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _statusMeta = const VerificationMeta('status');
  @override
  late final GeneratedColumn<String> status = GeneratedColumn<String>(
    'status',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant('pending'),
  );
  static const VerificationMeta _attemptsMeta = const VerificationMeta(
    'attempts',
  );
  @override
  late final GeneratedColumn<int> attempts = GeneratedColumn<int>(
    'attempts',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(0),
  );
  static const VerificationMeta _nextAttemptAtMeta = const VerificationMeta(
    'nextAttemptAt',
  );
  @override
  late final GeneratedColumn<DateTime> nextAttemptAt =
      GeneratedColumn<DateTime>(
        'next_attempt_at',
        aliasedName,
        true,
        type: DriftSqlType.dateTime,
        requiredDuringInsert: false,
      );
  static const VerificationMeta _lastErrorMeta = const VerificationMeta(
    'lastError',
  );
  @override
  late final GeneratedColumn<String> lastError = GeneratedColumn<String>(
    'last_error',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _createdAtMeta = const VerificationMeta(
    'createdAt',
  );
  @override
  late final GeneratedColumn<DateTime> createdAt = GeneratedColumn<DateTime>(
    'created_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [
    id,
    patientLocalId,
    patientServerId,
    kind,
    modality,
    slideFormat,
    stain,
    filePath,
    fileName,
    sizeBytes,
    status,
    attempts,
    nextAttemptAt,
    lastError,
    createdAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'pending_uploads';
  @override
  VerificationContext validateIntegrity(
    Insertable<PendingUpload> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('patient_local_id')) {
      context.handle(
        _patientLocalIdMeta,
        patientLocalId.isAcceptableOrUnknown(
          data['patient_local_id']!,
          _patientLocalIdMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_patientLocalIdMeta);
    }
    if (data.containsKey('patient_server_id')) {
      context.handle(
        _patientServerIdMeta,
        patientServerId.isAcceptableOrUnknown(
          data['patient_server_id']!,
          _patientServerIdMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_patientServerIdMeta);
    }
    if (data.containsKey('kind')) {
      context.handle(
        _kindMeta,
        kind.isAcceptableOrUnknown(data['kind']!, _kindMeta),
      );
    } else if (isInserting) {
      context.missing(_kindMeta);
    }
    if (data.containsKey('modality')) {
      context.handle(
        _modalityMeta,
        modality.isAcceptableOrUnknown(data['modality']!, _modalityMeta),
      );
    }
    if (data.containsKey('slide_format')) {
      context.handle(
        _slideFormatMeta,
        slideFormat.isAcceptableOrUnknown(
          data['slide_format']!,
          _slideFormatMeta,
        ),
      );
    }
    if (data.containsKey('stain')) {
      context.handle(
        _stainMeta,
        stain.isAcceptableOrUnknown(data['stain']!, _stainMeta),
      );
    }
    if (data.containsKey('file_path')) {
      context.handle(
        _filePathMeta,
        filePath.isAcceptableOrUnknown(data['file_path']!, _filePathMeta),
      );
    } else if (isInserting) {
      context.missing(_filePathMeta);
    }
    if (data.containsKey('file_name')) {
      context.handle(
        _fileNameMeta,
        fileName.isAcceptableOrUnknown(data['file_name']!, _fileNameMeta),
      );
    } else if (isInserting) {
      context.missing(_fileNameMeta);
    }
    if (data.containsKey('size_bytes')) {
      context.handle(
        _sizeBytesMeta,
        sizeBytes.isAcceptableOrUnknown(data['size_bytes']!, _sizeBytesMeta),
      );
    } else if (isInserting) {
      context.missing(_sizeBytesMeta);
    }
    if (data.containsKey('status')) {
      context.handle(
        _statusMeta,
        status.isAcceptableOrUnknown(data['status']!, _statusMeta),
      );
    }
    if (data.containsKey('attempts')) {
      context.handle(
        _attemptsMeta,
        attempts.isAcceptableOrUnknown(data['attempts']!, _attemptsMeta),
      );
    }
    if (data.containsKey('next_attempt_at')) {
      context.handle(
        _nextAttemptAtMeta,
        nextAttemptAt.isAcceptableOrUnknown(
          data['next_attempt_at']!,
          _nextAttemptAtMeta,
        ),
      );
    }
    if (data.containsKey('last_error')) {
      context.handle(
        _lastErrorMeta,
        lastError.isAcceptableOrUnknown(data['last_error']!, _lastErrorMeta),
      );
    }
    if (data.containsKey('created_at')) {
      context.handle(
        _createdAtMeta,
        createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta),
      );
    } else if (isInserting) {
      context.missing(_createdAtMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  PendingUpload map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return PendingUpload(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}id'],
      )!,
      patientLocalId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}patient_local_id'],
      )!,
      patientServerId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}patient_server_id'],
      )!,
      kind: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}kind'],
      )!,
      modality: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}modality'],
      ),
      slideFormat: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}slide_format'],
      ),
      stain: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}stain'],
      ),
      filePath: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}file_path'],
      )!,
      fileName: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}file_name'],
      )!,
      sizeBytes: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}size_bytes'],
      )!,
      status: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}status'],
      )!,
      attempts: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}attempts'],
      )!,
      nextAttemptAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}next_attempt_at'],
      ),
      lastError: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}last_error'],
      ),
      createdAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}created_at'],
      )!,
    );
  }

  @override
  $PendingUploadsTable createAlias(String alias) {
    return $PendingUploadsTable(attachedDatabase, alias);
  }
}

class PendingUpload extends DataClass implements Insertable<PendingUpload> {
  /// Also sent as the upload's `clientUuid`, so a retry never duplicates.
  final String id;
  final String patientLocalId;
  final String patientServerId;

  /// imaging | slide
  final String kind;
  final String? modality;
  final String? slideFormat;
  final String? stain;
  final String filePath;
  final String fileName;
  final int sizeBytes;

  /// pending | uploading | rejected
  final String status;
  final int attempts;
  final DateTime? nextAttemptAt;
  final String? lastError;
  final DateTime createdAt;
  const PendingUpload({
    required this.id,
    required this.patientLocalId,
    required this.patientServerId,
    required this.kind,
    this.modality,
    this.slideFormat,
    this.stain,
    required this.filePath,
    required this.fileName,
    required this.sizeBytes,
    required this.status,
    required this.attempts,
    this.nextAttemptAt,
    this.lastError,
    required this.createdAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['patient_local_id'] = Variable<String>(patientLocalId);
    map['patient_server_id'] = Variable<String>(patientServerId);
    map['kind'] = Variable<String>(kind);
    if (!nullToAbsent || modality != null) {
      map['modality'] = Variable<String>(modality);
    }
    if (!nullToAbsent || slideFormat != null) {
      map['slide_format'] = Variable<String>(slideFormat);
    }
    if (!nullToAbsent || stain != null) {
      map['stain'] = Variable<String>(stain);
    }
    map['file_path'] = Variable<String>(filePath);
    map['file_name'] = Variable<String>(fileName);
    map['size_bytes'] = Variable<int>(sizeBytes);
    map['status'] = Variable<String>(status);
    map['attempts'] = Variable<int>(attempts);
    if (!nullToAbsent || nextAttemptAt != null) {
      map['next_attempt_at'] = Variable<DateTime>(nextAttemptAt);
    }
    if (!nullToAbsent || lastError != null) {
      map['last_error'] = Variable<String>(lastError);
    }
    map['created_at'] = Variable<DateTime>(createdAt);
    return map;
  }

  PendingUploadsCompanion toCompanion(bool nullToAbsent) {
    return PendingUploadsCompanion(
      id: Value(id),
      patientLocalId: Value(patientLocalId),
      patientServerId: Value(patientServerId),
      kind: Value(kind),
      modality: modality == null && nullToAbsent
          ? const Value.absent()
          : Value(modality),
      slideFormat: slideFormat == null && nullToAbsent
          ? const Value.absent()
          : Value(slideFormat),
      stain: stain == null && nullToAbsent
          ? const Value.absent()
          : Value(stain),
      filePath: Value(filePath),
      fileName: Value(fileName),
      sizeBytes: Value(sizeBytes),
      status: Value(status),
      attempts: Value(attempts),
      nextAttemptAt: nextAttemptAt == null && nullToAbsent
          ? const Value.absent()
          : Value(nextAttemptAt),
      lastError: lastError == null && nullToAbsent
          ? const Value.absent()
          : Value(lastError),
      createdAt: Value(createdAt),
    );
  }

  factory PendingUpload.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return PendingUpload(
      id: serializer.fromJson<String>(json['id']),
      patientLocalId: serializer.fromJson<String>(json['patientLocalId']),
      patientServerId: serializer.fromJson<String>(json['patientServerId']),
      kind: serializer.fromJson<String>(json['kind']),
      modality: serializer.fromJson<String?>(json['modality']),
      slideFormat: serializer.fromJson<String?>(json['slideFormat']),
      stain: serializer.fromJson<String?>(json['stain']),
      filePath: serializer.fromJson<String>(json['filePath']),
      fileName: serializer.fromJson<String>(json['fileName']),
      sizeBytes: serializer.fromJson<int>(json['sizeBytes']),
      status: serializer.fromJson<String>(json['status']),
      attempts: serializer.fromJson<int>(json['attempts']),
      nextAttemptAt: serializer.fromJson<DateTime?>(json['nextAttemptAt']),
      lastError: serializer.fromJson<String?>(json['lastError']),
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'patientLocalId': serializer.toJson<String>(patientLocalId),
      'patientServerId': serializer.toJson<String>(patientServerId),
      'kind': serializer.toJson<String>(kind),
      'modality': serializer.toJson<String?>(modality),
      'slideFormat': serializer.toJson<String?>(slideFormat),
      'stain': serializer.toJson<String?>(stain),
      'filePath': serializer.toJson<String>(filePath),
      'fileName': serializer.toJson<String>(fileName),
      'sizeBytes': serializer.toJson<int>(sizeBytes),
      'status': serializer.toJson<String>(status),
      'attempts': serializer.toJson<int>(attempts),
      'nextAttemptAt': serializer.toJson<DateTime?>(nextAttemptAt),
      'lastError': serializer.toJson<String?>(lastError),
      'createdAt': serializer.toJson<DateTime>(createdAt),
    };
  }

  PendingUpload copyWith({
    String? id,
    String? patientLocalId,
    String? patientServerId,
    String? kind,
    Value<String?> modality = const Value.absent(),
    Value<String?> slideFormat = const Value.absent(),
    Value<String?> stain = const Value.absent(),
    String? filePath,
    String? fileName,
    int? sizeBytes,
    String? status,
    int? attempts,
    Value<DateTime?> nextAttemptAt = const Value.absent(),
    Value<String?> lastError = const Value.absent(),
    DateTime? createdAt,
  }) => PendingUpload(
    id: id ?? this.id,
    patientLocalId: patientLocalId ?? this.patientLocalId,
    patientServerId: patientServerId ?? this.patientServerId,
    kind: kind ?? this.kind,
    modality: modality.present ? modality.value : this.modality,
    slideFormat: slideFormat.present ? slideFormat.value : this.slideFormat,
    stain: stain.present ? stain.value : this.stain,
    filePath: filePath ?? this.filePath,
    fileName: fileName ?? this.fileName,
    sizeBytes: sizeBytes ?? this.sizeBytes,
    status: status ?? this.status,
    attempts: attempts ?? this.attempts,
    nextAttemptAt: nextAttemptAt.present
        ? nextAttemptAt.value
        : this.nextAttemptAt,
    lastError: lastError.present ? lastError.value : this.lastError,
    createdAt: createdAt ?? this.createdAt,
  );
  PendingUpload copyWithCompanion(PendingUploadsCompanion data) {
    return PendingUpload(
      id: data.id.present ? data.id.value : this.id,
      patientLocalId: data.patientLocalId.present
          ? data.patientLocalId.value
          : this.patientLocalId,
      patientServerId: data.patientServerId.present
          ? data.patientServerId.value
          : this.patientServerId,
      kind: data.kind.present ? data.kind.value : this.kind,
      modality: data.modality.present ? data.modality.value : this.modality,
      slideFormat: data.slideFormat.present
          ? data.slideFormat.value
          : this.slideFormat,
      stain: data.stain.present ? data.stain.value : this.stain,
      filePath: data.filePath.present ? data.filePath.value : this.filePath,
      fileName: data.fileName.present ? data.fileName.value : this.fileName,
      sizeBytes: data.sizeBytes.present ? data.sizeBytes.value : this.sizeBytes,
      status: data.status.present ? data.status.value : this.status,
      attempts: data.attempts.present ? data.attempts.value : this.attempts,
      nextAttemptAt: data.nextAttemptAt.present
          ? data.nextAttemptAt.value
          : this.nextAttemptAt,
      lastError: data.lastError.present ? data.lastError.value : this.lastError,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('PendingUpload(')
          ..write('id: $id, ')
          ..write('patientLocalId: $patientLocalId, ')
          ..write('patientServerId: $patientServerId, ')
          ..write('kind: $kind, ')
          ..write('modality: $modality, ')
          ..write('slideFormat: $slideFormat, ')
          ..write('stain: $stain, ')
          ..write('filePath: $filePath, ')
          ..write('fileName: $fileName, ')
          ..write('sizeBytes: $sizeBytes, ')
          ..write('status: $status, ')
          ..write('attempts: $attempts, ')
          ..write('nextAttemptAt: $nextAttemptAt, ')
          ..write('lastError: $lastError, ')
          ..write('createdAt: $createdAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    id,
    patientLocalId,
    patientServerId,
    kind,
    modality,
    slideFormat,
    stain,
    filePath,
    fileName,
    sizeBytes,
    status,
    attempts,
    nextAttemptAt,
    lastError,
    createdAt,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is PendingUpload &&
          other.id == this.id &&
          other.patientLocalId == this.patientLocalId &&
          other.patientServerId == this.patientServerId &&
          other.kind == this.kind &&
          other.modality == this.modality &&
          other.slideFormat == this.slideFormat &&
          other.stain == this.stain &&
          other.filePath == this.filePath &&
          other.fileName == this.fileName &&
          other.sizeBytes == this.sizeBytes &&
          other.status == this.status &&
          other.attempts == this.attempts &&
          other.nextAttemptAt == this.nextAttemptAt &&
          other.lastError == this.lastError &&
          other.createdAt == this.createdAt);
}

class PendingUploadsCompanion extends UpdateCompanion<PendingUpload> {
  final Value<String> id;
  final Value<String> patientLocalId;
  final Value<String> patientServerId;
  final Value<String> kind;
  final Value<String?> modality;
  final Value<String?> slideFormat;
  final Value<String?> stain;
  final Value<String> filePath;
  final Value<String> fileName;
  final Value<int> sizeBytes;
  final Value<String> status;
  final Value<int> attempts;
  final Value<DateTime?> nextAttemptAt;
  final Value<String?> lastError;
  final Value<DateTime> createdAt;
  final Value<int> rowid;
  const PendingUploadsCompanion({
    this.id = const Value.absent(),
    this.patientLocalId = const Value.absent(),
    this.patientServerId = const Value.absent(),
    this.kind = const Value.absent(),
    this.modality = const Value.absent(),
    this.slideFormat = const Value.absent(),
    this.stain = const Value.absent(),
    this.filePath = const Value.absent(),
    this.fileName = const Value.absent(),
    this.sizeBytes = const Value.absent(),
    this.status = const Value.absent(),
    this.attempts = const Value.absent(),
    this.nextAttemptAt = const Value.absent(),
    this.lastError = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  PendingUploadsCompanion.insert({
    required String id,
    required String patientLocalId,
    required String patientServerId,
    required String kind,
    this.modality = const Value.absent(),
    this.slideFormat = const Value.absent(),
    this.stain = const Value.absent(),
    required String filePath,
    required String fileName,
    required int sizeBytes,
    this.status = const Value.absent(),
    this.attempts = const Value.absent(),
    this.nextAttemptAt = const Value.absent(),
    this.lastError = const Value.absent(),
    required DateTime createdAt,
    this.rowid = const Value.absent(),
  }) : id = Value(id),
       patientLocalId = Value(patientLocalId),
       patientServerId = Value(patientServerId),
       kind = Value(kind),
       filePath = Value(filePath),
       fileName = Value(fileName),
       sizeBytes = Value(sizeBytes),
       createdAt = Value(createdAt);
  static Insertable<PendingUpload> custom({
    Expression<String>? id,
    Expression<String>? patientLocalId,
    Expression<String>? patientServerId,
    Expression<String>? kind,
    Expression<String>? modality,
    Expression<String>? slideFormat,
    Expression<String>? stain,
    Expression<String>? filePath,
    Expression<String>? fileName,
    Expression<int>? sizeBytes,
    Expression<String>? status,
    Expression<int>? attempts,
    Expression<DateTime>? nextAttemptAt,
    Expression<String>? lastError,
    Expression<DateTime>? createdAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (patientLocalId != null) 'patient_local_id': patientLocalId,
      if (patientServerId != null) 'patient_server_id': patientServerId,
      if (kind != null) 'kind': kind,
      if (modality != null) 'modality': modality,
      if (slideFormat != null) 'slide_format': slideFormat,
      if (stain != null) 'stain': stain,
      if (filePath != null) 'file_path': filePath,
      if (fileName != null) 'file_name': fileName,
      if (sizeBytes != null) 'size_bytes': sizeBytes,
      if (status != null) 'status': status,
      if (attempts != null) 'attempts': attempts,
      if (nextAttemptAt != null) 'next_attempt_at': nextAttemptAt,
      if (lastError != null) 'last_error': lastError,
      if (createdAt != null) 'created_at': createdAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  PendingUploadsCompanion copyWith({
    Value<String>? id,
    Value<String>? patientLocalId,
    Value<String>? patientServerId,
    Value<String>? kind,
    Value<String?>? modality,
    Value<String?>? slideFormat,
    Value<String?>? stain,
    Value<String>? filePath,
    Value<String>? fileName,
    Value<int>? sizeBytes,
    Value<String>? status,
    Value<int>? attempts,
    Value<DateTime?>? nextAttemptAt,
    Value<String?>? lastError,
    Value<DateTime>? createdAt,
    Value<int>? rowid,
  }) {
    return PendingUploadsCompanion(
      id: id ?? this.id,
      patientLocalId: patientLocalId ?? this.patientLocalId,
      patientServerId: patientServerId ?? this.patientServerId,
      kind: kind ?? this.kind,
      modality: modality ?? this.modality,
      slideFormat: slideFormat ?? this.slideFormat,
      stain: stain ?? this.stain,
      filePath: filePath ?? this.filePath,
      fileName: fileName ?? this.fileName,
      sizeBytes: sizeBytes ?? this.sizeBytes,
      status: status ?? this.status,
      attempts: attempts ?? this.attempts,
      nextAttemptAt: nextAttemptAt ?? this.nextAttemptAt,
      lastError: lastError ?? this.lastError,
      createdAt: createdAt ?? this.createdAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (patientLocalId.present) {
      map['patient_local_id'] = Variable<String>(patientLocalId.value);
    }
    if (patientServerId.present) {
      map['patient_server_id'] = Variable<String>(patientServerId.value);
    }
    if (kind.present) {
      map['kind'] = Variable<String>(kind.value);
    }
    if (modality.present) {
      map['modality'] = Variable<String>(modality.value);
    }
    if (slideFormat.present) {
      map['slide_format'] = Variable<String>(slideFormat.value);
    }
    if (stain.present) {
      map['stain'] = Variable<String>(stain.value);
    }
    if (filePath.present) {
      map['file_path'] = Variable<String>(filePath.value);
    }
    if (fileName.present) {
      map['file_name'] = Variable<String>(fileName.value);
    }
    if (sizeBytes.present) {
      map['size_bytes'] = Variable<int>(sizeBytes.value);
    }
    if (status.present) {
      map['status'] = Variable<String>(status.value);
    }
    if (attempts.present) {
      map['attempts'] = Variable<int>(attempts.value);
    }
    if (nextAttemptAt.present) {
      map['next_attempt_at'] = Variable<DateTime>(nextAttemptAt.value);
    }
    if (lastError.present) {
      map['last_error'] = Variable<String>(lastError.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<DateTime>(createdAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('PendingUploadsCompanion(')
          ..write('id: $id, ')
          ..write('patientLocalId: $patientLocalId, ')
          ..write('patientServerId: $patientServerId, ')
          ..write('kind: $kind, ')
          ..write('modality: $modality, ')
          ..write('slideFormat: $slideFormat, ')
          ..write('stain: $stain, ')
          ..write('filePath: $filePath, ')
          ..write('fileName: $fileName, ')
          ..write('sizeBytes: $sizeBytes, ')
          ..write('status: $status, ')
          ..write('attempts: $attempts, ')
          ..write('nextAttemptAt: $nextAttemptAt, ')
          ..write('lastError: $lastError, ')
          ..write('createdAt: $createdAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

abstract class _$AppDatabase extends GeneratedDatabase {
  _$AppDatabase(QueryExecutor e) : super(e);
  $AppDatabaseManager get managers => $AppDatabaseManager(this);
  late final $LocalPatientsTable localPatients = $LocalPatientsTable(this);
  late final $LocalClinicalRecordsTable localClinicalRecords =
      $LocalClinicalRecordsTable(this);
  late final $OutboxTable outbox = $OutboxTable(this);
  late final $SyncConflictsTable syncConflicts = $SyncConflictsTable(this);
  late final $MetaTable meta = $MetaTable(this);
  late final $PendingUploadsTable pendingUploads = $PendingUploadsTable(this);
  @override
  Iterable<TableInfo<Table, Object?>> get allTables =>
      allSchemaEntities.whereType<TableInfo<Table, Object?>>();
  @override
  List<DatabaseSchemaEntity> get allSchemaEntities => [
    localPatients,
    localClinicalRecords,
    outbox,
    syncConflicts,
    meta,
    pendingUploads,
  ];
}

typedef $$LocalPatientsTableCreateCompanionBuilder =
    LocalPatientsCompanion Function({
      required String id,
      Value<String?> serverId,
      Value<String?> mrn,
      required String givenName,
      required String familyName,
      required String dateOfBirth,
      required String regionClass,
      Value<String?> district,
      Value<String?> phone,
      Value<String?> nationalIdMasked,
      Value<int> version,
      required String syncState,
      required DateTime updatedAt,
      Value<int> rowid,
    });
typedef $$LocalPatientsTableUpdateCompanionBuilder =
    LocalPatientsCompanion Function({
      Value<String> id,
      Value<String?> serverId,
      Value<String?> mrn,
      Value<String> givenName,
      Value<String> familyName,
      Value<String> dateOfBirth,
      Value<String> regionClass,
      Value<String?> district,
      Value<String?> phone,
      Value<String?> nationalIdMasked,
      Value<int> version,
      Value<String> syncState,
      Value<DateTime> updatedAt,
      Value<int> rowid,
    });

class $$LocalPatientsTableFilterComposer
    extends Composer<_$AppDatabase, $LocalPatientsTable> {
  $$LocalPatientsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get serverId => $composableBuilder(
    column: $table.serverId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get mrn => $composableBuilder(
    column: $table.mrn,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get givenName => $composableBuilder(
    column: $table.givenName,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get familyName => $composableBuilder(
    column: $table.familyName,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get dateOfBirth => $composableBuilder(
    column: $table.dateOfBirth,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get regionClass => $composableBuilder(
    column: $table.regionClass,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get district => $composableBuilder(
    column: $table.district,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get phone => $composableBuilder(
    column: $table.phone,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get nationalIdMasked => $composableBuilder(
    column: $table.nationalIdMasked,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get version => $composableBuilder(
    column: $table.version,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get syncState => $composableBuilder(
    column: $table.syncState,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get updatedAt => $composableBuilder(
    column: $table.updatedAt,
    builder: (column) => ColumnFilters(column),
  );
}

class $$LocalPatientsTableOrderingComposer
    extends Composer<_$AppDatabase, $LocalPatientsTable> {
  $$LocalPatientsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get serverId => $composableBuilder(
    column: $table.serverId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get mrn => $composableBuilder(
    column: $table.mrn,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get givenName => $composableBuilder(
    column: $table.givenName,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get familyName => $composableBuilder(
    column: $table.familyName,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get dateOfBirth => $composableBuilder(
    column: $table.dateOfBirth,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get regionClass => $composableBuilder(
    column: $table.regionClass,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get district => $composableBuilder(
    column: $table.district,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get phone => $composableBuilder(
    column: $table.phone,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get nationalIdMasked => $composableBuilder(
    column: $table.nationalIdMasked,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get version => $composableBuilder(
    column: $table.version,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get syncState => $composableBuilder(
    column: $table.syncState,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get updatedAt => $composableBuilder(
    column: $table.updatedAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$LocalPatientsTableAnnotationComposer
    extends Composer<_$AppDatabase, $LocalPatientsTable> {
  $$LocalPatientsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get serverId =>
      $composableBuilder(column: $table.serverId, builder: (column) => column);

  GeneratedColumn<String> get mrn =>
      $composableBuilder(column: $table.mrn, builder: (column) => column);

  GeneratedColumn<String> get givenName =>
      $composableBuilder(column: $table.givenName, builder: (column) => column);

  GeneratedColumn<String> get familyName => $composableBuilder(
    column: $table.familyName,
    builder: (column) => column,
  );

  GeneratedColumn<String> get dateOfBirth => $composableBuilder(
    column: $table.dateOfBirth,
    builder: (column) => column,
  );

  GeneratedColumn<String> get regionClass => $composableBuilder(
    column: $table.regionClass,
    builder: (column) => column,
  );

  GeneratedColumn<String> get district =>
      $composableBuilder(column: $table.district, builder: (column) => column);

  GeneratedColumn<String> get phone =>
      $composableBuilder(column: $table.phone, builder: (column) => column);

  GeneratedColumn<String> get nationalIdMasked => $composableBuilder(
    column: $table.nationalIdMasked,
    builder: (column) => column,
  );

  GeneratedColumn<int> get version =>
      $composableBuilder(column: $table.version, builder: (column) => column);

  GeneratedColumn<String> get syncState =>
      $composableBuilder(column: $table.syncState, builder: (column) => column);

  GeneratedColumn<DateTime> get updatedAt =>
      $composableBuilder(column: $table.updatedAt, builder: (column) => column);
}

class $$LocalPatientsTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $LocalPatientsTable,
          LocalPatient,
          $$LocalPatientsTableFilterComposer,
          $$LocalPatientsTableOrderingComposer,
          $$LocalPatientsTableAnnotationComposer,
          $$LocalPatientsTableCreateCompanionBuilder,
          $$LocalPatientsTableUpdateCompanionBuilder,
          (
            LocalPatient,
            BaseReferences<_$AppDatabase, $LocalPatientsTable, LocalPatient>,
          ),
          LocalPatient,
          PrefetchHooks Function()
        > {
  $$LocalPatientsTableTableManager(_$AppDatabase db, $LocalPatientsTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$LocalPatientsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$LocalPatientsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$LocalPatientsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> id = const Value.absent(),
                Value<String?> serverId = const Value.absent(),
                Value<String?> mrn = const Value.absent(),
                Value<String> givenName = const Value.absent(),
                Value<String> familyName = const Value.absent(),
                Value<String> dateOfBirth = const Value.absent(),
                Value<String> regionClass = const Value.absent(),
                Value<String?> district = const Value.absent(),
                Value<String?> phone = const Value.absent(),
                Value<String?> nationalIdMasked = const Value.absent(),
                Value<int> version = const Value.absent(),
                Value<String> syncState = const Value.absent(),
                Value<DateTime> updatedAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => LocalPatientsCompanion(
                id: id,
                serverId: serverId,
                mrn: mrn,
                givenName: givenName,
                familyName: familyName,
                dateOfBirth: dateOfBirth,
                regionClass: regionClass,
                district: district,
                phone: phone,
                nationalIdMasked: nationalIdMasked,
                version: version,
                syncState: syncState,
                updatedAt: updatedAt,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String id,
                Value<String?> serverId = const Value.absent(),
                Value<String?> mrn = const Value.absent(),
                required String givenName,
                required String familyName,
                required String dateOfBirth,
                required String regionClass,
                Value<String?> district = const Value.absent(),
                Value<String?> phone = const Value.absent(),
                Value<String?> nationalIdMasked = const Value.absent(),
                Value<int> version = const Value.absent(),
                required String syncState,
                required DateTime updatedAt,
                Value<int> rowid = const Value.absent(),
              }) => LocalPatientsCompanion.insert(
                id: id,
                serverId: serverId,
                mrn: mrn,
                givenName: givenName,
                familyName: familyName,
                dateOfBirth: dateOfBirth,
                regionClass: regionClass,
                district: district,
                phone: phone,
                nationalIdMasked: nationalIdMasked,
                version: version,
                syncState: syncState,
                updatedAt: updatedAt,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$LocalPatientsTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $LocalPatientsTable,
      LocalPatient,
      $$LocalPatientsTableFilterComposer,
      $$LocalPatientsTableOrderingComposer,
      $$LocalPatientsTableAnnotationComposer,
      $$LocalPatientsTableCreateCompanionBuilder,
      $$LocalPatientsTableUpdateCompanionBuilder,
      (
        LocalPatient,
        BaseReferences<_$AppDatabase, $LocalPatientsTable, LocalPatient>,
      ),
      LocalPatient,
      PrefetchHooks Function()
    >;
typedef $$LocalClinicalRecordsTableCreateCompanionBuilder =
    LocalClinicalRecordsCompanion Function({
      required String id,
      Value<String?> serverId,
      required String patientId,
      Value<String?> patientServerId,
      required String encounterDate,
      Value<double?> psaNgMl,
      Value<double?> freePsaNgMl,
      required String dreFinding,
      Value<int?> piradsScore,
      Value<double?> prostateVolumeMl,
      Value<String?> notes,
      required String syncState,
      required DateTime createdAt,
      Value<int> rowid,
    });
typedef $$LocalClinicalRecordsTableUpdateCompanionBuilder =
    LocalClinicalRecordsCompanion Function({
      Value<String> id,
      Value<String?> serverId,
      Value<String> patientId,
      Value<String?> patientServerId,
      Value<String> encounterDate,
      Value<double?> psaNgMl,
      Value<double?> freePsaNgMl,
      Value<String> dreFinding,
      Value<int?> piradsScore,
      Value<double?> prostateVolumeMl,
      Value<String?> notes,
      Value<String> syncState,
      Value<DateTime> createdAt,
      Value<int> rowid,
    });

class $$LocalClinicalRecordsTableFilterComposer
    extends Composer<_$AppDatabase, $LocalClinicalRecordsTable> {
  $$LocalClinicalRecordsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get serverId => $composableBuilder(
    column: $table.serverId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get patientId => $composableBuilder(
    column: $table.patientId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get patientServerId => $composableBuilder(
    column: $table.patientServerId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get encounterDate => $composableBuilder(
    column: $table.encounterDate,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<double> get psaNgMl => $composableBuilder(
    column: $table.psaNgMl,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<double> get freePsaNgMl => $composableBuilder(
    column: $table.freePsaNgMl,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get dreFinding => $composableBuilder(
    column: $table.dreFinding,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get piradsScore => $composableBuilder(
    column: $table.piradsScore,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<double> get prostateVolumeMl => $composableBuilder(
    column: $table.prostateVolumeMl,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get notes => $composableBuilder(
    column: $table.notes,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get syncState => $composableBuilder(
    column: $table.syncState,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnFilters(column),
  );
}

class $$LocalClinicalRecordsTableOrderingComposer
    extends Composer<_$AppDatabase, $LocalClinicalRecordsTable> {
  $$LocalClinicalRecordsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get serverId => $composableBuilder(
    column: $table.serverId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get patientId => $composableBuilder(
    column: $table.patientId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get patientServerId => $composableBuilder(
    column: $table.patientServerId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get encounterDate => $composableBuilder(
    column: $table.encounterDate,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<double> get psaNgMl => $composableBuilder(
    column: $table.psaNgMl,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<double> get freePsaNgMl => $composableBuilder(
    column: $table.freePsaNgMl,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get dreFinding => $composableBuilder(
    column: $table.dreFinding,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get piradsScore => $composableBuilder(
    column: $table.piradsScore,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<double> get prostateVolumeMl => $composableBuilder(
    column: $table.prostateVolumeMl,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get notes => $composableBuilder(
    column: $table.notes,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get syncState => $composableBuilder(
    column: $table.syncState,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$LocalClinicalRecordsTableAnnotationComposer
    extends Composer<_$AppDatabase, $LocalClinicalRecordsTable> {
  $$LocalClinicalRecordsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get serverId =>
      $composableBuilder(column: $table.serverId, builder: (column) => column);

  GeneratedColumn<String> get patientId =>
      $composableBuilder(column: $table.patientId, builder: (column) => column);

  GeneratedColumn<String> get patientServerId => $composableBuilder(
    column: $table.patientServerId,
    builder: (column) => column,
  );

  GeneratedColumn<String> get encounterDate => $composableBuilder(
    column: $table.encounterDate,
    builder: (column) => column,
  );

  GeneratedColumn<double> get psaNgMl =>
      $composableBuilder(column: $table.psaNgMl, builder: (column) => column);

  GeneratedColumn<double> get freePsaNgMl => $composableBuilder(
    column: $table.freePsaNgMl,
    builder: (column) => column,
  );

  GeneratedColumn<String> get dreFinding => $composableBuilder(
    column: $table.dreFinding,
    builder: (column) => column,
  );

  GeneratedColumn<int> get piradsScore => $composableBuilder(
    column: $table.piradsScore,
    builder: (column) => column,
  );

  GeneratedColumn<double> get prostateVolumeMl => $composableBuilder(
    column: $table.prostateVolumeMl,
    builder: (column) => column,
  );

  GeneratedColumn<String> get notes =>
      $composableBuilder(column: $table.notes, builder: (column) => column);

  GeneratedColumn<String> get syncState =>
      $composableBuilder(column: $table.syncState, builder: (column) => column);

  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);
}

class $$LocalClinicalRecordsTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $LocalClinicalRecordsTable,
          LocalClinicalRecord,
          $$LocalClinicalRecordsTableFilterComposer,
          $$LocalClinicalRecordsTableOrderingComposer,
          $$LocalClinicalRecordsTableAnnotationComposer,
          $$LocalClinicalRecordsTableCreateCompanionBuilder,
          $$LocalClinicalRecordsTableUpdateCompanionBuilder,
          (
            LocalClinicalRecord,
            BaseReferences<
              _$AppDatabase,
              $LocalClinicalRecordsTable,
              LocalClinicalRecord
            >,
          ),
          LocalClinicalRecord,
          PrefetchHooks Function()
        > {
  $$LocalClinicalRecordsTableTableManager(
    _$AppDatabase db,
    $LocalClinicalRecordsTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$LocalClinicalRecordsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$LocalClinicalRecordsTableOrderingComposer(
                $db: db,
                $table: table,
              ),
          createComputedFieldComposer: () =>
              $$LocalClinicalRecordsTableAnnotationComposer(
                $db: db,
                $table: table,
              ),
          updateCompanionCallback:
              ({
                Value<String> id = const Value.absent(),
                Value<String?> serverId = const Value.absent(),
                Value<String> patientId = const Value.absent(),
                Value<String?> patientServerId = const Value.absent(),
                Value<String> encounterDate = const Value.absent(),
                Value<double?> psaNgMl = const Value.absent(),
                Value<double?> freePsaNgMl = const Value.absent(),
                Value<String> dreFinding = const Value.absent(),
                Value<int?> piradsScore = const Value.absent(),
                Value<double?> prostateVolumeMl = const Value.absent(),
                Value<String?> notes = const Value.absent(),
                Value<String> syncState = const Value.absent(),
                Value<DateTime> createdAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => LocalClinicalRecordsCompanion(
                id: id,
                serverId: serverId,
                patientId: patientId,
                patientServerId: patientServerId,
                encounterDate: encounterDate,
                psaNgMl: psaNgMl,
                freePsaNgMl: freePsaNgMl,
                dreFinding: dreFinding,
                piradsScore: piradsScore,
                prostateVolumeMl: prostateVolumeMl,
                notes: notes,
                syncState: syncState,
                createdAt: createdAt,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String id,
                Value<String?> serverId = const Value.absent(),
                required String patientId,
                Value<String?> patientServerId = const Value.absent(),
                required String encounterDate,
                Value<double?> psaNgMl = const Value.absent(),
                Value<double?> freePsaNgMl = const Value.absent(),
                required String dreFinding,
                Value<int?> piradsScore = const Value.absent(),
                Value<double?> prostateVolumeMl = const Value.absent(),
                Value<String?> notes = const Value.absent(),
                required String syncState,
                required DateTime createdAt,
                Value<int> rowid = const Value.absent(),
              }) => LocalClinicalRecordsCompanion.insert(
                id: id,
                serverId: serverId,
                patientId: patientId,
                patientServerId: patientServerId,
                encounterDate: encounterDate,
                psaNgMl: psaNgMl,
                freePsaNgMl: freePsaNgMl,
                dreFinding: dreFinding,
                piradsScore: piradsScore,
                prostateVolumeMl: prostateVolumeMl,
                notes: notes,
                syncState: syncState,
                createdAt: createdAt,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$LocalClinicalRecordsTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $LocalClinicalRecordsTable,
      LocalClinicalRecord,
      $$LocalClinicalRecordsTableFilterComposer,
      $$LocalClinicalRecordsTableOrderingComposer,
      $$LocalClinicalRecordsTableAnnotationComposer,
      $$LocalClinicalRecordsTableCreateCompanionBuilder,
      $$LocalClinicalRecordsTableUpdateCompanionBuilder,
      (
        LocalClinicalRecord,
        BaseReferences<
          _$AppDatabase,
          $LocalClinicalRecordsTable,
          LocalClinicalRecord
        >,
      ),
      LocalClinicalRecord,
      PrefetchHooks Function()
    >;
typedef $$OutboxTableCreateCompanionBuilder =
    OutboxCompanion Function({
      Value<int> seq,
      required String idempotencyKey,
      required String entityType,
      required String operation,
      required String entityLocalId,
      Value<String?> patientLocalId,
      Value<int?> baseVersion,
      required String payload,
      required DateTime createdAt,
      Value<String> status,
      Value<int> attempts,
      Value<String?> lastErrorCode,
      Value<String?> lastErrorMessage,
    });
typedef $$OutboxTableUpdateCompanionBuilder =
    OutboxCompanion Function({
      Value<int> seq,
      Value<String> idempotencyKey,
      Value<String> entityType,
      Value<String> operation,
      Value<String> entityLocalId,
      Value<String?> patientLocalId,
      Value<int?> baseVersion,
      Value<String> payload,
      Value<DateTime> createdAt,
      Value<String> status,
      Value<int> attempts,
      Value<String?> lastErrorCode,
      Value<String?> lastErrorMessage,
    });

class $$OutboxTableFilterComposer
    extends Composer<_$AppDatabase, $OutboxTable> {
  $$OutboxTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<int> get seq => $composableBuilder(
    column: $table.seq,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get idempotencyKey => $composableBuilder(
    column: $table.idempotencyKey,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get entityType => $composableBuilder(
    column: $table.entityType,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get operation => $composableBuilder(
    column: $table.operation,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get entityLocalId => $composableBuilder(
    column: $table.entityLocalId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get patientLocalId => $composableBuilder(
    column: $table.patientLocalId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get baseVersion => $composableBuilder(
    column: $table.baseVersion,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get payload => $composableBuilder(
    column: $table.payload,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get status => $composableBuilder(
    column: $table.status,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get attempts => $composableBuilder(
    column: $table.attempts,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get lastErrorCode => $composableBuilder(
    column: $table.lastErrorCode,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get lastErrorMessage => $composableBuilder(
    column: $table.lastErrorMessage,
    builder: (column) => ColumnFilters(column),
  );
}

class $$OutboxTableOrderingComposer
    extends Composer<_$AppDatabase, $OutboxTable> {
  $$OutboxTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<int> get seq => $composableBuilder(
    column: $table.seq,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get idempotencyKey => $composableBuilder(
    column: $table.idempotencyKey,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get entityType => $composableBuilder(
    column: $table.entityType,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get operation => $composableBuilder(
    column: $table.operation,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get entityLocalId => $composableBuilder(
    column: $table.entityLocalId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get patientLocalId => $composableBuilder(
    column: $table.patientLocalId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get baseVersion => $composableBuilder(
    column: $table.baseVersion,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get payload => $composableBuilder(
    column: $table.payload,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get status => $composableBuilder(
    column: $table.status,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get attempts => $composableBuilder(
    column: $table.attempts,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get lastErrorCode => $composableBuilder(
    column: $table.lastErrorCode,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get lastErrorMessage => $composableBuilder(
    column: $table.lastErrorMessage,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$OutboxTableAnnotationComposer
    extends Composer<_$AppDatabase, $OutboxTable> {
  $$OutboxTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<int> get seq =>
      $composableBuilder(column: $table.seq, builder: (column) => column);

  GeneratedColumn<String> get idempotencyKey => $composableBuilder(
    column: $table.idempotencyKey,
    builder: (column) => column,
  );

  GeneratedColumn<String> get entityType => $composableBuilder(
    column: $table.entityType,
    builder: (column) => column,
  );

  GeneratedColumn<String> get operation =>
      $composableBuilder(column: $table.operation, builder: (column) => column);

  GeneratedColumn<String> get entityLocalId => $composableBuilder(
    column: $table.entityLocalId,
    builder: (column) => column,
  );

  GeneratedColumn<String> get patientLocalId => $composableBuilder(
    column: $table.patientLocalId,
    builder: (column) => column,
  );

  GeneratedColumn<int> get baseVersion => $composableBuilder(
    column: $table.baseVersion,
    builder: (column) => column,
  );

  GeneratedColumn<String> get payload =>
      $composableBuilder(column: $table.payload, builder: (column) => column);

  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);

  GeneratedColumn<String> get status =>
      $composableBuilder(column: $table.status, builder: (column) => column);

  GeneratedColumn<int> get attempts =>
      $composableBuilder(column: $table.attempts, builder: (column) => column);

  GeneratedColumn<String> get lastErrorCode => $composableBuilder(
    column: $table.lastErrorCode,
    builder: (column) => column,
  );

  GeneratedColumn<String> get lastErrorMessage => $composableBuilder(
    column: $table.lastErrorMessage,
    builder: (column) => column,
  );
}

class $$OutboxTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $OutboxTable,
          OutboxData,
          $$OutboxTableFilterComposer,
          $$OutboxTableOrderingComposer,
          $$OutboxTableAnnotationComposer,
          $$OutboxTableCreateCompanionBuilder,
          $$OutboxTableUpdateCompanionBuilder,
          (OutboxData, BaseReferences<_$AppDatabase, $OutboxTable, OutboxData>),
          OutboxData,
          PrefetchHooks Function()
        > {
  $$OutboxTableTableManager(_$AppDatabase db, $OutboxTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$OutboxTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$OutboxTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$OutboxTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<int> seq = const Value.absent(),
                Value<String> idempotencyKey = const Value.absent(),
                Value<String> entityType = const Value.absent(),
                Value<String> operation = const Value.absent(),
                Value<String> entityLocalId = const Value.absent(),
                Value<String?> patientLocalId = const Value.absent(),
                Value<int?> baseVersion = const Value.absent(),
                Value<String> payload = const Value.absent(),
                Value<DateTime> createdAt = const Value.absent(),
                Value<String> status = const Value.absent(),
                Value<int> attempts = const Value.absent(),
                Value<String?> lastErrorCode = const Value.absent(),
                Value<String?> lastErrorMessage = const Value.absent(),
              }) => OutboxCompanion(
                seq: seq,
                idempotencyKey: idempotencyKey,
                entityType: entityType,
                operation: operation,
                entityLocalId: entityLocalId,
                patientLocalId: patientLocalId,
                baseVersion: baseVersion,
                payload: payload,
                createdAt: createdAt,
                status: status,
                attempts: attempts,
                lastErrorCode: lastErrorCode,
                lastErrorMessage: lastErrorMessage,
              ),
          createCompanionCallback:
              ({
                Value<int> seq = const Value.absent(),
                required String idempotencyKey,
                required String entityType,
                required String operation,
                required String entityLocalId,
                Value<String?> patientLocalId = const Value.absent(),
                Value<int?> baseVersion = const Value.absent(),
                required String payload,
                required DateTime createdAt,
                Value<String> status = const Value.absent(),
                Value<int> attempts = const Value.absent(),
                Value<String?> lastErrorCode = const Value.absent(),
                Value<String?> lastErrorMessage = const Value.absent(),
              }) => OutboxCompanion.insert(
                seq: seq,
                idempotencyKey: idempotencyKey,
                entityType: entityType,
                operation: operation,
                entityLocalId: entityLocalId,
                patientLocalId: patientLocalId,
                baseVersion: baseVersion,
                payload: payload,
                createdAt: createdAt,
                status: status,
                attempts: attempts,
                lastErrorCode: lastErrorCode,
                lastErrorMessage: lastErrorMessage,
              ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$OutboxTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $OutboxTable,
      OutboxData,
      $$OutboxTableFilterComposer,
      $$OutboxTableOrderingComposer,
      $$OutboxTableAnnotationComposer,
      $$OutboxTableCreateCompanionBuilder,
      $$OutboxTableUpdateCompanionBuilder,
      (OutboxData, BaseReferences<_$AppDatabase, $OutboxTable, OutboxData>),
      OutboxData,
      PrefetchHooks Function()
    >;
typedef $$SyncConflictsTableCreateCompanionBuilder =
    SyncConflictsCompanion Function({
      Value<int> id,
      required String patientLocalId,
      required String localChanges,
      required String serverCopy,
      required int serverVersion,
      required DateTime createdAt,
    });
typedef $$SyncConflictsTableUpdateCompanionBuilder =
    SyncConflictsCompanion Function({
      Value<int> id,
      Value<String> patientLocalId,
      Value<String> localChanges,
      Value<String> serverCopy,
      Value<int> serverVersion,
      Value<DateTime> createdAt,
    });

class $$SyncConflictsTableFilterComposer
    extends Composer<_$AppDatabase, $SyncConflictsTable> {
  $$SyncConflictsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<int> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get patientLocalId => $composableBuilder(
    column: $table.patientLocalId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get localChanges => $composableBuilder(
    column: $table.localChanges,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get serverCopy => $composableBuilder(
    column: $table.serverCopy,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get serverVersion => $composableBuilder(
    column: $table.serverVersion,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnFilters(column),
  );
}

class $$SyncConflictsTableOrderingComposer
    extends Composer<_$AppDatabase, $SyncConflictsTable> {
  $$SyncConflictsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<int> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get patientLocalId => $composableBuilder(
    column: $table.patientLocalId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get localChanges => $composableBuilder(
    column: $table.localChanges,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get serverCopy => $composableBuilder(
    column: $table.serverCopy,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get serverVersion => $composableBuilder(
    column: $table.serverVersion,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$SyncConflictsTableAnnotationComposer
    extends Composer<_$AppDatabase, $SyncConflictsTable> {
  $$SyncConflictsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<int> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get patientLocalId => $composableBuilder(
    column: $table.patientLocalId,
    builder: (column) => column,
  );

  GeneratedColumn<String> get localChanges => $composableBuilder(
    column: $table.localChanges,
    builder: (column) => column,
  );

  GeneratedColumn<String> get serverCopy => $composableBuilder(
    column: $table.serverCopy,
    builder: (column) => column,
  );

  GeneratedColumn<int> get serverVersion => $composableBuilder(
    column: $table.serverVersion,
    builder: (column) => column,
  );

  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);
}

class $$SyncConflictsTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $SyncConflictsTable,
          SyncConflict,
          $$SyncConflictsTableFilterComposer,
          $$SyncConflictsTableOrderingComposer,
          $$SyncConflictsTableAnnotationComposer,
          $$SyncConflictsTableCreateCompanionBuilder,
          $$SyncConflictsTableUpdateCompanionBuilder,
          (
            SyncConflict,
            BaseReferences<_$AppDatabase, $SyncConflictsTable, SyncConflict>,
          ),
          SyncConflict,
          PrefetchHooks Function()
        > {
  $$SyncConflictsTableTableManager(_$AppDatabase db, $SyncConflictsTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$SyncConflictsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$SyncConflictsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$SyncConflictsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<int> id = const Value.absent(),
                Value<String> patientLocalId = const Value.absent(),
                Value<String> localChanges = const Value.absent(),
                Value<String> serverCopy = const Value.absent(),
                Value<int> serverVersion = const Value.absent(),
                Value<DateTime> createdAt = const Value.absent(),
              }) => SyncConflictsCompanion(
                id: id,
                patientLocalId: patientLocalId,
                localChanges: localChanges,
                serverCopy: serverCopy,
                serverVersion: serverVersion,
                createdAt: createdAt,
              ),
          createCompanionCallback:
              ({
                Value<int> id = const Value.absent(),
                required String patientLocalId,
                required String localChanges,
                required String serverCopy,
                required int serverVersion,
                required DateTime createdAt,
              }) => SyncConflictsCompanion.insert(
                id: id,
                patientLocalId: patientLocalId,
                localChanges: localChanges,
                serverCopy: serverCopy,
                serverVersion: serverVersion,
                createdAt: createdAt,
              ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$SyncConflictsTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $SyncConflictsTable,
      SyncConflict,
      $$SyncConflictsTableFilterComposer,
      $$SyncConflictsTableOrderingComposer,
      $$SyncConflictsTableAnnotationComposer,
      $$SyncConflictsTableCreateCompanionBuilder,
      $$SyncConflictsTableUpdateCompanionBuilder,
      (
        SyncConflict,
        BaseReferences<_$AppDatabase, $SyncConflictsTable, SyncConflict>,
      ),
      SyncConflict,
      PrefetchHooks Function()
    >;
typedef $$MetaTableCreateCompanionBuilder =
    MetaCompanion Function({
      required String key,
      required String value,
      Value<int> rowid,
    });
typedef $$MetaTableUpdateCompanionBuilder =
    MetaCompanion Function({
      Value<String> key,
      Value<String> value,
      Value<int> rowid,
    });

class $$MetaTableFilterComposer extends Composer<_$AppDatabase, $MetaTable> {
  $$MetaTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get key => $composableBuilder(
    column: $table.key,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get value => $composableBuilder(
    column: $table.value,
    builder: (column) => ColumnFilters(column),
  );
}

class $$MetaTableOrderingComposer extends Composer<_$AppDatabase, $MetaTable> {
  $$MetaTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get key => $composableBuilder(
    column: $table.key,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get value => $composableBuilder(
    column: $table.value,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$MetaTableAnnotationComposer
    extends Composer<_$AppDatabase, $MetaTable> {
  $$MetaTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get key =>
      $composableBuilder(column: $table.key, builder: (column) => column);

  GeneratedColumn<String> get value =>
      $composableBuilder(column: $table.value, builder: (column) => column);
}

class $$MetaTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $MetaTable,
          MetaData,
          $$MetaTableFilterComposer,
          $$MetaTableOrderingComposer,
          $$MetaTableAnnotationComposer,
          $$MetaTableCreateCompanionBuilder,
          $$MetaTableUpdateCompanionBuilder,
          (MetaData, BaseReferences<_$AppDatabase, $MetaTable, MetaData>),
          MetaData,
          PrefetchHooks Function()
        > {
  $$MetaTableTableManager(_$AppDatabase db, $MetaTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$MetaTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$MetaTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$MetaTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> key = const Value.absent(),
                Value<String> value = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => MetaCompanion(key: key, value: value, rowid: rowid),
          createCompanionCallback:
              ({
                required String key,
                required String value,
                Value<int> rowid = const Value.absent(),
              }) => MetaCompanion.insert(key: key, value: value, rowid: rowid),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$MetaTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $MetaTable,
      MetaData,
      $$MetaTableFilterComposer,
      $$MetaTableOrderingComposer,
      $$MetaTableAnnotationComposer,
      $$MetaTableCreateCompanionBuilder,
      $$MetaTableUpdateCompanionBuilder,
      (MetaData, BaseReferences<_$AppDatabase, $MetaTable, MetaData>),
      MetaData,
      PrefetchHooks Function()
    >;
typedef $$PendingUploadsTableCreateCompanionBuilder =
    PendingUploadsCompanion Function({
      required String id,
      required String patientLocalId,
      required String patientServerId,
      required String kind,
      Value<String?> modality,
      Value<String?> slideFormat,
      Value<String?> stain,
      required String filePath,
      required String fileName,
      required int sizeBytes,
      Value<String> status,
      Value<int> attempts,
      Value<DateTime?> nextAttemptAt,
      Value<String?> lastError,
      required DateTime createdAt,
      Value<int> rowid,
    });
typedef $$PendingUploadsTableUpdateCompanionBuilder =
    PendingUploadsCompanion Function({
      Value<String> id,
      Value<String> patientLocalId,
      Value<String> patientServerId,
      Value<String> kind,
      Value<String?> modality,
      Value<String?> slideFormat,
      Value<String?> stain,
      Value<String> filePath,
      Value<String> fileName,
      Value<int> sizeBytes,
      Value<String> status,
      Value<int> attempts,
      Value<DateTime?> nextAttemptAt,
      Value<String?> lastError,
      Value<DateTime> createdAt,
      Value<int> rowid,
    });

class $$PendingUploadsTableFilterComposer
    extends Composer<_$AppDatabase, $PendingUploadsTable> {
  $$PendingUploadsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get patientLocalId => $composableBuilder(
    column: $table.patientLocalId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get patientServerId => $composableBuilder(
    column: $table.patientServerId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get kind => $composableBuilder(
    column: $table.kind,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get modality => $composableBuilder(
    column: $table.modality,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get slideFormat => $composableBuilder(
    column: $table.slideFormat,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get stain => $composableBuilder(
    column: $table.stain,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get filePath => $composableBuilder(
    column: $table.filePath,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get fileName => $composableBuilder(
    column: $table.fileName,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get sizeBytes => $composableBuilder(
    column: $table.sizeBytes,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get status => $composableBuilder(
    column: $table.status,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get attempts => $composableBuilder(
    column: $table.attempts,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get nextAttemptAt => $composableBuilder(
    column: $table.nextAttemptAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get lastError => $composableBuilder(
    column: $table.lastError,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnFilters(column),
  );
}

class $$PendingUploadsTableOrderingComposer
    extends Composer<_$AppDatabase, $PendingUploadsTable> {
  $$PendingUploadsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get patientLocalId => $composableBuilder(
    column: $table.patientLocalId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get patientServerId => $composableBuilder(
    column: $table.patientServerId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get kind => $composableBuilder(
    column: $table.kind,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get modality => $composableBuilder(
    column: $table.modality,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get slideFormat => $composableBuilder(
    column: $table.slideFormat,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get stain => $composableBuilder(
    column: $table.stain,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get filePath => $composableBuilder(
    column: $table.filePath,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get fileName => $composableBuilder(
    column: $table.fileName,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get sizeBytes => $composableBuilder(
    column: $table.sizeBytes,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get status => $composableBuilder(
    column: $table.status,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get attempts => $composableBuilder(
    column: $table.attempts,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get nextAttemptAt => $composableBuilder(
    column: $table.nextAttemptAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get lastError => $composableBuilder(
    column: $table.lastError,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$PendingUploadsTableAnnotationComposer
    extends Composer<_$AppDatabase, $PendingUploadsTable> {
  $$PendingUploadsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get patientLocalId => $composableBuilder(
    column: $table.patientLocalId,
    builder: (column) => column,
  );

  GeneratedColumn<String> get patientServerId => $composableBuilder(
    column: $table.patientServerId,
    builder: (column) => column,
  );

  GeneratedColumn<String> get kind =>
      $composableBuilder(column: $table.kind, builder: (column) => column);

  GeneratedColumn<String> get modality =>
      $composableBuilder(column: $table.modality, builder: (column) => column);

  GeneratedColumn<String> get slideFormat => $composableBuilder(
    column: $table.slideFormat,
    builder: (column) => column,
  );

  GeneratedColumn<String> get stain =>
      $composableBuilder(column: $table.stain, builder: (column) => column);

  GeneratedColumn<String> get filePath =>
      $composableBuilder(column: $table.filePath, builder: (column) => column);

  GeneratedColumn<String> get fileName =>
      $composableBuilder(column: $table.fileName, builder: (column) => column);

  GeneratedColumn<int> get sizeBytes =>
      $composableBuilder(column: $table.sizeBytes, builder: (column) => column);

  GeneratedColumn<String> get status =>
      $composableBuilder(column: $table.status, builder: (column) => column);

  GeneratedColumn<int> get attempts =>
      $composableBuilder(column: $table.attempts, builder: (column) => column);

  GeneratedColumn<DateTime> get nextAttemptAt => $composableBuilder(
    column: $table.nextAttemptAt,
    builder: (column) => column,
  );

  GeneratedColumn<String> get lastError =>
      $composableBuilder(column: $table.lastError, builder: (column) => column);

  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);
}

class $$PendingUploadsTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $PendingUploadsTable,
          PendingUpload,
          $$PendingUploadsTableFilterComposer,
          $$PendingUploadsTableOrderingComposer,
          $$PendingUploadsTableAnnotationComposer,
          $$PendingUploadsTableCreateCompanionBuilder,
          $$PendingUploadsTableUpdateCompanionBuilder,
          (
            PendingUpload,
            BaseReferences<_$AppDatabase, $PendingUploadsTable, PendingUpload>,
          ),
          PendingUpload,
          PrefetchHooks Function()
        > {
  $$PendingUploadsTableTableManager(
    _$AppDatabase db,
    $PendingUploadsTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$PendingUploadsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$PendingUploadsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$PendingUploadsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> id = const Value.absent(),
                Value<String> patientLocalId = const Value.absent(),
                Value<String> patientServerId = const Value.absent(),
                Value<String> kind = const Value.absent(),
                Value<String?> modality = const Value.absent(),
                Value<String?> slideFormat = const Value.absent(),
                Value<String?> stain = const Value.absent(),
                Value<String> filePath = const Value.absent(),
                Value<String> fileName = const Value.absent(),
                Value<int> sizeBytes = const Value.absent(),
                Value<String> status = const Value.absent(),
                Value<int> attempts = const Value.absent(),
                Value<DateTime?> nextAttemptAt = const Value.absent(),
                Value<String?> lastError = const Value.absent(),
                Value<DateTime> createdAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => PendingUploadsCompanion(
                id: id,
                patientLocalId: patientLocalId,
                patientServerId: patientServerId,
                kind: kind,
                modality: modality,
                slideFormat: slideFormat,
                stain: stain,
                filePath: filePath,
                fileName: fileName,
                sizeBytes: sizeBytes,
                status: status,
                attempts: attempts,
                nextAttemptAt: nextAttemptAt,
                lastError: lastError,
                createdAt: createdAt,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String id,
                required String patientLocalId,
                required String patientServerId,
                required String kind,
                Value<String?> modality = const Value.absent(),
                Value<String?> slideFormat = const Value.absent(),
                Value<String?> stain = const Value.absent(),
                required String filePath,
                required String fileName,
                required int sizeBytes,
                Value<String> status = const Value.absent(),
                Value<int> attempts = const Value.absent(),
                Value<DateTime?> nextAttemptAt = const Value.absent(),
                Value<String?> lastError = const Value.absent(),
                required DateTime createdAt,
                Value<int> rowid = const Value.absent(),
              }) => PendingUploadsCompanion.insert(
                id: id,
                patientLocalId: patientLocalId,
                patientServerId: patientServerId,
                kind: kind,
                modality: modality,
                slideFormat: slideFormat,
                stain: stain,
                filePath: filePath,
                fileName: fileName,
                sizeBytes: sizeBytes,
                status: status,
                attempts: attempts,
                nextAttemptAt: nextAttemptAt,
                lastError: lastError,
                createdAt: createdAt,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$PendingUploadsTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $PendingUploadsTable,
      PendingUpload,
      $$PendingUploadsTableFilterComposer,
      $$PendingUploadsTableOrderingComposer,
      $$PendingUploadsTableAnnotationComposer,
      $$PendingUploadsTableCreateCompanionBuilder,
      $$PendingUploadsTableUpdateCompanionBuilder,
      (
        PendingUpload,
        BaseReferences<_$AppDatabase, $PendingUploadsTable, PendingUpload>,
      ),
      PendingUpload,
      PrefetchHooks Function()
    >;

class $AppDatabaseManager {
  final _$AppDatabase _db;
  $AppDatabaseManager(this._db);
  $$LocalPatientsTableTableManager get localPatients =>
      $$LocalPatientsTableTableManager(_db, _db.localPatients);
  $$LocalClinicalRecordsTableTableManager get localClinicalRecords =>
      $$LocalClinicalRecordsTableTableManager(_db, _db.localClinicalRecords);
  $$OutboxTableTableManager get outbox =>
      $$OutboxTableTableManager(_db, _db.outbox);
  $$SyncConflictsTableTableManager get syncConflicts =>
      $$SyncConflictsTableTableManager(_db, _db.syncConflicts);
  $$MetaTableTableManager get meta => $$MetaTableTableManager(_db, _db.meta);
  $$PendingUploadsTableTableManager get pendingUploads =>
      $$PendingUploadsTableTableManager(_db, _db.pendingUploads);
}
