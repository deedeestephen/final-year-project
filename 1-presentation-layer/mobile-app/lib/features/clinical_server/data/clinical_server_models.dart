/// Server data the clinician and pathologist screens use (Phase 9). Field
/// names follow the backend's OpenAPI document (2-api-gateway/openapi).
library;

DateTime? _date(Object? v) => v == null ? null : DateTime.parse(v as String);

class StaffConsent {
  const StaffConsent({
    required this.id,
    required this.type,
    required this.status,
    required this.method,
    required this.grantedAt,
    this.withdrawnAt,
  });

  factory StaffConsent.fromJson(Map<String, dynamic> j) => StaffConsent(
    id: j['id'] as String,
    type: j['type'] as String,
    status: j['status'] as String,
    method: j['method'] as String? ?? '',
    grantedAt: DateTime.parse(j['grantedAt'] as String),
    withdrawnAt: _date(j['withdrawnAt']),
  );

  final String id;

  /// DATA_PROCESSING | AI_ANALYSIS | RESEARCH_USE | EHR_SHARING
  final String type;
  final String status; // GRANTED | WITHDRAWN
  final String method; // WRITTEN | VERBAL_WITNESSED | DIGITAL
  final DateTime grantedAt;
  final DateTime? withdrawnAt;

  bool get isActive => status == 'GRANTED';
}

class ImagingStudy {
  const ImagingStudy({
    required this.id,
    required this.modality,
    required this.mimeType,
    required this.sizeBytes,
    required this.createdAt,
    this.aiReady = true,
    this.aiExcludedReason,
  });

  factory ImagingStudy.fromJson(Map<String, dynamic> j) => ImagingStudy(
    id: j['id'] as String,
    modality: j['modality'] as String,
    mimeType: j['mimeType'] as String,
    sizeBytes: (j['sizeBytes'] as num).toInt(),
    createdAt: DateTime.parse(j['createdAt'] as String),
    aiReady: j['aiReady'] as bool? ?? true,
    aiExcludedReason: j['aiExcludedReason'] as String?,
  );

  final String id;
  final String modality;
  final String mimeType;
  final int sizeBytes;
  final DateTime createdAt;

  /// False when no de-identified copy could be made: the AI never gets it.
  final bool aiReady;
  final String? aiExcludedReason;
}

class Specimen {
  const Specimen({
    required this.id,
    required this.patientId,
    required this.format,
    required this.createdAt,
    this.stain,
    this.biopsyDate,
    this.gleasonPrimary,
    this.gleasonSecondary,
    this.isupGradeGroup,
    this.reviewedAt,
  });

  factory Specimen.fromJson(Map<String, dynamic> j) => Specimen(
    id: j['id'] as String,
    patientId: j['patientId'] as String,
    format: j['format'] as String,
    stain: j['stain'] as String?,
    biopsyDate: j['biopsyDate'] as String?,
    gleasonPrimary: j['gleasonPrimary'] as int?,
    gleasonSecondary: j['gleasonSecondary'] as int?,
    isupGradeGroup: j['isupGradeGroup'] as int?,
    reviewedAt: _date(j['reviewedAt']),
    createdAt: DateTime.parse(j['createdAt'] as String),
  );

  final String id;
  final String patientId;
  final String format;
  final String? stain;
  final String? biopsyDate;
  final int? gleasonPrimary;
  final int? gleasonSecondary;
  final int? isupGradeGroup;
  final DateTime? reviewedAt;
  final DateTime createdAt;

  bool get isReviewed => reviewedAt != null;
}

class SkippedModule {
  const SkippedModule(this.module, this.reason);
  final String module;
  final String reason;
}

class AiExplanation {
  const AiExplanation({
    required this.kind,
    required this.module,
    required this.available,
    required this.hasImage,
    this.id,
    this.unavailableReason,
    this.values,
  });

  factory AiExplanation.fromJson(Map<String, dynamic> j) => AiExplanation(
    id: j['id'] as String?,
    kind: j['kind'] as String,
    module: j['module'] as String,
    available: j['available'] as bool,
    hasImage: j['hasImage'] as bool? ?? false,
    unavailableReason: j['unavailableReason'] as String?,
    values: (j['values'] as Map<String, dynamic>?)?.map(
      (k, v) => MapEntry(k, (v as num).toDouble()),
    ),
  );

  final String? id;
  final String kind; // GRADCAM | SHAP | MIL_ATTENTION
  final String module;
  final bool available;
  final bool hasImage;
  final String? unavailableReason;
  final Map<String, double>? values;
}

class AiReport {
  const AiReport({
    required this.provenance,
    required this.isMock,
    required this.disclaimer,
    required this.modelVersions,
    required this.modulesUsed,
    required this.modulesSkipped,
    required this.explanations,
    this.inputNotes = const [],
    this.pcaProbability,
    this.probabilityInterval,
    this.gleasonGradeGroup,
  });

  factory AiReport.fromJson(Map<String, dynamic> j) {
    final outputs = j['outputs'] as Map<String, dynamic>;
    final interval = outputs['probabilityInterval'] as List<dynamic>?;
    return AiReport(
      provenance: j['provenance'] as String,
      isMock: j['isMock'] as bool,
      disclaimer: j['disclaimer'] as String,
      modelVersions: (j['modelVersions'] as Map<String, dynamic>).map(
        (k, v) => MapEntry(k, v as String),
      ),
      pcaProbability: (outputs['pcaProbability'] as num?)?.toDouble(),
      probabilityInterval: interval == null
          ? null
          : ((interval[0] as num).toDouble(), (interval[1] as num).toDouble()),
      gleasonGradeGroup: outputs['gleasonGradeGroup'] as int?,
      modulesUsed: (outputs['modulesUsed'] as List<dynamic>).cast<String>(),
      modulesSkipped: [
        for (final s
            in (outputs['modulesSkipped'] as List<dynamic>)
                .cast<Map<String, dynamic>>())
          SkippedModule(s['module'] as String, s['reason'] as String),
      ],
      explanations: [
        for (final e
            in (j['explanations'] as List<dynamic>)
                .cast<Map<String, dynamic>>())
          AiExplanation.fromJson(e),
      ],
      inputNotes: ((j['inputNotes'] as List<dynamic>?) ?? const [])
          .cast<String>(),
    );
  }

  final String provenance;
  final bool isMock;
  final String disclaimer;
  final Map<String, String> modelVersions;
  final double? pcaProbability;
  final (double, double)? probabilityInterval;
  final int? gleasonGradeGroup;
  final List<String> modulesUsed;

  /// Files that were not sent to the AI, and why (for example not de-identified).
  final List<String> inputNotes;
  final List<SkippedModule> modulesSkipped;
  final List<AiExplanation> explanations;
}

class AiJob {
  const AiJob({
    required this.id,
    required this.patientId,
    required this.status,
    required this.createdAt,
    this.patientMrn,
    this.error,
    this.finishedAt,
    this.report,
  });

  factory AiJob.fromJson(Map<String, dynamic> j) => AiJob(
    id: j['id'] as String,
    patientId: j['patientId'] as String,
    patientMrn: j['patientMrn'] as String?,
    status: j['status'] as String,
    error: j['error'] as String?,
    createdAt: DateTime.parse(j['createdAt'] as String),
    finishedAt: _date(j['finishedAt']),
    report: j['report'] == null
        ? null
        : AiReport.fromJson(j['report'] as Map<String, dynamic>),
  );

  final String id;
  final String patientId;
  final String? patientMrn;
  final String status; // QUEUED | RUNNING | SUCCEEDED | FAILED | TIMED_OUT
  final String? error;
  final DateTime createdAt;
  final DateTime? finishedAt;
  final AiReport? report;

  bool get isActive => status == 'QUEUED' || status == 'RUNNING';
}

/// Plain labels shown to people (the server uses codes).
const consentTypeLabels = {
  'DATA_PROCESSING': 'Storing and using their health data',
  'AI_ANALYSIS': 'AI analysis of their data',
  'RESEARCH_USE': 'Use in research',
  'EHR_SHARING': 'Sharing with other health records',
};

const consentMethodLabels = {
  'WRITTEN': 'Written (signed form)',
  'VERBAL_WITNESSED': 'Verbal, with a witness',
  'DIGITAL': 'Digital (on this device)',
};

const aiStatusLabels = {
  'QUEUED': 'Waiting to start',
  'RUNNING': 'Running',
  'SUCCEEDED': 'Finished',
  'FAILED': 'Did not finish',
  'TIMED_OUT': 'Took too long',
};

const aiModuleLabels = {
  'unet_segmentation': 'Prostate outline (U-Net)',
  'resnet50_imaging': 'Imaging (ResNet-50)',
  'ann_clinical': 'Clinical values (ANN)',
  'patch_cnn_mil_histopathology': 'Histopathology (Patch-CNN + MIL)',
  'xgboost_fusion': 'Combined result (XGBoost)',
};

const explanationKindLabels = {
  'GRADCAM': 'Heatmap (Grad-CAM)',
  'SHAP': 'Contributing factors (SHAP)',
  'MIL_ATTENTION': 'Slide regions (MIL attention)',
};
