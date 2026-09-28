import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/routes.dart';
import '../../../app/theme/tokens.dart';
import '../../../core/db/app_database.dart';
import '../../../core/providers.dart';
import '../../../core/uploads/upload_queue.dart';
import '../../../shared/widgets/clinical_card.dart';
import '../../../shared/widgets/offline_banner.dart';
import '../../auth/application/session_controller.dart';
import '../../auth/domain/current_user.dart';
import '../../patients/application/patient_providers.dart';
import '../../patients/presentation/form_widgets.dart';
import '../application/clinical_server_providers.dart';
import 'server_common.dart';

/// Images (MRI, TRUS, CT) and histopathology slides for one patient, plus
/// files still waiting on this phone to upload.
class ImagingScreen extends ConsumerWidget {
  const ImagingScreen({super.key, required this.patientId});

  final String patientId; // local id

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final patient = ref.watch(patientProvider(patientId)).value;
    final serverId = patient?.serverId;
    return Scaffold(
      appBar: AppBar(title: const Text('Images and slides')),
      floatingActionButton: serverId == null
          ? null
          : FloatingActionButton.extended(
              key: const Key('imaging.add'),
              onPressed: () => context.push(Routes.uploadImaging(patientId)),
              icon: const Icon(Icons.upload_file),
              label: const Text('Add a file'),
            ),
      body: Column(
        children: [
          const OfflineBanner(),
          Expanded(
            child: serverId == null
                ? const Padding(
                    padding: EdgeInsets.all(AppSizes.md),
                    child: NotSyncedYetCard(),
                  )
                : _ImagingList(serverId: serverId),
          ),
        ],
      ),
    );
  }
}

class _ImagingList extends ConsumerWidget {
  const _ImagingList({required this.serverId});

  final String serverId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // A file leaving the queue has usually just reached the server: reload.
    ref.listen(pendingUploadsProvider(serverId), (previous, next) {
      if ((next.value?.length ?? 0) < (previous?.value?.length ?? 0)) {
        ref
          ..invalidate(imagingProvider(serverId))
          ..invalidate(slidesProvider(serverId));
      }
    });
    final pending = ref.watch(pendingUploadsProvider(serverId)).value ?? [];
    final imaging = ref.watch(imagingProvider(serverId));
    final slides = ref.watch(slidesProvider(serverId));
    final theme = Theme.of(context);

    Future<void> refresh() async {
      unawaited(ref.read(uploadQueueProvider).process());
      ref
        ..invalidate(imagingProvider(serverId))
        ..invalidate(slidesProvider(serverId));
    }

    return RefreshIndicator(
      onRefresh: refresh,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(
          AppSizes.md,
          AppSizes.md,
          AppSizes.md,
          96,
        ),
        children: [
          if (pending.isNotEmpty) ...[
            Text('Waiting on this phone', style: theme.textTheme.titleMedium),
            const SizedBox(height: AppSizes.sm),
            for (final u in pending) _PendingCard(upload: u),
            const SizedBox(height: AppSizes.md),
          ],
          Text('Images on the server', style: theme.textTheme.titleMedium),
          const SizedBox(height: AppSizes.sm),
          ...imaging.when(
            data: (list) => list.isEmpty
                ? [const Text('No images yet.')]
                : [
                    for (final s in list)
                      ClinicalCard(
                        key: Key('imaging.study.${s.id}'),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(s.modality, style: theme.textTheme.titleSmall),
                            LabelledValue('Checked', 'Ready'),
                            LabelledValue('Size', formatBytes(s.sizeBytes)),
                            LabelledValue('Added', formatDate(s.createdAt)),
                            if (!s.aiReady)
                              Padding(
                                padding: const EdgeInsets.only(
                                  top: AppSizes.xs,
                                ),
                                child: Text(
                                  s.aiExcludedReason ?? 'Not sent to the AI.',
                                  key: Key('imaging.notForAi.${s.id}'),
                                  style: theme.textTheme.bodyMedium,
                                ),
                              ),
                          ],
                        ),
                      ),
                  ],
            loading: () => [const LinearProgressIndicator()],
            error: (e, _) => [Text(friendlyError(e))],
          ),
          const SizedBox(height: AppSizes.md),
          Text('Slides', style: theme.textTheme.titleMedium),
          const SizedBox(height: AppSizes.sm),
          ...slides.when(
            data: (list) => list.isEmpty
                ? [const Text('No slides yet.')]
                : [
                    for (final s in list)
                      ClinicalCard(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              '${s.format}${s.stain == null ? '' : ' · ${s.stain}'}',
                              style: theme.textTheme.titleSmall,
                            ),
                            LabelledValue(
                              'Review',
                              s.isReviewed
                                  ? 'Grade group ${s.isupGradeGroup} '
                                        '(Gleason ${s.gleasonPrimary}+${s.gleasonSecondary})'
                                  : 'Waiting for a pathologist',
                            ),
                            LabelledValue('Added', formatDate(s.createdAt)),
                          ],
                        ),
                      ),
                  ],
            loading: () => [const LinearProgressIndicator()],
            error: (e, _) => [Text(friendlyError(e))],
          ),
        ],
      ),
    );
  }
}

class _PendingCard extends ConsumerWidget {
  const _PendingCard({required this.upload});

  final PendingUpload upload;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final queue = ref.watch(uploadQueueProvider);
    final rejected = upload.status == UploadStatus.rejected;
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSizes.sm),
      child: ClinicalCard(
        key: Key('imaging.pending.${upload.id}'),
        severity: rejected ? Severity.danger : Severity.warning,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              upload.fileName,
              style: Theme.of(context).textTheme.titleSmall,
            ),
            LabelledValue(
              'Status',
              rejected
                  ? 'Not accepted'
                  : upload.status == UploadStatus.uploading
                  ? 'Uploading'
                  : 'Saved on this phone, will upload when online',
            ),
            if (upload.status == UploadStatus.uploading)
              StreamBuilder<UploadProgress>(
                stream: queue.progress.where((p) => p.uploadId == upload.id),
                builder: (context, snap) =>
                    LinearProgressIndicator(value: snap.data?.fraction),
              ),
            if (upload.lastError != null)
              Padding(
                padding: const EdgeInsets.only(top: AppSizes.xs),
                child: Text(
                  upload.lastError!,
                  key: Key('imaging.pending.error.${upload.id}'),
                ),
              ),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                TextButton(
                  onPressed: () => queue.discard(upload.id),
                  child: const Text('Remove'),
                ),
                if (!rejected)
                  TextButton(
                    onPressed: () async {
                      await queue.retryNow(upload.id);
                      unawaited(queue.process());
                    },
                    child: const Text('Try now'),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// Choose a file and what it is; it is queued at once and uploads when online.
class UploadScreen extends ConsumerStatefulWidget {
  const UploadScreen({super.key, required this.patientId});

  final String patientId; // local id

  @override
  ConsumerState<UploadScreen> createState() => _UploadScreenState();
}

class _UploadScreenState extends ConsumerState<UploadScreen> {
  final _form = GlobalKey<FormState>();
  UploadKind _kind = UploadKind.imaging;
  String? _modality = 'MRI';
  String? _format = 'TIFF';
  final _stain = TextEditingController();
  PickedFile? _file;
  bool _busy = false;

  static const _modalities = {
    'MRI': 'MRI (DICOM)',
    'TRUS': 'Transrectal ultrasound (DICOM, JPEG or PNG)',
    'CT': 'CT (DICOM)',
  };
  static const _formats = {
    'TIFF': 'TIFF',
    'SVS': 'SVS (Aperio)',
    'NDPI': 'NDPI (Hamamatsu)',
  };

  @override
  void dispose() {
    _stain.dispose();
    super.dispose();
  }

  Future<void> _pick() async {
    final picked = await ref.read(filePickerProvider)();
    if (picked != null) setState(() => _file = picked);
  }

  Future<void> _save(String serverId) async {
    if (!_form.currentState!.validate()) return;
    if (_file == null) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Choose a file first.')));
      return;
    }
    setState(() => _busy = true);
    final queue = ref.read(uploadQueueProvider);
    await queue.enqueue(
      sourcePath: _file!.path,
      fileName: _file!.name,
      patientLocalId: widget.patientId,
      patientServerId: serverId,
      kind: _kind,
      modality: _kind == UploadKind.imaging ? _modality : null,
      slideFormat: _kind == UploadKind.slide ? _format : null,
      stain: _kind == UploadKind.slide && _stain.text.trim().isNotEmpty
          ? _stain.text.trim()
          : null,
    );
    unawaited(queue.process());
    if (mounted) context.pop();
  }

  @override
  Widget build(BuildContext context) {
    final patient = ref.watch(patientProvider(widget.patientId)).value;
    final session = ref.watch(sessionControllerProvider);
    final isPathologist =
        session is SignedIn &&
        session.user.roles.contains(UserRole.pathologist);
    final serverId = patient?.serverId;
    return Scaffold(
      appBar: AppBar(title: const Text('Add a file')),
      body: serverId == null
          ? const Padding(
              padding: EdgeInsets.all(AppSizes.md),
              child: NotSyncedYetCard(),
            )
          : Form(
              key: _form,
              child: ListView(
                padding: const EdgeInsets.all(AppSizes.md),
                children: [
                  if (isPathologist) ...[
                    SegmentedButton<UploadKind>(
                      key: const Key('upload.kind'),
                      segments: const [
                        ButtonSegment(
                          value: UploadKind.imaging,
                          label: Text('Image'),
                        ),
                        ButtonSegment(
                          value: UploadKind.slide,
                          label: Text('Slide'),
                        ),
                      ],
                      selected: {_kind},
                      onSelectionChanged: (s) =>
                          setState(() => _kind = s.first),
                    ),
                    const SizedBox(height: AppSizes.md),
                  ],
                  if (_kind == UploadKind.imaging)
                    LabelledDropdown(
                      key: const Key('upload.modality'),
                      label: 'Type of image',
                      options: _modalities,
                      value: _modality,
                      onChanged: (v) => setState(() => _modality = v),
                      validator: (v) => v == null ? 'Choose the type.' : null,
                    )
                  else ...[
                    LabelledDropdown(
                      key: const Key('upload.format'),
                      label: 'Slide file format',
                      options: _formats,
                      value: _format,
                      onChanged: (v) => setState(() => _format = v),
                      validator: (v) => v == null ? 'Choose the format.' : null,
                    ),
                    const SizedBox(height: AppSizes.md),
                    TextFormField(
                      key: const Key('upload.stain'),
                      controller: _stain,
                      decoration: const InputDecoration(
                        labelText: 'Stain (optional)',
                        helperText: 'For example H&E',
                      ),
                    ),
                  ],
                  const SizedBox(height: AppSizes.md),
                  OutlinedButton.icon(
                    key: const Key('upload.pick'),
                    onPressed: _pick,
                    icon: const Icon(Icons.folder_open),
                    label: Text(_file == null ? 'Choose file' : _file!.name),
                  ),
                  const SizedBox(height: AppSizes.sm),
                  Text(
                    'The server checks what the file really is. Files that '
                    'are not medical images, or are too large, are refused.',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  const SizedBox(height: AppSizes.lg),
                  FilledButton(
                    key: const Key('upload.save'),
                    onPressed: _busy ? null : () => _save(serverId),
                    child: const Text('Save and upload'),
                  ),
                ],
              ),
            ),
    );
  }
}
