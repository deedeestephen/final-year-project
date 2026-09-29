import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:material_symbols_icons/symbols.dart';

import '../../../app/theme/tokens.dart';
import '../../../core/network/api_exception.dart';
import '../../../shared/widgets/offline_banner.dart';
import '../application/patient_providers.dart';
import '../domain/patient_models.dart';
import 'patient_widgets.dart';

/// Messages from the clinic (in-app notifications).
class MessagesScreen extends ConsumerWidget {
  const MessagesScreen({super.key});

  Future<void> _run(
    BuildContext context,
    WidgetRef ref,
    Future<void> Function() action,
  ) async {
    try {
      await action();
      ref.invalidate(inboxProvider);
    } on ApiException catch (e) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            e.isNetwork
                ? 'You are offline. Try again when connected.'
                : 'That did not work. Please try again.',
          ),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final inbox = ref.watch(inboxProvider);
    final repo = ref.read(patientRepositoryProvider);
    final unread = inbox.value?.value.unreadCount ?? 0;
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Messages'),
        actions: [
          if (unread > 0)
            TextButton(
              key: const Key('messages.readAll'),
              style: TextButton.styleFrom(
                foregroundColor: context.colors.onPrimary,
              ),
              onPressed: () => _run(context, ref, repo.markAllRead),
              child: const Text('Mark all read'),
            ),
        ],
      ),
      body: Column(
        children: [
          const OfflineBanner(),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () => ref.refresh(inboxProvider.future),
              child: ListView(
                padding: const EdgeInsets.symmetric(vertical: AppSizes.sm),
                children: [
                  PatientLoad<Cached<Inbox>>(
                    value: inbox,
                    onRetry: () => ref.invalidate(inboxProvider),
                    builder: (cached) => Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Padding(
                          padding: const EdgeInsets.symmetric(
                            horizontal: AppSizes.md,
                          ),
                          child: OfflineStamp(cached: cached),
                        ),
                        if (cached.value.items.isEmpty)
                          Padding(
                            padding: const EdgeInsets.all(AppSizes.md),
                            child: Text(
                              'No messages yet.',
                              style: theme.textTheme.bodyLarge,
                            ),
                          ),
                        for (final n in cached.value.items)
                          _MessageTile(
                            item: n,
                            onTap: n.isUnread
                                ? () => _run(
                                    context,
                                    ref,
                                    () => repo.markRead(n.id),
                                  )
                                : null,
                          ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _MessageTile extends StatelessWidget {
  const _MessageTile({required this.item, this.onTap});

  final NotificationItem item;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final unread = item.isUnread;
    return Semantics(
      label: unread ? 'Unread message' : null,
      child: ListTile(
        key: Key('message.${item.id}'),
        onTap: onTap,
        minVerticalPadding: AppSizes.sm,
        leading: Padding(
          padding: const EdgeInsets.only(top: 6),
          child: Icon(
            Symbols.circle_rounded,
            fill: unread ? 1 : 0,
            size: 12,
            color: unread ? context.colors.sky : context.colors.borderStrong,
          ),
        ),
        title: Text(
          item.title,
          style: theme.textTheme.titleMedium?.copyWith(
            fontWeight: unread ? FontWeight.w700 : FontWeight.w500,
          ),
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 2),
            Text(item.body, style: theme.textTheme.bodyMedium),
            const SizedBox(height: 2),
            Text(
              DateFormat('d MMM yyyy, HH:mm').format(item.createdAt.toLocal()),
              style: theme.textTheme.bodySmall,
            ),
          ],
        ),
      ),
    );
  }
}
