import 'package:flutter/material.dart';

import '../../app/theme/tokens.dart';

/// Sync state of a record or of the whole device queue (filled in Phase 6).
sealed class SyncStatus {
  const SyncStatus();
}

class Synced extends SyncStatus {
  const Synced();
}

/// Saved on the device, waiting for a connection.
class SavedOffline extends SyncStatus {
  const SavedOffline();
}

class Syncing extends SyncStatus {
  const Syncing(this.pending);
  final int pending;
}

/// A chip with a dot and words; colour is never the only signal.
class SyncStatusBadge extends StatelessWidget {
  const SyncStatusBadge({super.key, required this.status});

  final SyncStatus status;

  static String labelFor(SyncStatus status) => switch (status) {
    Synced() => 'Synced',
    SavedOffline() => 'Saved on device',
    Syncing(:final pending) => 'Syncing $pending',
  };

  @override
  Widget build(BuildContext context) {
    final (dot, fg, bg) = switch (status) {
      Synced() => (
        AppColors.emerald,
        AppColors.successText,
        AppColors.successBg,
      ),
      SavedOffline() => (
        AppColors.amber,
        AppColors.warningText,
        AppColors.warningBg,
      ),
      Syncing() => (AppColors.sky, AppColors.infoText, AppColors.infoBg),
    };
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSizes.sm + 2,
        vertical: AppSizes.xs,
      ),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: const BorderRadius.all(AppRadii.chip),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(color: dot, shape: BoxShape.circle),
          ),
          const SizedBox(width: 6),
          Text(
            labelFor(status),
            style: Theme.of(context).textTheme.labelMedium?.copyWith(color: fg),
          ),
        ],
      ),
    );
  }
}
