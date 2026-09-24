import 'dart:ffi';
import 'dart:io';

import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:pca_mhealth/core/db/app_database.dart';
import 'package:sqlite3/open.dart';

var _hostSqliteReady = false;

/// Host tests run on the developer PC, not on a phone, so they use the
/// operating system's SQLite (Windows ships winsqlite3.dll). The encrypted
/// SQLCipher build is only used on devices; see integration_test/.
void useHostSqlite() {
  if (_hostSqliteReady) return;
  if (Platform.isWindows) {
    open.overrideFor(
      OperatingSystem.windows,
      () => DynamicLibrary.open('winsqlite3.dll'),
    );
  }
  driftRuntimeOptions.dontWarnAboutMultipleDatabases = true;
  _hostSqliteReady = true;
}

/// A fresh in-memory database for one test. Streams close synchronously so
/// widget tests do not end with drift's close timer still pending.
AppDatabase memoryDatabase() {
  useHostSqlite();
  return AppDatabase(
    DatabaseConnection(
      NativeDatabase.memory(),
      closeStreamsSynchronously: true,
    ),
  );
}
