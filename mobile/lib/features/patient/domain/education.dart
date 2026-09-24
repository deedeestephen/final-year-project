import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Offline education library bundled with the app (`assets/education/`).
/// Only English is available: Bemba and Nyanja must come from human-verified
/// translations before they can be offered (proposal, ethics).
class EducationLibrary {
  const EducationLibrary({required this.reviewStatus, required this.articles});

  factory EducationLibrary.fromJson(Map<String, dynamic> j) => EducationLibrary(
    reviewStatus: j['reviewStatus'] as String,
    articles: [
      for (final a in (j['articles'] as List).cast<Map<String, dynamic>>())
        Article.fromJson(a),
    ],
  );

  final String reviewStatus;
  final List<Article> articles;

  Article? byId(String id) {
    for (final a in articles) {
      if (a.id == id) return a;
    }
    return null;
  }
}

class Article {
  const Article({
    required this.id,
    required this.title,
    required this.summary,
    required this.minutes,
    required this.sections,
    required this.sources,
  });

  factory Article.fromJson(Map<String, dynamic> j) => Article(
    id: j['id'] as String,
    title: j['title'] as String,
    summary: j['summary'] as String,
    minutes: j['minutes'] as int,
    sections: [
      for (final s in (j['sections'] as List).cast<Map<String, dynamic>>())
        (heading: s['heading'] as String, body: s['body'] as String),
    ],
    sources: [
      for (final s in (j['sources'] as List).cast<Map<String, dynamic>>())
        (name: s['name'] as String, url: s['url'] as String),
    ],
  );

  final String id;
  final String title;
  final String summary;
  final int minutes;
  final List<({String heading, String body})> sections;
  final List<({String name, String url})> sources;
}

/// Languages the library is planned in; only verified ones can be chosen.
const educationLanguages = [
  (code: 'en', label: 'English', available: true),
  (code: 'bem', label: 'Bemba', available: false),
  (code: 'nya', label: 'Nyanja', available: false),
];

final educationLibraryProvider = FutureProvider<EducationLibrary>((ref) async {
  // The provider keeps the result; the asset bundle's own cache is not needed.
  final raw = await rootBundle.loadString(
    'assets/education/en/articles.json',
    cache: false,
  );
  return EducationLibrary.fromJson(jsonDecode(raw) as Map<String, dynamic>);
});
