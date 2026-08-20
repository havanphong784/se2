export type SpeechSpeed = "slow" | "normal";

const SPEECH_RATES: Record<SpeechSpeed, number> = {
  slow: 0.86,
  normal: 1,
};

// Map âm IPA đơn lẻ sang chuỗi phát âm mô phỏng cho Web Speech API khi fallback
const IPA_PHONETIC_TTS_MAP: Record<string, string> = {
  "i-long": "eeee",
  "i-short": "ih",
  "u-short": "uh",
  "u-long": "ooo",
  "e-short": "eh",
  schwa: "uh",
  "er-long": "urr",
  "or-long": "aww",
  "ae-short": "ah",
  "ah-short": "uh",
  "ar-long": "ahhh",
  "o-short": "oh",
  "diphthong-ey": "ay",
  "diphthong-ai": "eye",
  "diphthong-oy": "oy",
  "diphthong-oh": "oh",
  "diphthong-ow": "ow",
  "diphthong-ear": "ear",
  "diphthong-air": "air",
  "diphthong-oor": "oor",
  "p-sound": "puh",
  "b-sound": "buh",
  "t-sound": "tuh",
  "d-sound": "duh",
  "k-sound": "kuh",
  "g-sound": "guh",
  "ch-sound": "chuh",
  "j-sound": "juh",
  "f-sound": "fuh",
  "v-sound": "vuh",
  "th-unvoiced": "thuh",
  "th-voiced": "thuh",
  "s-sound": "suh",
  "z-sound": "zuh",
  "sh-sound": "shuh",
  "zh-sound": "zhuh",
  "h-sound": "huh",
  "m-sound": "muh",
  "n-sound": "nuh",
  "ng-sound": "ng",
  "l-sound": "luh",
  "r-sound": "ruh",
  "w-sound": "wuh",
  "y-sound": "yuh",
};

let currentAudio: HTMLAudioElement | null = null;
let currentUtterance: SpeechSynthesisUtterance | null = null;

export function canSpeakEnglish() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function cancelEnglishSpeech() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  if (canSpeakEnglish()) window.speechSynthesis.cancel();
  currentUtterance = null;
}

export function speakEnglish(term: string, speed: SpeechSpeed = "normal") {
  if (!canSpeakEnglish()) return;
  cancelEnglishSpeech();
  const synthesis = window.speechSynthesis;
  const utterance = new SpeechSynthesisUtterance(term);
  const voices = synthesis.getVoices();
  const voice =
    voices.find((item) => item.lang.toLowerCase() === "en-gb") ??
    voices.find((item) => item.lang.toLowerCase().startsWith("en"));
  currentUtterance = utterance;
  utterance.voice = voice ?? null;
  utterance.lang = voice?.lang ?? "en-US";
  utterance.rate = SPEECH_RATES[speed];
  utterance.onend = utterance.onerror = () => {
    if (currentUtterance === utterance) currentUtterance = null;
  };
  synthesis.resume();
  synthesis.speak(utterance);
}

export function speakIpaSound(soundId: string, symbol: string, audioUrl?: string) {
  cancelEnglishSpeech();

  if (audioUrl) {
    try {
      const audio = new Audio(audioUrl);
      currentAudio = audio;
      audio.play().catch(() => {
        // Fallback sang SpeechSynthesis nếu phát mp3/ogg bị lỗi
        fallbackSpeakIpa(soundId, symbol);
      });
      return;
    } catch {
      // Fallback
    }
  }

  fallbackSpeakIpa(soundId, symbol);
}

function fallbackSpeakIpa(soundId: string, symbol: string) {
  if (!canSpeakEnglish()) return;
  const ttsText = IPA_PHONETIC_TTS_MAP[soundId] || symbol;
  const utterance = new SpeechSynthesisUtterance(ttsText);
  utterance.lang = "en-GB";
  utterance.rate = 0.8;
  window.speechSynthesis.speak(utterance);
}

