import 'package:flutter/material.dart';

import '../../../app/theme/tokens.dart';
import 'clinical_formats.dart';

/// Reminder shown on every data-entry form of the research prototype.
class SyntheticDataNotice extends StatelessWidget {
  const SyntheticDataNotice({super.key});

  static const text =
      'Research prototype: enter made-up (synthetic) test data only. '
      'Never enter a real patient\'s information.';

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSizes.md),
      margin: const EdgeInsets.only(bottom: AppSizes.md),
      decoration: BoxDecoration(
        color: context.colors.infoBg,
        borderRadius: const BorderRadius.all(AppRadii.control),
        border: Border.all(color: context.colors.sky),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.science_outlined, color: context.colors.infoText),
          const SizedBox(width: AppSizes.sm),
          Expanded(
            child: Text(
              text,
              style: Theme.of(
                context,
              ).textTheme.bodyMedium?.copyWith(color: context.colors.infoText),
            ),
          ),
        ],
      ),
    );
  }
}

/// A YYYY-MM-DD text field with a calendar button.
class DateField extends StatelessWidget {
  const DateField({
    super.key,
    required this.controller,
    required this.label,
    required this.firstDate,
    this.fieldKey,
  });

  final TextEditingController controller;
  final String label;
  final DateTime firstDate;
  final Key? fieldKey;

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      key: fieldKey,
      controller: controller,
      keyboardType: TextInputType.datetime,
      decoration: InputDecoration(
        labelText: label,
        hintText: 'YYYY-MM-DD',
        suffixIcon: IconButton(
          tooltip: 'Choose a date',
          icon: const Icon(Icons.calendar_month_outlined),
          onPressed: () async {
            final now = DateTime.now();
            final current = DateTime.tryParse(controller.text);
            final picked = await showDatePicker(
              context: context,
              firstDate: firstDate,
              lastDate: now,
              initialDate:
                  current != null &&
                      !current.isAfter(now) &&
                      !current.isBefore(firstDate)
                  ? current
                  : now,
            );
            if (picked != null) controller.text = formatDate(picked);
          },
        ),
      ),
      validator: (v) => validatePastDate(v, today: DateTime.now()),
    );
  }
}

/// A dropdown with labelled options.
class LabelledDropdown extends StatelessWidget {
  const LabelledDropdown({
    super.key,
    required this.label,
    required this.options,
    required this.value,
    required this.onChanged,
    this.validator,
  });

  final String label;
  final Map<String, String> options;
  final String? value;
  final ValueChanged<String?> onChanged;
  final FormFieldValidator<String>? validator;

  @override
  Widget build(BuildContext context) {
    return DropdownButtonFormField<String>(
      isExpanded: true,
      initialValue: value,
      decoration: InputDecoration(labelText: label),
      items: [
        for (final e in options.entries)
          DropdownMenuItem(
            value: e.key,
            child: Text(e.value, overflow: TextOverflow.ellipsis),
          ),
      ],
      onChanged: onChanged,
      validator: validator,
    );
  }
}
