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
    'I do not have reviewed information about that. Please ask your clinician. You could also try asking in another way, for example about PSA, the prostate or screening.',
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
