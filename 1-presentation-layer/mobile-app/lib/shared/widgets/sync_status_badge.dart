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

/// The server refused a change or someone else changed the record.
class NeedsAttention extends SyncStatus {
  const NeedsAttention();
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
    NeedsAttention() => 'Needs attention',
  };

  @override
  Widget build(BuildContext context) {
    final (dot, fg, bg) = switch (status) {
      Synced() => (
        context.colors.syncedDot,
        context.colors.successText,
        context.colors.successBg,
      ),
      SavedOffline() => (
        context.colors.amber,
        context.colors.warningText,
        context.colors.warningBg,
      ),
      Syncing() => (
        context.colors.sky,
        context.colors.infoText,
        context.colors.infoBg,
      ),
      NeedsAttention() => (
        context.colors.danger,
        context.colors.danger,
        context.colors.dangerBg,
      ),
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
