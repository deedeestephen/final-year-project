import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../app/theme/tokens.dart';
import '../../../core/network/api_exception.dart';
import '../domain/patient_models.dart';

/// "Offline · showing what was saved on …", shown when data is the saved copy.
class OfflineStamp extends StatelessWidget {
  const OfflineStamp({super.key, required this.cached});

  final Cached<Object?> cached;

  @override
  Widget build(BuildContext context) {
    if (!cached.offline) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSizes.sm),
      child: Text(
        'Offline · showing what was saved on '
        '${DateFormat('d MMM yyyy, HH:mm').format(cached.fetchedAt)}',
        style: Theme.of(
          context,
        ).textTheme.bodyMedium?.copyWith(color: AppColors.offlineText),
      ),
    );
  }
}

/// A calm information box (no alarm colours).
class InfoNote extends StatelessWidget {
  const InfoNote(this.text, {super.key, this.icon = Icons.info_outline});

  final String text;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSizes.md),
      decoration: BoxDecoration(
        color: AppColors.infoBg,
        borderRadius: const BorderRadius.all(AppRadii.control),
        border: Border.all(color: AppColors.sky),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: AppColors.infoText),
          const SizedBox(width: AppSizes.sm),
          Expanded(
            child: Text(
              text,
              style: Theme.of(
                context,
              ).textTheme.bodyLarge?.copyWith(color: AppColors.infoText),
            ),
          ),
        ],
      ),
    );
  }
}

/// Loading / error / data for a patient screen that loads from the server.
class PatientLoad<T> extends StatelessWidget {
  const PatientLoad({
    super.key,
    required this.value,
    required this.builder,
    required this.onRetry,
  });

  final AsyncValue<T> value;
  final Widget Function(T data) builder;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    // Keep showing data while it refreshes (pull-to-refresh).
    if (value.hasValue) return builder(value.requireValue);
    if (value.hasError) return _Failed(error: value.error!, onRetry: onRetry);
    return const Center(
      child: Padding(
        padding: EdgeInsets.all(AppSizes.lg),
        child: CircularProgressIndicator(semanticsLabel: 'Loading'),
      ),
    );
  }
}

class _Failed extends StatelessWidget {
  const _Failed({required this.error, required this.onRetry});

  final Object error;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final offline = error is ApiException && (error as ApiException).isNetwork;
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.all(AppSizes.lg),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            offline ? Icons.cloud_off_outlined : Icons.error_outline,
            size: 40,
            color: AppColors.textSecondary,
          ),
          const SizedBox(height: AppSizes.sm),
          Text(
            offline
                ? 'You are offline, and nothing is saved on this phone yet.'
                : 'This could not be loaded.',
            textAlign: TextAlign.center,
            style: theme.textTheme.titleMedium,
          ),
          const SizedBox(height: AppSizes.md),
          OutlinedButton(onPressed: onRetry, child: const Text('Try again')),
        ],
      ),
    );
  }
}

/// A label/value line using the tabular clinical font for the value.
class ValueRow extends StatelessWidget {
  const ValueRow(this.label, this.value, {super.key, this.valueStyle});

  final String label;
  final String value;
  final TextStyle? valueStyle;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 150,
            child: Text(label, style: theme.textTheme.bodyMedium),
          ),
          Expanded(
            child: Text(value, style: valueStyle ?? theme.textTheme.bodyLarge),
          ),
        ],
      ),
    );
  }
}
