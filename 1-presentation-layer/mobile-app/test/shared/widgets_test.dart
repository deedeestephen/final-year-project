import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_symbols_icons/symbols.dart';
import 'package:pca_mhealth/app/theme/app_theme.dart';
import 'package:pca_mhealth/app/theme/tokens.dart';
import 'package:pca_mhealth/core/network/api_exception.dart';
import 'package:pca_mhealth/shared/widgets/ai_disclaimer_banner.dart';
import 'package:pca_mhealth/shared/widgets/async_state_view.dart';
import 'package:pca_mhealth/shared/widgets/clinical_card.dart';
import 'package:pca_mhealth/shared/widgets/hero_header.dart';
import 'package:pca_mhealth/shared/widgets/primary_button.dart';
import 'package:pca_mhealth/shared/widgets/sync_status_badge.dart';

Future<void> pump(WidgetTester tester, Widget child) => tester.pumpWidget(
  MaterialApp(
    theme: buildAppTheme(),
    home: Scaffold(body: child),
  ),
);

void main() {
  group('AiDisclaimerBanner', () {
    testWidgets('always shows the decision-support disclaimer', (tester) async {
      await pump(tester, const AiDisclaimerBanner());
      expect(find.text(AiDisclaimerBanner.disclaimer), findsOneWidget);
      expect(find.text(AiDisclaimerBanner.mockLabel), findsNothing);
    });

    testWidgets('labels development mock output exactly', (tester) async {
      await pump(
        tester,
        const AiDisclaimerBanner(provenance: AiProvenance.developmentMock),
      );
      expect(
        find.text('DEVELOPMENT MOCK DATA — NOT A CLINICAL RESULT.'),
        findsOneWidget,
      );
      expect(find.text(AiDisclaimerBanner.disclaimer), findsOneWidget);
    });
  });

  group('SyncStatusBadge', () {
    testWidgets('states are written in words, not colour alone', (
      tester,
    ) async {
      await pump(
        tester,
        const Column(
          children: [
            SyncStatusBadge(status: Synced()),
            SyncStatusBadge(status: SavedOffline()),
            SyncStatusBadge(status: Syncing(3)),
          ],
        ),
      );
      expect(find.text('Synced'), findsOneWidget);
      expect(find.text('Saved on device'), findsOneWidget);
      expect(find.text('Syncing 3'), findsOneWidget);
    });
  });

  group('AsyncStateView', () {
    Widget view({
      bool loading = false,
      List<int>? data,
      Object? error,
      VoidCallback? onRetry,
    }) => AsyncStateView<List<int>>(
      loading: loading,
      data: data,
      error: error,
      isEmpty: (d) => d.isEmpty,
      emptyMessage: 'No patients yet.',
      onRetry: onRetry,
      builder: (_, d) => Text('${d.length} items'),
    );

    testWidgets('loading', (tester) async {
      await pump(tester, view(loading: true));
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
    });

    testWidgets('empty', (tester) async {
      await pump(tester, view(data: const []));
      expect(find.text('No patients yet.'), findsOneWidget);
    });

    testWidgets('data', (tester) async {
      await pump(tester, view(data: const [1, 2]));
      expect(find.text('2 items'), findsOneWidget);
    });

    testWidgets('offline error with retry', (tester) async {
      var retried = false;
      await pump(
        tester,
        view(
          error: const ApiException(
            code: ApiException.networkUnavailable,
            message: 'x',
          ),
          onRetry: () => retried = true,
        ),
      );
      expect(find.text('You are offline'), findsOneWidget);
      await tester.tap(find.text('Try again'));
      expect(retried, isTrue);
    });

    testWidgets('server error shows its message', (tester) async {
      await pump(
        tester,
        view(
          error: const ApiException(
            code: 'FORBIDDEN',
            message: 'You do not have access to this patient',
          ),
        ),
      );
      expect(
        find.text('You do not have access to this patient'),
        findsOneWidget,
      );
    });

    testWidgets('other errors', (tester) async {
      await pump(tester, view(error: StateError('boom')));
      expect(find.text('Something went wrong'), findsOneWidget);
      expect(find.text('Please try again.'), findsOneWidget);
    });
  });

  testWidgets('PrimaryButton ignores taps while busy', (tester) async {
    var taps = 0;
    await pump(
      tester,
      PrimaryButton(label: 'Save', busy: true, onPressed: () => taps++),
    );
    await tester.tap(find.byType(FilledButton));
    expect(taps, 0);
    expect(
      tester.getSize(find.byType(FilledButton)).height,
      AppSizes.inputHeight,
    );
  });

  testWidgets('ClinicalCard draws a severity accent', (tester) async {
    await pump(
      tester,
      const ClinicalCard(severity: Severity.warning, child: Text('PSA raised')),
    );
    final accent = tester
        .widgetList<Container>(find.byType(Container))
        .where((c) => c.color == AppPalette.light.amber);
    expect(accent, hasLength(1));
    expect(find.text('PSA raised'), findsOneWidget);
  });

  testWidgets('the accent line runs from primary blue to awareness blue', (
    tester,
  ) async {
    await pump(tester, const AccentLine(height: 6));
    final box = tester.widget<DecoratedBox>(
      find.descendant(
        of: find.byType(AccentLine),
        matching: find.byType(DecoratedBox),
      ),
    );
    final gradient = (box.decoration as BoxDecoration).gradient!;
    expect(gradient.colors, [
      AppPalette.light.primary,
      AppPalette.light.accent,
    ]);
    expect(tester.getSize(find.byType(AccentLine)).height, 6);
  });

  test('no national flag colours remain in the palette (ADR-011)', () {
    const flag = [0xFF198A00, 0xFFDE2010, 0xFFEF7D00];
    for (final p in [AppPalette.light, AppPalette.dark]) {
      for (final c in [p.primary, p.heroStart, p.heroEnd, p.linkText]) {
        expect(flag, isNot(contains(c.toARGB32())));
      }
    }
  });

  group('modern look', () {
    test('initials take the first letters of up to two words', () {
      expect(initialsOf('Demo Clinician'), 'DC');
      expect(initialsOf('  SYNTHETIC  Patient 001 '), 'SP');
      expect(initialsOf('Admin'), 'A');
      expect(initialsOf(''), '');
    });

    test('the long date needs no locale data', () {
      expect(longDate(DateTime(2026, 9, 28)), 'Monday 28 September');
      expect(longDate(DateTime(2027, 1, 3)), 'Sunday 3 January');
    });

    test('a plain date is shown in the long readable form', () {
      expect(readableDate('2026-08-20'), '20 August 2026');
      expect(readableDate('2026-01-05'), '5 January 2026');
      expect(readableDate('2026-08-20T10:00:00Z'), '20 August 2026');
      expect(readableDate('not a date'), 'not a date');
      expect(readableDate('2026-13-01'), '2026-13-01');
    });

    test('a name always gets the same avatar colour, never orange', () {
      expect(toneFor('p-123'), toneFor('p-123'));
      final seen = {for (var i = 0; i < 50; i++) toneFor('patient-$i')};
      expect(seen, isNot(contains(AccentTone.orange)));
      expect(seen.length, greaterThan(1));
    });

    test('tile colours differ between light and dark mode', () {
      for (final t in AccentTone.values) {
        expect(
          t.background(AppPalette.light),
          isNot(t.background(AppPalette.dark)),
        );
      }
    });

    testWidgets('the hero header shows the date, greeting and initials', (
      tester,
    ) async {
      await pump(
        tester,
        HeroHeader(
          title: 'Clinician',
          greeting: 'Welcome, Demo Clinician',
          subtitle: 'clinician@demo.pca-mhealth.test',
          name: 'Demo Clinician',
          date: DateTime(2026, 9, 28),
          actions: const [Text('Synced')],
        ),
      );
      expect(find.text('Clinician'), findsOneWidget);
      expect(find.text('Monday 28 September'), findsOneWidget);
      expect(find.text('Welcome, Demo Clinician'), findsOneWidget);
      expect(find.text('DC'), findsOneWidget);
      expect(find.text('Synced'), findsOneWidget);
      // The awareness-blue line follows the header.
      expect(find.byType(AccentLine), findsOneWidget);
      // Initials are decoration: the name is written next to them.
      expect(
        find.ancestor(
          of: find.text('DC'),
          matching: find.byType(ExcludeSemantics),
        ),
        findsWidgets,
      );
    });

    testWidgets('an action tile opens on tap and shows its badge', (
      tester,
    ) async {
      var opened = 0;
      await pump(
        tester,
        ActionTile(
          icon: Symbols.group_rounded,
          title: 'Patients',
          description: 'Register and find patients',
          onTap: () => opened++,
        ),
      );
      expect(find.byIcon(Symbols.chevron_right_rounded), findsOneWidget);
      await tester.tap(find.text('Patients'));
      expect(opened, 1);

      await pump(
        tester,
        const ActionTile(
          icon: Symbols.chat_rounded,
          title: 'Ask the assistant',
          badge: 'Coming in build phase 13',
        ),
      );
      expect(find.text('Coming in build phase 13'), findsOneWidget);
      // Nothing to open yet, so no arrow.
      expect(find.byIcon(Symbols.chevron_right_rounded), findsNothing);
    });
  });
}
