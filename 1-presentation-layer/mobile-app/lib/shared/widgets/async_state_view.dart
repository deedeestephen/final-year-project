import 'package:flutter/material.dart';

import '../../app/theme/tokens.dart';
import '../../core/network/api_exception.dart';

/// Loading / error / offline / empty / data for one async value, so every
/// screen handles each state the same way.
class AsyncStateView<T> extends StatelessWidget {
  const AsyncStateView({
    super.key,
    required this.loading,
    required this.data,
    required this.error,
    required this.builder,
    this.isEmpty,
    this.emptyMessage = 'Nothing here yet.',
    this.onRetry,
  });

  final bool loading;
  final T? data;
  final Object? error;
  final Widget Function(BuildContext context, T data) builder;
  final bool Function(T data)? isEmpty;
  final String emptyMessage;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final value = data;
    if (error != null) {
      final offline =
          error is ApiException && (error as ApiException).isNetwork;
      return _Message(
        icon: offline ? Icons.cloud_off_outlined : Icons.error_outline,
        title: offline ? 'You are offline' : 'Something went wrong',
        body: offline
            ? 'Connect to the internet and try again.'
            : error is ApiException
            ? (error as ApiException).message
            : 'Please try again.',
        onRetry: onRetry,
      );
    }
    if (loading || value == null) {
      return const Center(
        child: CircularProgressIndicator(semanticsLabel: 'Loading'),
      );
    }
    if (isEmpty?.call(value) ?? false) {
      return _Message(icon: Icons.inbox_outlined, title: emptyMessage);
    }
    return builder(context, value);
  }
}

class _Message extends StatelessWidget {
  const _Message({
    required this.icon,
    required this.title,
    this.body,
    this.onRetry,
  });

  final IconData icon;
  final String title;
  final String? body;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSizes.lg),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 40, color: AppColors.textSecondary),
            const SizedBox(height: AppSizes.sm),
            Text(
              title,
              style: theme.textTheme.titleMedium,
              textAlign: TextAlign.center,
            ),
            if (body != null) ...[
              const SizedBox(height: AppSizes.xs),
              Text(
                body!,
                style: theme.textTheme.bodyMedium,
                textAlign: TextAlign.center,
              ),
            ],
            if (onRetry != null) ...[
              const SizedBox(height: AppSizes.md),
              OutlinedButton(
                onPressed: onRetry,
                child: const Text('Try again'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
