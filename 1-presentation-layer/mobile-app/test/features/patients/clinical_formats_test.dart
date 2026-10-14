import 'package:flutter_test/flutter_test.dart';
import 'package:pca_mhealth/features/patients/presentation/clinical_formats.dart';

void main() {
  group('symptomSummary', () {
    test('lists the symptoms answered yes, in the form order', () {
      expect(
        symptomSummary(
          '{"weakStream": true, "nocturia": true, "urgency": false}',
        ),
        'Waking at night to pass urine, Weak or stop-start urine flow',
      );
    });

    test('says None when every symptom asked was a no', () {
      expect(symptomSummary('{"nocturia": false, "bonePain": false}'), 'None');
    });

    test('shows nothing when symptoms were not asked or cannot be read', () {
      expect(symptomSummary(null), isNull);
      expect(symptomSummary('not json'), isNull);
      expect(symptomSummary('[true]'), isNull);
    });
  });

  test('family history choices become yes, no or unknown', () {
    expect(familyHistoryValue('YES'), isTrue);
    expect(familyHistoryValue('NO'), isFalse);
    expect(familyHistoryValue('UNKNOWN'), isNull);
    expect(familyHistoryValue(null), isNull);
  });

  test('the symptom keys are the ones the API accepts', () {
    expect(symptomLabels.keys, [
      'nocturia',
      'frequency',
      'urgency',
      'weakStream',
      'haematuria',
      'bonePain',
      'weightLoss',
    ]);
    expect(biopsyLabels.keys, [
      'NONE',
      'PRIOR_NEGATIVE',
      'PRIOR_POSITIVE',
      'UNKNOWN',
    ]);
  });
}
