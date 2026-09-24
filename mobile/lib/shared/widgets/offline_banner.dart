import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

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
        color: AppColors.offlineBg,
        padding: const EdgeInsets.symmetric(
          horizontal: AppSizes.md,
          vertical: AppSizes.sm,
        ),
        child: Row(
          children: [
            const Icon(
              Icons.cloud_off_outlined,
              size: 18,
              color: AppColors.offlineText,
            ),
            const SizedBox(width: AppSizes.sm),
            Expanded(
              child: Text(
                message,
                style: Theme.of(
                  context,
                ).textTheme.bodyMedium?.copyWith(color: AppColors.offlineText),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
