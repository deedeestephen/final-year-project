import 'package:flutter_test/flutter_test.dart';
import 'package:pca_mhealth/main.dart';

void main() {
  testWidgets('app starts and shows the research-prototype notice', (
    tester,
  ) async {
    await tester.pumpWidget(const PcaMhealthApp());

    expect(find.textContaining('not a medical device'), findsOneWidget);
  });
}
