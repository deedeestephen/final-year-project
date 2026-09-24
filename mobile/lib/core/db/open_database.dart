import 'dart:io';
import 'dart:math';

import 'package:drift/native.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:sqlcipher_flutter_libs/sqlcipher_flutter_libs.dart';
import 'package:sqlite3/open.dart';

import 'app_database.dart';

const _keyName = 'pca.dbKey';
const _fileName = 'pca_mhealth.db';

/// Opens the on-device database, encrypted with SQLCipher (AES-256, NFR-01).
/// The 256-bit key is random per installation and kept only in the Android
/// Keystore / iOS Keychain. If the key is lost (e.g. app data restored without
/// the Keystore), the unreadable file is replaced by an empty database; the
/// data can be downloaded again from the server.
Future<AppDatabase> openAppDatabase({FlutterSecureStorage? storage}) async {
  final secure = storage ?? const FlutterSecureStorage();
  final dir = await getApplicationSupportDirectory();
  final file = File(p.join(dir.path, _fileName));

  var key = await secure.read(key: _keyName);
  if (key == null) {
    if (await file.exists()) await file.delete();
    key = _randomHexKey();
    await secure.write(key: _keyName, value: key);
  }
  final hexKey = key;

  return AppDatabase(
    NativeDatabase.createInBackground(
      file,
      isolateSetup: useSqlCipher,
      setup: (db) {
        // Fails fast if plain SQLite was loaded instead of SQLCipher.
        final version = db.select('PRAGMA cipher_version;');
        if (version.isEmpty) {
          throw StateError(
            'SQLCipher is not available; refusing to store data unencrypted',
          );
        }
        db.execute("PRAGMA key = \"x'$hexKey'\";");
        // Reading the schema verifies the key.
        db.select('SELECT count(*) FROM sqlite_master;');
      },
    ),
  );
}

/// Loads SQLCipher instead of the system SQLite on Android.
void useSqlCipher() {
  open.overrideFor(OperatingSystem.android, openCipherOnAndroid);
}

String _randomHexKey() {
  final random = Random.secure();
  return List<int>.generate(
    32,
    (_) => random.nextInt(256),
  ).map((b) => b.toRadixString(16).padLeft(2, '0')).join();
}
