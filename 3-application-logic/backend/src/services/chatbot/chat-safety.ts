import type { ChatAudience } from '../ai/ai-contract';

/*
 * Safety rules for the chatbot (Phase 13, docs/chatbot-plan.md §3). They run
 * on the question before anything is looked up, and on the answer before it
 * is shown. The answers themselves are quoted from reviewed documents
 * (ADR-009), so these rules only have to decide when not to answer.
 */

export type ChatSafety = 'OK' | 'URGENT_CARE' | 'DECLINED' | 'NO_SOURCE';

export interface SafetyDecision {
  safety: ChatSafety;
  /** Why, for the audit log (a code, never the question). */
  reason: string;
  /** The fixed text shown instead of an answer. */
  text?: string;
}

export const DISCLAIMER: Record<ChatAudience, string> = {
  patient:
    'This is general information, not medical advice. Speak to your clinician about your own health.',
  clinician:
    'Reference information for decision support. It does not replace clinical judgement or the local protocol.',
};

export const FIXED_TEXT = {
  urgentMedical:
    'This may need urgent care. Go to the nearest clinic or hospital now, or call your local emergency number. The assistant cannot help in an emergency.',
  urgentSelfHarm:
    'I am sorry you are feeling this way. Please talk to someone you trust now, and go to the nearest clinic or hospital, or call your local emergency number. You do not have to go through this alone. The assistant cannot help in an emergency.',
  ownResults:
    'I cannot tell you what your own results mean or whether you have an illness. Your clinician will explain your results and what they mean for you. You could write your question down and ask at your next visit.',
  medicines:
    'I cannot give advice about medicines or doses. Please ask your clinician or a pharmacist.',
  noSourcePatient:
    'I do not have reviewed information about that. I can help with the prostate, PSA tests, the rectal exam (DRE), screening, and when to get help quickly, so you could try asking in another way. For anything about your own health, please ask your clinician.',
  noSourceClinician:
    'No reviewed reference in the knowledge base covers that yet. Check the local protocol or ask a senior colleague.',
} as const;

const SELF_HARM =
  /\b(suicid\w*|kill (myself|me)|end my life|take my (own )?life|self[- ]?harm|hurt(ing)? myself|want to die|don'?t want to (live|be alive))\b/i;
const EMERGENCY =
  /\b(chest pain|can'?t breathe|cannot breathe|difficulty breathing|short(ness)? of breath|unconscious|fainted|passed out|seizure|stroke|bleeding (a lot|heavily|badly)|heavy bleeding|can'?t (pass urine|urinate|pee)|cannot (pass urine|urinate|pee)|unable to (pass urine|urinate|pee))\b/i;
const MEDICINES =
  /\b(dose|doses|dosage|mg|milligrams?|prescri(be|ption)|how (much|many) (tablets?|pills?|capsules?)|(which|what) (medicine|medication|drug|tablet|pill)s? should i take|should i (take|stop taking))\b/i;
const OWN_RESULTS =
  /\b(do i have (prostate )?cancer|have i got cancer|am i (sick|ill|dying)|diagnose me|what('?s| is) wrong with me|is my (psa|result|results|level|test|biopsy|scan|mri|report)\b|my (psa|result|results|test|biopsy|scan|mri|report|gleason|grade( group)?|score)\b.{0,40}\b(mean|normal|bad|good|high|low|ok(ay)?|serious|worry|dangerous|cancer))\b/i;

/** Decides before any look-up whether the question gets a normal answer. */
export function checkQuestion(
  text: string,
  audience: ChatAudience,
): SafetyDecision {
  if (SELF_HARM.test(text)) {
    return {
      safety: 'URGENT_CARE',
      reason: 'self-harm',
      text: FIXED_TEXT.urgentSelfHarm,
    };
  }
  if (EMERGENCY.test(text)) {
    return {
      safety: 'URGENT_CARE',
      reason: 'emergency',
      text: FIXED_TEXT.urgentMedical,
    };
  }
  if (MEDICINES.test(text)) {
    return {
      safety: 'DECLINED',
      reason: 'medicines',
      text: FIXED_TEXT.medicines,
    };
  }
  // Clinicians may ask what a value means in general; patients are never
  // told what their own results mean (their clinician explains them).
  if (audience === 'patient' && OWN_RESULTS.test(text)) {
    return {
      safety: 'DECLINED',
      reason: 'own-results',
      text: FIXED_TEXT.ownResults,
    };
  }
  return { safety: 'OK', reason: 'ok' };
}

/*
 * Small talk (owner request 2026-09-29: "make sure users can use the
 * chatbot to greet and ask casual things"). Greetings, "how are you",
 * feelings, thanks, jokes, "who made you", "ok" and the like get a friendly
 * fixed reply, so the assistant feels like a conversation, without a
 * language model and without any medical content. Only a message that is
 * nothing but small talk counts: "hello, is my PSA bad?" still goes through
 * every rule above, which always run first.
 */

/** What people put before small talk ("hi, how are you", "ok thanks"). */
const LEAD = String.raw`(?:(?:hi|hello|hey|ok(?:ay)?|oh|well|so|um+|hmm+|and)[\s,!.]+)?`;
/** An emoji, including joined ones (zero-width joiner, variation selector). */
const EMOJI = '(?:\\p{Extended_Pictographic}|\\u200d|\\ufe0f)';
/** And after it: a name for the assistant, "please", punctuation, emoji. */
const TAIL =
  String.raw`(?:[\s,]+(?:assistant|pca assistant|bot|friend|dear|please|sir|madam|there|again|too|a lot|so much))*(?:[\s!?.,:;)(]|` +
  EMOJI +
  ')*';
const whole = (body: string): RegExp =>
  new RegExp(String.raw`^\s*${LEAD}(?:${body})${TAIL}$`, 'iu');

const HELP_TOPICS_PATIENT =
  'the prostate, PSA tests, the rectal exam (DRE), screening, or when to get help quickly';

type Replies = Record<ChatAudience, readonly string[]>;

interface Intent {
  name: string;
  pattern: RegExp;
  replies: Replies;
}

/** Checked in order; the first that matches the whole message wins. */
const INTENTS: readonly Intent[] = [
  {
    // Bemba and Nyanja greetings. The content is English-only until
    // human-verified translations exist (ADR-009).
    name: 'local-greeting',
    pattern: whole(
      String.raw`muli shani|uli shani|shani|muli bwanji|uli bwanji|mwashibukeni|mwaswela shani|mwauka bwanji|mwaswera bwanji|mwachoma bwanji`,
    ),
    replies: {
      patient: [
        'Hello! I am well, thank you. I can only answer in English for now: Bemba and Nyanja will follow once the translations have been checked by people. What would you like to know?',
      ],
      clinician: [
        'Hello. I can only answer in English for now. What do you need to look up?',
      ],
    },
  },
  {
    name: 'how-are-you',
    pattern: whole(
      String.raw`how (?:are|r) (?:you|u|things)(?: (?:doing|today|keeping|going|this morning|tonight))*|how(?:'s| is) it going|how(?:'s| is) your day|how do you do|are you (?:ok(?:ay)?|well|fine|alright|good)|what'?s up|wh?assup|sup`,
    ),
    replies: {
      patient: [
        'I am doing well, thank you for asking! I am here to help with questions about ' +
          HELP_TOPICS_PATIENT +
          '. How can I help you today?',
      ],
      clinician: ['Doing well, thank you. What would you like to look up?'],
    },
  },
  {
    name: 'greeting',
    pattern: whole(
      String.raw`hi+|hello+|hey+|hallo|hiya|howdy|yo|greetings|good (?:morning|afternoon|evening|day)|morning|evening|hi there|hello there|hello hello`,
    ),
    replies: {
      patient: [
        'Hello! I can answer questions about ' +
          HELP_TOPICS_PATIENT +
          '. What would you like to know?',
        'Hi again! What else would you like to know? You can ask about ' +
          HELP_TOPICS_PATIENT +
          '.',
      ],
      clinician: [
        'Hello. I can look up reference information: PI-RADS categories, ISUP grade groups, PSA density and free PSA, DRE findings, and how to read the AI report. What do you need?',
      ],
    },
  },
  {
    // A worried or low mood (self-harm is caught by the safety rules first).
    name: 'feeling-worried',
    pattern: whole(
      String.raw`(?:i'?m|i am|am|i feel|i'?m feeling|i am feeling|feeling)\s+(?:so |very |really |a bit |a little |quite )?(?:scared|afraid|frightened|worried|nervous|anxious|stressed|sad|down|unhappy|lonely|confused|not (?:ok(?:ay)?|good|well|fine)|bad|terrible|awful|sick|unwell|ill)(?:\s+(?:about|of|for)\s+(?:it|this|that|the test|my test|the tests|the results?|my results?|tomorrow|the doctor|the clinic|the hospital|cancer|the biopsy|my biopsy|the exam|the check ?up))?(?:\s+(?:that )?i (?:have|might have|may have) cancer)?`,
    ),
    replies: {
      patient: [
        'I am sorry you are feeling this way. Many people feel worried about tests and results, and that is normal. Talking with your clinician, or with someone you trust, can really help. I can explain things such as what a PSA test measures or what happens during a DRE, if that would help. If you feel very unwell, please go to a clinic or hospital now.',
      ],
      clinician: [
        'Sorry to hear that. Take care of yourself. I am here whenever you need to look something up.',
      ],
    },
  },
  {
    name: 'feeling-well',
    pattern: whole(
      String.raw`(?:(?:i'?m|i am|am|me|all)\s+)?(?:fine|doing (?:well|good|fine|great|ok(?:ay)?)|very well|not (?:too )?bad|so so|good|great|ok(?:ay)?|alright|well)(?:[\s,.!]+(?:thanks?|thank you))?[\s,.!]+(?:and|how about|what about) (?:you|u)|(?:i'?m|i am)\s+(?:fine|good|ok(?:ay)?|great|alright|all right|well|happy|doing (?:well|good|fine|great|ok(?:ay)?))(?:[\s,.!]+(?:thanks?|thank you))?|(?:fine|very well|not (?:too )?bad|doing (?:well|good|fine|great))(?:[\s,.!]+(?:thanks?|thank you))?`,
    ),
    replies: {
      patient: [
        'Glad to hear it, and I am doing well too, thank you! Is there anything you would like to know about ' +
          HELP_TOPICS_PATIENT +
          '?',
      ],
      clinician: ['Good to hear. What would you like to look up?'],
    },
  },
  {
    name: 'name',
    pattern: whole(
      String.raw`what(?:'s| is) your name|your name|do you have a name|what (?:should|can) i call you|what are you called`,
    ),
    replies: {
      patient: [
        'I am the PCa Assistant, the helper in the PCa mHealth app. You can ask me about ' +
          HELP_TOPICS_PATIENT +
          '.',
      ],
      clinician: [
        'I am the PCa Assistant, the reference helper in PCa mHealth.',
      ],
    },
  },
  {
    name: 'creator',
    pattern: whole(
      String.raw`who (?:made|created|built|designed|programmed|owns|trained) you|where (?:are you|do you come) from|who is your (?:creator|maker|owner)`,
    ),
    replies: {
      patient: [
        'I was built for PCa mHealth, a research project on prostate cancer screening in Zambia. I answer only from health information that was collected and reviewed for the project, and I show where each answer comes from.',
      ],
      clinician: [
        'I was built for the PCa mHealth research prototype. I answer only from its reviewed reference cards and show their sources.',
      ],
    },
  },
  {
    name: 'what-are-you',
    pattern: whole(
      String.raw`are you (?:a |an )?(?:robot|bot|machine|computer|ai|artificial intelligence|human|person|real(?: person)?|doctor|nurse|clinician)|are you real|is this a (?:robot|bot|real person|human)`,
    ),
    replies: {
      patient: [
        'I am a computer assistant, not a person, doctor or nurse. I share reviewed general information about prostate health. For advice about your own health, your clinician is the right person.',
      ],
      clinician: [
        'I am a software assistant that answers from reviewed reference cards. I support, but do not replace, clinical judgement.',
      ],
    },
  },
  {
    name: 'thanks',
    pattern: whole(
      String.raw`(?:(?:ok(?:ay)?|great|good|nice|perfect|cool|alright),?\s*)?(?:thanks?(?: (?:a lot|so much|very much))?|thank you(?: (?:very|so) much)?|thank u|thx|tnx|ty|cheers|much appreciated|appreciate it|i appreciate (?:it|that|this)|zikomo(?: kwambiri)?|natotela(?: sana)?|twatotela(?: sana)?)`,
    ),
    replies: {
      patient: [
        'You are welcome. Is there anything else you would like to know?',
      ],
      clinician: ['You are welcome. Anything else to look up?'],
    },
  },
  {
    name: 'compliment',
    pattern: whole(
      String.raw`(?:you(?:'re| are)|ur|u r) (?:so |very |really )?(?:good|great|helpful|smart|clever|amazing|awesome|kind|nice|the best|a good (?:bot|assistant))|good (?:bot|job|work|assistant)|well done|i (?:love|like) (?:you|this|it|this app)|(?:that|this) (?:was|is) (?:very |really )?(?:helpful|useful|great|good|clear)|very helpful|nice one|excellent|brilliant`,
    ),
    replies: {
      patient: [
        'Thank you, that is kind! I am glad I could help. Is there anything else you would like to know?',
      ],
      clinician: ['Thank you. Glad it helped.'],
    },
  },
  {
    name: 'complaint',
    pattern: whole(
      String.raw`(?:you(?:'re| are)|ur|u r) (?:so |very |really )?(?:stupid|dumb|useless|wrong|bad|not helpful|unhelpful|boring|slow|annoying)|(?:this|that) (?:is|was) (?:useless|wrong|not helpful|unhelpful|not right)|that(?:'s| is) (?:wrong|not right|not what i asked)|you don'?t understand|not helpful|useless`,
    ),
    replies: {
      patient: [
        'I am sorry that was not helpful. I only know what is in the reviewed health information, so I cannot answer everything. You could try asking in another way, for example "What does a PSA test measure?", or ask your clinician.',
      ],
      clinician: [
        'Sorry about that. The knowledge base only covers the reviewed reference cards; try other words, or check the local protocol.',
      ],
    },
  },
  {
    name: 'joke',
    pattern: whole(
      String.raw`(?:tell|say|give) (?:me |us )?(?:a |another |one more |some )?(?:joke|jokes|something funny)|make me (?:laugh|smile)|do you (?:know|have) (?:a |any )?jokes?|(?:a |another )?joke`,
    ),
    replies: {
      patient: [
        'Here is one: why did the banana go to the doctor? Because it was not peeling well! Laughing is good for you. Anything you would like to know about prostate health?',
        'Here is one: what did one wall say to the other wall? "I will meet you at the corner!" Is there anything I can help you with?',
        'Here is one: why do skeletons never fight each other? They do not have the guts! If you have a question about prostate health, just ask.',
      ],
      clinician: [
        'Why did the banana go to the doctor? It was not peeling well. Back to work: what do you need to look up?',
      ],
    },
  },
  {
    name: 'goodbye',
    pattern: whole(
      String.raw`bye(?:[\s-]?bye)?|good ?bye|see (?:you|ya|u)(?: (?:later|soon|tomorrow|next time))?|later|good ?night|night|take care|have a (?:nice|good|great|lovely) (?:day|night|evening|weekend)|talk (?:to you )?(?:later|soon)|ttyl|shalapo|shalenipo|tsalani bwino|ndapita|ciao`,
    ),
    replies: {
      patient: [
        'Goodbye, and take care. Speak to your clinician if anything worries you.',
      ],
      clinician: ['Goodbye.'],
    },
  },
  {
    name: 'yes',
    pattern: whole(
      String.raw`yes(?: please)?|yeah|yep|yup|sure|of course|please|ok(?:ay)? please|go on|go ahead`,
    ),
    replies: {
      patient: [
        'Sure! What would you like to know? You could ask, for example, what a PSA test measures, what happens during a DRE, or when to get help quickly.',
      ],
      clinician: ['Go ahead: what would you like to look up?'],
    },
  },
  {
    name: 'no',
    pattern: whole(
      String.raw`no(?: thanks?| thank you)?|nope|nah|nothing(?: else)?|that(?:'s| is) all|no more|i'?m done|i am done|all good|not now|not really`,
    ),
    replies: {
      patient: ['Alright. I am here if you think of anything else. Take care!'],
      clinician: ['Alright. I am here if you need anything else.'],
    },
  },
  {
    name: 'about',
    pattern: whole(
      String.raw`who are you|what are you|what can you do|how can you help(?: me)?|what do you do|what do you know|what can i ask(?: you)?|help(?: me)?|how does this work|what is this`,
    ),
    replies: {
      patient: [
        'I am the PCa mHealth assistant. I answer questions using reviewed health information and show where each answer comes from. I cannot see your records or tell you what your results mean: your clinician will do that. I am not for emergencies.',
      ],
      clinician: [
        'I am the PCa mHealth reference assistant. I answer from reviewed reference cards and show their sources. I support, but do not replace, clinical judgement or the local protocol.',
      ],
    },
  },
  {
    // Everyday things outside the assistant's job.
    name: 'off-topic',
    pattern: whole(
      String.raw`what(?:'s| is) the (?:time|date|day|weather)(?: (?:today|now|like))?|what time is it|what day is (?:it|today)|what(?:'s| is) the news|(?:tell me )?(?:the )?news|who won(?: the (?:match|game))?|sing(?: me)?(?: a)? song|play (?:a )?(?:song|music|game)|let'?s play|are you (?:married|single)|how old are you|do you (?:eat|sleep|dream)`,
    ),
    replies: {
      patient: [
        'That is outside what I can do: I cannot check the time, the weather or the news, and I am not much of a singer! I am here for questions about ' +
          HELP_TOPICS_PATIENT +
          '.',
      ],
      clinician: [
        'That is outside what I can do. I only look up the reviewed reference cards.',
      ],
    },
  },
  {
    name: 'acknowledgement',
    pattern: whole(
      String.raw`ok(?:ay)?|okey|k|kk|alright|all right|cool|nice|great|good|fine|i see|i understand|got it|understood|noted|makes sense|right|hmm+|mm+|oh|ah|wow|lol|haha+|hehe+|interesting|really|true|sounds good|perfect`,
    ),
    replies: {
      patient: [
        'Okay! Is there anything else you would like to know? You could ask about ' +
          HELP_TOPICS_PATIENT +
          '.',
      ],
      clinician: ['Okay. Anything else to look up?'],
    },
  },
];

/** A message of only emoji, for example a thumbs-up. */
const ONLY_EMOJI = new RegExp(`^(?:\\s|${EMOJI})+$`, 'u');

/**
 * A friendly fixed reply when the whole message is small talk, else null.
 * `turn` (the number of earlier messages) varies replies that have more than
 * one version, such as a greeting later in a conversation or another joke.
 */
export function smallTalk(
  text: string,
  audience: ChatAudience,
  turn = 0,
): string | null {
  const reply = (replies: Replies) => {
    const options = replies[audience];
    return options[turn % options.length];
  };
  if (ONLY_EMOJI.test(text)) {
    const acknowledgement = INTENTS.find((i) => i.name === 'acknowledgement')!;
    return reply(acknowledgement.replies);
  }
  const intent = INTENTS.find((i) => i.pattern.test(text));
  return intent ? reply(intent.replies) : null;
}

/** The intent names, for tests and the audit reason. */
export function smallTalkIntent(text: string): string | null {
  if (ONLY_EMOJI.test(text)) return 'acknowledgement';
  return INTENTS.find((i) => i.pattern.test(text))?.name ?? null;
}

const DOSE_IN_ANSWER =
  /\b\d+(\.\d+)?\s?(mg|mcg|µg|milligrams?|micrograms?|tablets?|capsules?)\b/i;

/**
 * The last check before an answer is shown: it must have a source, must
 * not mention a dose, and must fit on a phone screen.
 */
export function checkAnswer(
  text: string | null,
  sources: number,
): { ok: true } | { ok: false; reason: string } {
  if (!text || sources === 0) return { ok: false, reason: 'no-source' };
  if (DOSE_IN_ANSWER.test(text)) return { ok: false, reason: 'dose-in-answer' };
  if (text.length > 4000) return { ok: false, reason: 'too-long' };
  return { ok: true };
}
