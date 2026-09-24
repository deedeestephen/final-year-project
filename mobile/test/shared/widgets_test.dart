import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pca_mhealth/app/theme/app_theme.dart';
import 'package:pca_mhealth/app/theme/tokens.dart';
import 'package:pca_mhealth/core/network/api_exception.dart';
import 'package:pca_mhealth/shared/widgets/ai_disclaimer_banner.dart';
import 'package:pca_mhealth/shared/widgets/async_state_view.dart';
import 'package:pca_mhealth/shared/widgets/clinical_card.dart';
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
        .where((c) => c.color == AppColors.amber);
    expect(accent, hasLength(1));
    expect(find.text('PSA raised'), findsOneWidget);
  });
}
