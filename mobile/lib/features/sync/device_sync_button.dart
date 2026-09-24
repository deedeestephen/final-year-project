import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/routes.dart';
import '../../app/theme/tokens.dart';
import '../../core/sync/sync_providers.dart';
import '../../shared/widgets/sync_status_badge.dart';

/// App-bar badge for the device's sync state; opens the Sync screen.
class DeviceSyncButton extends ConsumerWidget {
  const DeviceSyncButton({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final status = ref.watch(deviceSyncStatusProvider);
    final attention = ref.watch(syncCountsProvider).value?.needsAttention ?? 0;
    return Padding(
      padding: const EdgeInsets.only(right: AppSizes.sm),
      child: InkWell(
        key: const Key('sync.open'),
        borderRadius: const BorderRadius.all(AppRadii.chip),
        onTap: () => context.push(Routes.sync),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: AppSizes.minTouchTarget),
          child: Center(
            child: SyncStatusBadge(
              status: attention > 0 ? const NeedsAttention() : status,
            ),
          ),
        ),
      ),
    );
  }
}
