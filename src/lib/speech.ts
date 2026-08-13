export type SpeechSpeed = "slow" | "normal";

const SPEECH_RATES: Record<SpeechSpeed, number> = {
  slow: 0.86,
  normal: 1,
};

export function canSpeakEnglish() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function cancelEnglishSpeech() {
  if (canSpeakEnglish()) window.speechSynthesis.cancel();
}

export function speakEnglish(term: string, speed: SpeechSpeed) {
  if (!canSpeakEnglish()) return;
  cancelEnglishSpeech();
  const utterance = new SpeechSynthesisUtterance(term);
  utterance.lang = "en-US";
  utterance.rate = SPEECH_RATES[speed];
  window.speechSynthesis.speak(utterance);
}
