import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_symbols_icons/symbols.dart';

import '../../app/theme/tokens.dart';
import '../../core/connectivity/connectivity_service.dart';

/// A slim strip shown while the device has no network.
class OfflineBanner extends ConsumerWidget {
  const OfflineBanner({super.key});

  static const message = 'Offline. Work is saved on this device.';

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final online = ref.watch(onlineProvider).value ?? true;
    if (online) return const SizedBox.shrink();
    return Semantics(
      liveRegion: true,
      child: Container(
        width: double.infinity,
        color: context.colors.offlineBg,
        padding: const EdgeInsets.symmetric(
          horizontal: AppSizes.md,
          vertical: AppSizes.sm,
        ),
        child: Row(
          children: [
            Icon(
              Symbols.cloud_off_rounded,
              size: 18,
              color: context.colors.offlineText,
            ),
            const SizedBox(width: AppSizes.sm),
            Expanded(
              child: Text(
                message,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: context.colors.offlineText,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
