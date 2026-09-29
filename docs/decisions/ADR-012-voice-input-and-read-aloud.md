# ADR-012: Voice messages to the assistant, and articles read aloud

- **Status:** Accepted (owner request, 2026-09-29). The owner asked for two things:
  - "make sure that the chat bot can be sent messages using voice record just like chatgpt";
  - "on the learn section for people that cant read … they can have an audio play read for them".

  For voice, the owner chose the **phone's own speech-to-text**, which is free, over a cloud transcription service.
- **Context:**
  - **Who needs it:** many older men in Zambia read little or no English, and some cannot read at all. Typing on a phone is also slow for many people.
  - **What the app already had:** the knowledge base and the Learn articles are in English. Bemba and Nyanja still wait for human-verified translations (ADR-009).

## Decision

1. **Voice messages use the phone's speech-to-text** (`speech_to_text`, BSD-3-Clause).
   - **Starting:** a microphone button sits in the question box ("Type or speak your question"). It asks for the microphone permission the first time it is tapped, never at start-up.
   - **While listening:**
     - a pulsing red dot and a moving sound-level bar show it is listening;
     - the words appear in the box as they are heard;
     - **✕** throws them away and keeps anything typed before;
     - **✓** finishes.
   - **When listening stops:** after ✓, 3 seconds of silence, or 60 seconds.
   - **Sending:** the person then checks the words and taps send, as with dictation in other chat apps. Nothing is sent while the phone is still listening.
   - **Problems are explained in plain words:**
     - Microphone refused: how to allow it in Settings. The microphone button stays, so it can be tried again.
     - No speech service on the phone: a message, and the button is hidden.
     - Nothing heard: "tap the microphone and try again".
   - **Language:** English only. The phone's English setting is used, or British English when the phone is set to another language. Bemba and Nyanja are not offered: they need verified content first.
2. **Articles and answers are read aloud with the phone's own voice** (`flutter_tts`, MIT).
   - **Learn list:** every article card has a large **▶ Listen** button (announced as "Listen to <title>"). It opens the article and starts reading at once, so someone who cannot read can start it from the list.
   - **Article player:** a player is pinned to the bottom of the article, so it stays in reach while the page scrolls.
     - Controls: **Listen / Pause / Resume**, **Stop**, a **Slower voice** option, and "Part 2 of 5".
     - It reads the title and summary, then each section, then the closing advice. The part being read is tinted, marked for screen readers, and scrolled into view.
     - Sources and links are not read.
   - **Chat:** every answer has a **Listen** button. It reads the safety label if there is one, then the answer, then the disclaimer.
   - **One voice at a time:** only one thing is read at a time in the whole app (`readAloudControllerProvider`). Reading stops when the article or chat is closed, and when the person changes tab.
   - **Offline:** English voices work without the internet on most Android phones.
3. **Both are behind small interfaces** (`SpeechService` in `features/chat/application/voice_input.dart`, `ReadAloud` in `shared/audio/read_aloud.dart`). The tests use fakes, so they need no microphone or speaker, and the plugins are only started when first used.
4. **Android manifest:**
   - `RECORD_AUDIO` is added.
   - `<queries>` entries for `android.speech.RecognitionService` and `android.intent.action.TTS_SERVICE` let the app find the phone's speech services on Android 11 and later.
   - No other permission is added.

## Privacy

- **The app never records, stores or sends sound.** The phone's speech service turns speech into text, and only the text reaches the app. The text is then treated exactly like a typed question: the same safety rules, the same limits, and the same audit entry with no content.
- **Who hears the voice:** on most Android phones the speech service is Google's, which may process the voice on its own servers. The chat's intro note says so: "If you speak, your phone's speech service (for example Google's) turns your voice into text; the app only receives the text." Before real patients use the app, the data-protection review (ADR-010) must cover this too.
- **Reading aloud** happens on the phone. No text is sent anywhere.

## Consequences

- People who cannot read, or cannot type well, can use Learn and the assistant.
- **Tests:**
  - 11 new chat tests cover speaking, auto-stop, cancel, "nothing heard", a refused microphone, no speech service, offline, the privacy note, the bot button, and reading an answer and a safety label aloud.
  - 6 new read-aloud tests cover reading in order, pause and resume, the slower voice, stop, leaving the article, and changing tab.
  - The accessibility suite covers the new screens.
- **Checking on a device:**
  - Read-aloud can be tried on the emulator.
  - Voice input needs the emulator's host microphone to be switched on, or a real phone ([how-to-test.md](../how-to-test.md)).
- **Later:** Bemba and Nyanja voices, when verified content and suitable voices exist; a "send when I stop speaking" option if users ask for it.
