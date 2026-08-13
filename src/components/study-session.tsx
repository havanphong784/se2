"use client";

import { FormEvent, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Headphones,
  Lightbulb,
  Sprout,
  Volume2,
  VolumeX,
  X,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import type { VocabularyDeck } from "@/lib/demo-data";
import {
  createMultipleChoiceOptions,
  getStudyShortcutAction,
  getStudySpeechSpeed,
  highlightTermInExample,
  moveFirstToEnd,
  type SessionSize,
  type StudyMode,
  type StudyPhase,
} from "@/lib/study";
import { cancelEnglishSpeech, canSpeakEnglish, speakEnglish } from "@/lib/speech";
import type {
  StudyEventResult,
  StudySessionDto,
  SubmitStudyEventResult,
} from "@/lib/study-service";
import { cn } from "@/lib/utils";

const AUTO_SPEAK_KEY = "vocabloom:auto-speak";

type EventPayload = {
  eventId: string;
  wordId: string;
  phase: StudyPhase;
  selectedWordId?: string;
  answer?: string;
};

type Feedback = {
  result: StudyEventResult;
  nextSession: StudySessionDto;
  selectedWordId?: string;
  submittedAnswer?: string;
};

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(
    target.closest("input, textarea, select, [contenteditable]:not([contenteditable='false'])"),
  );
}

function ShortcutKey({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded-md border border-current/25 bg-white/70 px-1.5 py-0.5 font-mono text-[0.7rem] font-extrabold leading-none shadow-sm">
      {children}
    </kbd>
  );
}

async function readSessionJson(response: Response) {
  const result = (await response.json()) as { session?: StudySessionDto; message?: string };
  if (!response.ok || !result.session) throw new Error(result.message ?? "Không thể lưu phiên học.");
  return result.session;
}

async function readEventJson(response: Response) {
  const result = (await response.json()) as Partial<SubmitStudyEventResult> & { message?: string };
  if (!response.ok || !result.session || !result.result) {
    throw new Error(result.message ?? "Không thể lưu câu trả lời.");
  }
  return result as SubmitStudyEventResult;
}

export function StudySession({ mode, deck }: { mode: StudyMode; deck?: VocabularyDeck }) {
  const [requestedSize, setRequestedSize] = useState<SessionSize>(10);
  const [session, setSession] = useState<StudySessionDto | null>(null);
  const [queue, setQueue] = useState<string[]>([]);
  const [flashcardIndex, setFlashcardIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [pendingEvent, setPendingEvent] = useState<EventPayload | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoSpeakEnabled, setAutoSpeakEnabled] = useState(
    () => typeof window === "undefined" || localStorage.getItem(AUTO_SPEAK_KEY) !== "false",
  );
  const speechSupported = canSpeakEnglish();
  const feedbackRef = useRef<HTMLDivElement>(null);
  const promptRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const wordById = useMemo(
    () => new Map(session?.words.map((word) => [word.id, word]) ?? []),
    [session],
  );
  const currentWord = session
    ? session.phase === "flashcard"
      ? session.words[flashcardIndex]
      : wordById.get(queue[0])
    : null;
  const options = useMemo(
    () =>
      session?.phase === "multiple_choice" && currentWord
        ? createMultipleChoiceOptions(
            currentWord,
            session.words,
            `${session.id}:${currentWord.id}`,
          )
        : [],
    [currentWord, session],
  );
  const actionLockRef = useRef(false);

  useEffect(
    () => () => {
      cancelEnglishSpeech();
    },
    [],
  );

  useEffect(() => {
    if (
      autoSpeakEnabled &&
      speechSupported &&
      currentWord &&
      !feedback &&
      (session?.phase === "flashcard" || session?.phase === "multiple_choice")
    ) {
      speakEnglish(currentWord.term, getStudySpeechSpeed(session.phase));
    }
  }, [autoSpeakEnabled, currentWord, feedback, session?.phase, speechSupported]);

  useEffect(() => {
    if (feedback) feedbackRef.current?.focus();
  }, [feedback]);

  useEffect(() => {
    if (!saving) actionLockRef.current = false;
  }, [saving]);

  const handleShortcut = useEffectEvent((event: KeyboardEvent) => {
    if (
      !session ||
      !session.phase ||
      session.status !== "active" ||
      !currentWord ||
      saving ||
      error ||
      pendingEvent ||
      actionLockRef.current ||
      event.defaultPrevented ||
      event.repeat ||
      event.isComposing ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      isEditableTarget(event.target) ||
      (event.key === "Enter" &&
        event.target instanceof HTMLElement &&
        Boolean(event.target.closest("button, a, [role='button']")))
    ) {
      return;
    }

    const action = getStudyShortcutAction({
      key: event.key,
      phase: session.phase,
      hasFeedback: Boolean(feedback),
      flashcardIndex,
      optionCount: options.length,
      canSpeak: speechSupported,
    });
    if (!action) return;

    event.preventDefault();
    if (action.type === "previous-flashcard") {
      setFlashcardIndex((index) => Math.max(0, index - 1));
    } else if (action.type === "next-flashcard") {
      actionLockRef.current = true;
      void nextFlashcard();
    } else if (action.type === "choose-option") {
      const option = options[action.optionIndex];
      if (!option) return;
      actionLockRef.current = true;
      chooseOption(option.id);
    } else if (action.type === "continue-feedback") {
      actionLockRef.current = true;
      continueAfterFeedback();
      requestAnimationFrame(() => {
        actionLockRef.current = false;
      });
    } else if (action.type === "toggle-auto-speak") {
      toggleAutoSpeak();
    } else {
      speakEnglish(
        session.phase === "typing" && feedback
          ? feedback.result.expectedAnswer
          : currentWord.term,
        getStudySpeechSpeed(session.phase),
      );
    }
  });

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      handleShortcut(event);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  function toggleAutoSpeak() {
    const next = !autoSpeakEnabled;
    setAutoSpeakEnabled(next);
    localStorage.setItem(AUTO_SPEAK_KEY, String(next));
    if (!next) cancelEnglishSpeech();
    if (next && currentWord && session?.phase && session.phase !== "typing") {
      speakEnglish(currentWord.term, getStudySpeechSpeed(session.phase));
    }
  }

  function resetQueue(nextSession: StudySessionDto) {
    if (nextSession.phase === "flashcard") {
      setQueue([]);
      return;
    }
    const completionKey =
      nextSession.phase === "multiple_choice" ? "multipleChoiceCompleted" : "typingCompleted";
    setQueue(nextSession.words.filter((word) => !word[completionKey]).map((word) => word.id));
  }

  async function start() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/study-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, deckId: deck?.id, requestedSize }),
      });
      const nextSession = await readSessionJson(response);
      setSession(nextSession);
      setFlashcardIndex(0);
      resetQueue(nextSession);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể bắt đầu phiên học.");
    } finally {
      setSaving(false);
    }
  }

  async function sendEvent(payload: EventPayload) {
    if (!session) throw new Error("Phiên học chưa bắt đầu.");
    const response = await fetch(`/api/study-sessions/${session.id}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return readEventJson(response);
  }

  async function nextFlashcard() {
    if (!session || !currentWord || saving || feedback) return;
    if (currentWord.flashcardCompleted) {
      setError(null);
      setFlashcardIndex((index) => Math.min(index + 1, session.words.length - 1));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const submitted = await sendEvent({
        eventId: crypto.randomUUID(),
        wordId: currentWord.id,
        phase: "flashcard",
      });
      setSession(submitted.session);
      if (submitted.session.phase === "multiple_choice") resetQueue(submitted.session);
      else setFlashcardIndex((index) => Math.min(index + 1, session.words.length - 1));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể lưu bước học.");
    } finally {
      setSaving(false);
    }
  }

  async function submitAnswer(payload: EventPayload) {
    setSaving(true);
    setError(null);
    setPendingEvent(payload);
    try {
      const submitted = await sendEvent(payload);
      setFeedback({
        result: submitted.result,
        nextSession: submitted.session,
        selectedWordId: payload.selectedWordId,
        submittedAnswer: payload.answer,
      });
      setPendingEvent(null);
      if (payload.phase === "typing" && autoSpeakEnabled) {
        speakEnglish(submitted.result.expectedAnswer, "normal");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể lưu câu trả lời.");
    } finally {
      setSaving(false);
    }
  }

  function chooseOption(selectedWordId: string) {
    if (!currentWord || saving || error || feedback) return;
    void submitAnswer({
      eventId: crypto.randomUUID(),
      wordId: currentWord.id,
      phase: "multiple_choice",
      selectedWordId,
    });
  }

  function submitTyping(event: FormEvent) {
    event.preventDefault();
    if (!currentWord || !answer.trim() || saving || feedback) return;
    void submitAnswer({
      eventId: crypto.randomUUID(),
      wordId: currentWord.id,
      phase: "typing",
      answer,
    });
  }

  function continueAfterFeedback() {
    if (!feedback || saving || error) return;
    const { nextSession, result } = feedback;
    setSession(nextSession);
    setFeedback(null);
    setError(null);
    setAnswer("");

    if (nextSession.status === "completed") {
      setQueue([]);
      return;
    }
    if (nextSession.phase !== result.phase) resetQueue(nextSession);
    else setQueue((items) => (result.isCorrect ? items.slice(1) : moveFirstToEnd(items)));

    requestAnimationFrame(() => {
      if (nextSession.phase === "typing") inputRef.current?.focus();
      else promptRef.current?.focus({ preventScroll: true });
    });
  }

  function closeSession() {
    if (!session || session.status !== "active") return;
    cancelEnglishSpeech();
    void fetch(`/api/study-sessions/${session.id}/abandon`, {
      method: "POST",
      keepalive: true,
    }).catch(() => undefined);
  }

  if (!session) {
    const available = mode === "learn" ? deck?.words.filter((word) => !word.learnedAt).length ?? 0 : null;
    return (
      <main className="grid min-h-svh place-items-center bg-[linear-gradient(180deg,#f8fff3_0%,#ffffff_55%)] px-5 py-10">
        <Card className="w-full max-w-xl border-eel-light bg-white/95 shadow-[0_12px_40px_rgba(67,143,14,0.08)]">
          <CardContent className="p-6 text-center md:p-9">
            <span className="mx-auto grid size-16 place-items-center rounded-full bg-[#efffe5]">
              <Sprout className="size-9 text-ecto-green" />
            </span>
            <Badge className="mt-4">{mode === "learn" ? "Học từ mới" : "Ôn từ đến hạn"}</Badge>
            <h1 className="mt-4 font-display text-3xl font-extrabold text-eel-dark-blue">Chọn quy mô phiên học</h1>
            <p className="mt-3 font-bold leading-7 text-ash">
              {mode === "learn"
                ? `Bộ “${deck?.title}” còn ${available} từ mới. Nếu không đủ, phiên sẽ dùng toàn bộ số từ còn lại.`
                : "Hệ thống ưu tiên từ quá hạn lâu nhất và từ chưa từng được ôn."}
            </p>
            <div className="mt-7 grid grid-cols-2 gap-3" role="group" aria-label="Số từ trong phiên">
              {([10, 20] as SessionSize[]).map((size) => (
                <button key={size} type="button" aria-pressed={requestedSize === size} onClick={() => setRequestedSize(size)} className={cn("min-h-20 rounded-xl border-2 border-b-4 text-xl font-extrabold transition", requestedSize === size ? "border-ecto-green bg-[#f7fff1] text-[#438f0e]" : "border-[#dedede] bg-white text-ash hover:border-macaw-blue")}>
                  {size} từ
                </button>
              ))}
            </div>
            <Button size="lg" className="mt-7 w-full" onClick={() => void start()} disabled={saving}>Bắt đầu <ArrowRight /></Button>
            {error && <p className="mt-3 text-sm font-bold text-[#c43e3e]">{error}</p>}
            <Link href={deck ? `/vocabulary/${deck.slug}` : "/vocabulary"} className={buttonVariants({ variant: "ghost", className: "mt-3" })}><ArrowLeft /> Quay lại</Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (session.status === "completed") {
    return (
      <main className="grid min-h-svh place-items-center bg-[linear-gradient(180deg,#f3ffe9,#fff)] px-5 text-center">
        <Card className="max-w-xl border-eel-light shadow-[0_16px_50px_rgba(67,143,14,0.1)]">
          <CardContent className="p-8 md:p-10">
            <span className="mx-auto grid size-20 place-items-center rounded-full bg-[#eaffdc]"><Check className="size-11 text-ecto-green" /></span>
            <h1 className="mt-5 font-display text-4xl font-extrabold text-eel-dark-blue">Hoàn thành phiên học</h1>
            <p className="mt-3 font-bold leading-7 text-ash">{mode === "learn" ? `${session.learnedCount} từ đã hoàn thành đủ ba bước và sẽ được ôn sau 3 ngày.` : `${session.reviewedCount} từ đã được ôn. Lịch tiếp theo đã cập nhật.`}</p>
            <div className="mt-6 grid grid-cols-2 divide-x-2 divide-[#eeeeee] border-y-2 border-[#eeeeee] py-5 font-extrabold text-ash"><span>{session.attemptCount}<small className="mt-1 block">lượt trả lời</small></span><span>{session.incorrectCount}<small className="mt-1 block">lượt sai</small></span></div>
            <Link href="/vocabulary" className={buttonVariants({ size: "lg", className: "mt-7" })}>Về thư viện</Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  const phaseLabel = session.phase === "flashcard" ? "Làm quen" : session.phase === "multiple_choice" ? "Trắc nghiệm" : "Nhập từ";
  const completedUnits = session.words.reduce((sum, item) => sum + Number(item.flashcardCompleted) + Number(item.multipleChoiceCompleted) + Number(item.typingCompleted), 0);
  const totalUnits = mode === "learn" ? session.selectedSize * 3 : session.selectedSize;
  const progress = Math.round(((mode === "learn" ? completedUnits : session.words.filter((word) => word.typingCompleted).length) / Math.max(1, totalUnits)) * 100);

  return (
    <div className="min-h-svh bg-[linear-gradient(180deg,#fbfff8_0%,#fff_40%)]">
      <header className="border-b-2 border-[#eeeeee] bg-white/90 backdrop-blur">
        <div className="mx-auto flex min-h-20 max-w-[980px] items-center gap-3 px-4">
          <Link href={deck ? `/vocabulary/${deck.slug}` : "/vocabulary"} onClick={closeSession} aria-label="Đóng phiên học" className="grid size-11 place-items-center rounded-xl text-ash hover:bg-[#f5f5f5]"><X /></Link>
          <div className="flex-1"><div className="mb-1.5 flex justify-between text-xs font-extrabold text-ash"><span>{phaseLabel}</span><span>{progress}%</span></div><Progress value={progress} aria-label={`${phaseLabel}: ${progress}%`} className="h-3" /></div>
          <Button type="button" variant={autoSpeakEnabled ? "outline" : "secondary"} size="sm" aria-pressed={autoSpeakEnabled} aria-keyshortcuts="M" aria-label={autoSpeakEnabled ? "Tắt tự động phát âm" : "Bật tự động phát âm"} disabled={!speechSupported} onClick={toggleAutoSpeak} className="px-3 sm:px-4">
            {autoSpeakEnabled ? <Volume2 /> : <VolumeX />}<span className="hidden sm:inline">Tự phát âm</span><ShortcutKey>M</ShortcutKey>
          </Button>
        </div>
      </header>

      <main className="mx-auto flex min-h-[calc(100svh-80px)] max-w-[860px] flex-col justify-center px-5 py-8">
        {session.phase === "flashcard" && currentWord && (
          <Card ref={promptRef} tabIndex={-1} className="mx-auto flex w-full max-w-[600px] flex-col overflow-hidden border-eel-light border-b-4 outline-none shadow-[0_12px_35px_rgba(30,70,20,0.07)] focus-visible:ring-4 focus-visible:ring-eel-light sm:min-h-[450px]">
            <CardHeader className="min-h-12 justify-center border-b-2 border-[#f0f0f0] bg-[#fbfff8] px-5 py-2.5">
              <div className="flex w-full items-center justify-between gap-3">
                <Badge variant="blue" className="min-w-0 whitespace-normal text-left">{currentWord.partOfSpeech}</Badge>
                <span className="shrink-0 text-xs font-extrabold text-ash tabular-nums">{flashcardIndex + 1} / {session.words.length}</span>
              </div>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col p-5 text-center sm:p-6">
              <div className="flex flex-wrap items-center justify-center gap-3">
                <h1 className="min-w-0 break-words font-display text-4xl font-extrabold text-eel-dark-blue sm:text-5xl">{currentWord.term}</h1>
                <Button type="button" variant="blue" size="icon" className="size-10 shrink-0" onClick={() => speakEnglish(currentWord.term, "slow")} aria-label={`Nghe ${currentWord.term}`} aria-keyshortcuts="P" disabled={!speechSupported}><Volume2 /><span className="sr-only">Phím P</span></Button>
              </div>
              <p className="mt-1.5 text-base font-extrabold text-macaw-blue">{currentWord.phonetic}</p>
              <div className="mt-4 rounded-xl border-2 border-lingot-lime/70 bg-[#f7fff1] px-4 py-4"><p className="text-xs font-extrabold uppercase tracking-[0.12em] text-[#438f0e]">Nghĩa tiếng Việt</p><p className="mt-1 text-2xl font-extrabold text-[#438f0e]">{currentWord.translation}</p></div>
              <div className="mt-3 rounded-xl border-2 border-[#eeeeee] bg-[#fcfcfc] p-4 text-left">
                <p className="mb-1.5 text-xs font-extrabold uppercase tracking-[0.12em] text-ash">Ví dụ</p>
                <p className="font-bold leading-6 text-charcoal">{highlightTermInExample(currentWord.exampleSentence, currentWord.term).map((part, index) => part.highlighted ? <strong key={`${part.text}-${index}`} className="font-extrabold text-eel-dark-blue">{part.text}</strong> : <span key={`${part.text}-${index}`}>{part.text}</span>)}</p>
                <p className="mt-1.5 text-sm font-bold text-ash">{currentWord.exampleTranslation}</p>
              </div>
            </CardContent>
            <CardFooter className="mt-auto grid min-h-[68px] grid-cols-2 gap-3 border-t-2 border-[#f0f0f0] bg-[#fcfcfc] p-3 sm:p-4">
              <Button variant="secondary" size="lg" className="w-full" disabled={saving || flashcardIndex === 0} onClick={() => setFlashcardIndex((index) => index - 1)} aria-keyshortcuts="ArrowLeft"><ArrowLeft /> Lùi <span className="hidden sm:inline"><ShortcutKey>←</ShortcutKey></span></Button>
              <Button size="lg" className="w-full px-3" disabled={saving} onClick={() => void nextFlashcard()} aria-keyshortcuts="ArrowRight"><span className="truncate">{flashcardIndex === session.words.length - 1 ? "Sang trắc nghiệm" : "Tiếp"}</span> <span className="hidden sm:inline"><ShortcutKey>→</ShortcutKey></span> <ArrowRight /></Button>
            </CardFooter>
          </Card>
        )}

        {session.phase === "multiple_choice" && currentWord && (
          <section aria-labelledby="quiz-prompt">
            <div ref={promptRef} tabIndex={-1} className="mb-7 rounded-xl text-center outline-none focus-visible:ring-4 focus-visible:ring-eel-light"><Badge variant="blue"><Headphones className="size-4" /> Chọn nghĩa đúng</Badge><h1 id="quiz-prompt" className="mt-4 font-display text-5xl font-extrabold text-eel-dark-blue sm:text-6xl">{currentWord.term}</h1><button type="button" onClick={() => speakEnglish(currentWord.term, "normal")} className="mt-3 inline-flex items-center gap-2 font-extrabold text-macaw-blue hover:underline" disabled={!speechSupported} aria-keyshortcuts="P"><Volume2 className="size-5" /> {currentWord.phonetic} <ShortcutKey>P</ShortcutKey></button></div>
            <div className="grid gap-3 sm:grid-cols-2" role="group" aria-label={`Chọn nghĩa của ${currentWord.term}`}>
              {options.map((option, index) => {
                const selected = feedback?.selectedWordId === option.id;
                const expected = feedback?.result.expectedAnswer === option.translation;
                const stateClass = feedback ? expected ? "border-ecto-green bg-[#f2ffe9] text-[#438f0e]" : selected ? "border-[#ff6b6b] bg-[#fff3f3] text-[#b93636]" : "border-[#dedede] bg-white text-ash opacity-65" : "border-[#dedede] bg-white text-charcoal hover:-translate-y-0.5 hover:border-macaw-blue hover:bg-[#f5fbff]";
                const letter = String.fromCharCode(65 + index);
                return <button key={option.id} type="button" disabled={saving || Boolean(feedback)} onClick={() => chooseOption(option.id)} aria-keyshortcuts={`${index + 1} ${letter}`} className={cn("flex min-h-24 items-center gap-4 rounded-xl border-2 border-b-4 px-5 text-left text-lg font-extrabold transition motion-reduce:transition-none", stateClass)}><span className="grid size-9 shrink-0 place-items-center rounded-lg border-2 border-current text-sm">{letter}</span><span className="flex-1">{option.translation}</span>{!feedback && <ShortcutKey>{index + 1}</ShortcutKey>}{feedback && expected && <CheckCircle2 className="text-ecto-green" />}{feedback && selected && !expected && <XCircle className="text-[#d94e4e]" />}</button>;
              })}
            </div>
          </section>
        )}

        {session.phase === "typing" && currentWord && (
          <Card ref={promptRef} tabIndex={-1} className={cn("mx-auto w-full max-w-2xl border-b-4 outline-none shadow-[0_12px_35px_rgba(30,70,20,0.07)] focus-visible:ring-4 focus-visible:ring-eel-light", feedback?.result.isCorrect === true && "border-ecto-green", feedback?.result.isCorrect === false && "border-[#ff6b6b]")}>
            <CardContent className="p-6 text-center md:p-10">
              <Badge variant="blue">Nhập từ tiếng Anh</Badge>
              <p className="mt-6 text-sm font-extrabold uppercase tracking-[0.12em] text-ash">Nghĩa tiếng Việt</p>
              <h1 className="mt-3 font-display text-4xl font-extrabold text-[#438f0e] sm:text-5xl">{currentWord.translation}</h1>
              <form onSubmit={submitTyping} className="mt-8">
                <label className="block text-left"><span className="mb-2 block text-sm font-extrabold text-charcoal">Câu trả lời của bạn</span><Input ref={inputRef} autoFocus value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Nhập từ tiếng Anh…" className={cn("h-16 text-center text-xl font-extrabold", feedback?.result.isCorrect === true && "border-ecto-green bg-[#f7fff1]", feedback?.result.isCorrect === false && "border-[#ff6b6b] bg-[#fff7f7]")} disabled={saving || Boolean(feedback)} maxLength={256} /></label>
                <p className="mt-2 text-sm font-bold text-ash">Không phân biệt chữ hoa, chữ thường và khoảng trắng thừa.</p>
                {!feedback && <Button type="submit" size="lg" className="mt-5 w-full" disabled={saving || !answer.trim()}>{saving ? "Đang kiểm tra…" : "Kiểm tra"} <ArrowRight /></Button>}
              </form>
            </CardContent>
          </Card>
        )}

        {feedback && (
          <div ref={feedbackRef} tabIndex={-1} role="status" aria-live="polite" aria-atomic="true" className={cn("mt-6 rounded-xl border-2 border-b-4 p-5 outline-none sm:flex sm:items-center sm:justify-between sm:gap-5", feedback.result.isCorrect ? "border-ecto-green bg-[#f2ffe9]" : "border-[#ff6b6b] bg-[#fff3f3]")}>
            <div className="flex gap-3">{feedback.result.isCorrect ? <CheckCircle2 className="mt-0.5 size-7 shrink-0 text-ecto-green" /> : <XCircle className="mt-0.5 size-7 shrink-0 text-[#d94e4e]" />}<div><h2 className={cn("text-xl font-extrabold", feedback.result.isCorrect ? "text-[#438f0e]" : "text-[#b93636]")}>{feedback.result.isCorrect ? "Chính xác!" : "Chưa đúng"}</h2>{!feedback.result.isCorrect && <p className="mt-1 font-bold text-charcoal">Đáp án đúng: <strong>{feedback.result.expectedAnswer}</strong></p>}{!feedback.result.isCorrect && feedback.result.phase === "typing" && currentWord?.phonetic.trim() && <p className="mt-1 font-extrabold text-macaw-blue">{currentWord.phonetic}</p>}{feedback.submittedAnswer && !feedback.result.isCorrect && <p className="mt-1 text-sm font-bold text-ash">Bạn đã nhập: {feedback.submittedAnswer}</p>}</div></div>
            <div className="mt-4 flex gap-2 sm:mt-0">{session.phase === "typing" && <Button type="button" variant="secondary" size="icon" onClick={() => speakEnglish(feedback.result.expectedAnswer, "normal")} aria-label={`Nghe ${feedback.result.expectedAnswer}`} aria-keyshortcuts="P" disabled={!speechSupported}><Volume2 /><span className="sr-only">Phím P</span></Button>}<Button type="button" size="lg" onClick={continueAfterFeedback} aria-keyshortcuts="Enter">Tiếp tục <ShortcutKey>Enter</ShortcutKey> <ArrowRight /></Button></div>
          </div>
        )}

        {error && <div className="mt-5 rounded-xl border-2 border-[#ffb4b4] bg-[#fff7f7] p-4 text-center font-bold text-[#c43e3e]" role="alert"><p>{error}</p>{pendingEvent && <Button type="button" variant="danger" size="sm" className="mt-3" disabled={saving} onClick={() => void submitAnswer(pendingEvent)}>Thử lại</Button>}</div>}
        {!feedback && !error && session.phase !== "flashcard" && <p className="mt-5 flex items-center justify-center gap-2 text-center text-sm font-bold text-ash"><Lightbulb className="size-4 text-[#b47b00]" /> Từ trả lời sai sẽ quay lại cuối phần luyện tập.</p>}
      </main>
    </div>
  );
}
