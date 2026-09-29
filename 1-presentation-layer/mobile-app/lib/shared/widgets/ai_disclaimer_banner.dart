import 'package:flutter/material.dart';
import 'package:material_symbols_icons/symbols.dart';

import '../../app/theme/tokens.dart';

/// Where an AI output came from (backend `provenance`: RESEARCH_MODEL or MOCK).
/// Mock output must always be labelled.
enum AiProvenance { researchModel, developmentMock }

/// Shown above every AI-assisted result. The wording is fixed and is not
/// shortened or hidden: AI supports clinicians and never replaces them.
class AiDisclaimerBanner extends StatelessWidget {
  const AiDisclaimerBanner({
    super.key,
    this.provenance = AiProvenance.researchModel,
  });

  static const disclaimer =
      'AI-assisted decision support only. This is not a diagnosis. '
      'A qualified clinician must review every result.';
  static const mockLabel = 'DEVELOPMENT MOCK DATA — NOT A CLINICAL RESULT.';

  final AiProvenance provenance;

  @override
  Widget build(BuildContext context) {
    final isMock = provenance == AiProvenance.developmentMock;
    final text = Theme.of(context).textTheme.bodyMedium;
    return Semantics(
      container: true,
      label: isMock ? '$mockLabel $disclaimer' : disclaimer,
      excludeSemantics: true,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(AppSizes.md),
        decoration: BoxDecoration(
          color: context.colors.warningBg,
          borderRadius: const BorderRadius.all(AppRadii.control),
          border: Border.all(color: context.colors.amber),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(Symbols.info_rounded, color: context.colors.warningText),
            const SizedBox(width: AppSizes.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (isMock) ...[
                    Text(
                      mockLabel,
                      style: text?.copyWith(
                        color: context.colors.warningText,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: AppSizes.xs),
                  ],
                  Text(
                    disclaimer,
                    style: text?.copyWith(color: context.colors.warningText),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
