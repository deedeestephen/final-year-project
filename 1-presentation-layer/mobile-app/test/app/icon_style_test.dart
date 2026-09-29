import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// ADR-011: every icon in the app comes from Material Symbols Rounded, so
/// the look stays consistent. This fails if a Material `Icons.` icon or a
/// non-rounded symbol slips back in.
void main() {
  final files = Directory('lib')
      .listSync(recursive: true)
      .whereType<File>()
      .where((f) => f.path.endsWith('.dart'));

  test('no Material Icons are used', () {
    final offenders = [
      for (final f in files)
        if (RegExp(r'\bIcons\.[a-z]').hasMatch(f.readAsStringSync())) f.path,
    ];
    expect(offenders, isEmpty);
  });

  test('every symbol is the rounded style', () {
    final wrong = <String>[];
    for (final f in files) {
      for (final m in RegExp(
        r'\bSymbols\.([a-z_0-9]+)',
      ).allMatches(f.readAsStringSync())) {
        if (!m.group(1)!.endsWith('_rounded')) wrong.add('${f.path}: ${m[0]}');
      }
    }
    expect(wrong, isEmpty);
  });
}
