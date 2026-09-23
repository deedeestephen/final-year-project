import 'package:flutter/material.dart';

void main() {
  runApp(const PcaMhealthApp());
}

/// Root widget. Replaced by the themed, routed app in Phase 7.
class PcaMhealthApp extends StatelessWidget {
  const PcaMhealthApp({super.key});

  @override
  Widget build(BuildContext context) {
    return const MaterialApp(
      title: 'PCa mHealth',
      home: Scaffold(
        body: Center(
          child: Text('PCa mHealth — research prototype, not a medical device'),
        ),
      ),
    );
  }
}
