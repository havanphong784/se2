"use client";

import { FormEvent, MouseEvent, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Headphones,
  Sprout,
  Volume2,
  VolumeX,
  X,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import type { VocabularyDeck } from "@/lib/demo-data";
import {
  applyStudyResult,
  createMultipleChoiceOptions,
  evaluateStudyAnswer,
  getStudyShortcutAction,
  getStudySpeechSpeed,
  highlightTermInExample,
  moveFirstToEnd,
  type SessionSize,
  type StudyEventResult,
  type StudyMode,
  type StudyPhase,
  type StudySessionDto,
} from "@/lib/study";
import { cancelEnglishSpeech, canSpeakEnglish, speakEnglish } from "@/lib/speech";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth-provider";
import { useInvalidateAuthData } from "@/lib/hooks/use-queries";

const AUTO_SPEAK_KEY = "vocabloom:auto-speak";

type EventPayload = {
  wordId: string;
  phase: StudyPhase;
  selectedWordId?: string;
  answer?: string;
};

type CompletionPayload = {
  eventId: string;
  wordId: string;
  answer: string;
  incorrectAttemptCount: number;
  isCorrect: boolean;
};

type PendingWrite = CompletionPayload & { failed: boolean };

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
    <kbd className="rounded border border-[#d0d0d0] bg-[#f5f5f5] px-1.5 py-0.5 font-mono text-[11px] font-extrabold text-charcoal">
      {children}
    </kbd>
  );
}

async function readSessionJson(response: Response) {
  const result = (await response.json()) as { session?: StudySessionDto; message?: string };
  if (!response.ok || !result.session) throw new Error(result.message ?? "Không thể lưu phiên học.");
  return result.session;
}

async function ensureEventSaved(response: Response) {
  if (response.ok) return;
  const result = (await response.json()) as { message?: string };
  throw new Error(result.message ?? "Không thể lưu câu trả lời.");
}

export function StudySession({ mode, deck }: { mode: StudyMode; deck?: VocabularyDeck }) {
  const { authFetch } = useAuth();
  const invalidateAuthData = useInvalidateAuthData();
  const [requestedSize, setRequestedSize] = useState<SessionSize>(10);
  const [session, setSession] = useState<StudySessionDto | null>(null);
  const [queue, setQueue] = useState<string[]>([]);
  const [flashcardIndex, setFlashcardIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [pendingWrites, setPendingWrites] = useState<PendingWrite[]>([]);
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
  const writeChainRef = useRef<Promise<void>>(Promise.resolve());
  const completionInvalidatedRef = useRef(false);

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
    if (pendingWrites.length === 0) return;
    const preventUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", preventUnload);
    return () => window.removeEventListener("beforeunload", preventUnload);
  }, [pendingWrites.length]);

  useEffect(() => {
    if (
      session?.status === "completed" &&
      pendingWrites.length === 0 &&
      !completionInvalidatedRef.current
    ) {
      completionInvalidatedRef.current = true;
      invalidateAuthData();
    }
  }, [invalidateAuthData, pendingWrites.length, session?.status]);

  const handleShortcut = useEffectEvent((event: KeyboardEvent) => {
    if (
      !session ||
      !session.phase ||
      session.status !== "active" ||
      !currentWord ||
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
      nextFlashcard();
      requestAnimationFrame(() => {
        actionLockRef.current = false;
      });
    } else if (action.type === "choose-option") {
      const option = options[action.optionIndex];
      if (!option) return;
      actionLockRef.current = true;
      chooseOption(option.id);
      requestAnimationFrame(() => {
        actionLockRef.current = false;
      });
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
      const response = await authFetch("/api/study-sessions", {
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

  async function sendCompletion(payload: CompletionPayload) {
    if (!session) throw new Error("Phiên học chưa bắt đầu.");
    const response = await authFetch(`/api/study-sessions/${session.id}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    });
    await ensureEventSaved(response);
  }

  function saveCompletion(payload: CompletionPayload) {
    setPendingWrites((items) => [
      ...items.filter((item) => item.eventId !== payload.eventId),
      { ...payload, failed: false },
    ]);
    const request = writeChainRef.current.then(() => sendCompletion(payload));
    writeChainRef.current = request;
    void request
      .then(() => {
        setPendingWrites((items) => items.filter((item) => item.eventId !== payload.eventId));
      })
      .catch((caught) => {
        setPendingWrites((items) =>
          items.map((item) =>
            item.eventId === payload.eventId ? { ...item, failed: true } : item,
          ),
        );
        setError(caught instanceof Error ? caught.message : "Không thể lưu câu trả lời.");
      });
  }

  async function retryFailedWrites(items: PendingWrite[]) {
    setError(null);
    for (const item of items) {
      setPendingWrites((pending) =>
        pending.map((entry) =>
          entry.eventId === item.eventId ? { ...entry, failed: false } : entry,
        ),
      );
      try {
        await sendCompletion(item);
        setPendingWrites((pending) =>
          pending.filter((entry) => entry.eventId !== item.eventId),
        );
      } catch (caught) {
        setPendingWrites((pending) =>
          pending.map((entry) =>
            entry.eventId === item.eventId ? { ...entry, failed: true } : entry,
          ),
        );
        setError(caught instanceof Error ? caught.message : "Không thể lưu câu trả lời.");
        break;
      }
    }
  }

  function nextFlashcard() {
    if (!session || !currentWord || feedback) return;
    const result: StudyEventResult = {
      wordId: currentWord.id,
      phase: "flashcard",
      isCorrect: true,
      expectedAnswer: currentWord.translation,
    };
    const nextSession = applyStudyResult(session, result);
    setSession(nextSession);
    setError(null);
    if (nextSession.phase === "multiple_choice") resetQueue(nextSession);
    else setFlashcardIndex((index) => Math.min(index + 1, session.words.length - 1));
  }

  function submitAnswer(payload: EventPayload) {
    if (!session || !currentWord) return;
    const grading = evaluateStudyAnswer({
      phase: payload.phase,
      wordId: currentWord.id,
      term: currentWord.term,
      translation: currentWord.translation,
      selectedWordId: payload.selectedWordId,
      answer: payload.answer,
    });
    const result: StudyEventResult = { ...payload, ...grading };
    const nextSession = applyStudyResult(session, result);
    setFeedback({
      result,
      nextSession,
      selectedWordId: payload.selectedWordId,
      submittedAnswer: payload.answer,
    });
    setError(null);
    if (payload.phase === "typing" && autoSpeakEnabled) {
      speakEnglish(result.expectedAnswer, "normal");
    }
    const firstReviewAttempt =
      session.mode === "review" &&
      payload.phase === "typing" &&
      currentWord.incorrectAttemptCount === 0;
    if (
      payload.phase === "typing" &&
      (session.mode === "review" ? firstReviewAttempt : result.isCorrect)
    ) {
      saveCompletion({
        eventId: crypto.randomUUID(),
        wordId: payload.wordId,
        answer: payload.answer ?? "",
        incorrectAttemptCount:
          nextSession.words.find((word) => word.id === payload.wordId)?.incorrectAttemptCount ?? 0,
        isCorrect: result.isCorrect,
      });
    }
  }

  function chooseOption(selectedWordId: string) {
    if (!currentWord || feedback) return;
    submitAnswer({
      wordId: currentWord.id,
      phase: "multiple_choice",
      selectedWordId,
    });
  }

  function submitTyping(event: FormEvent) {
    event.preventDefault();
    if (!currentWord || !answer.trim() || feedback) return;
    submitAnswer({
      wordId: currentWord.id,
      phase: "typing",
      answer,
    });
  }

  function continueAfterFeedback() {
    if (!feedback) return;
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

  function closeSession(event: MouseEvent<HTMLAnchorElement>) {
    if (!session || session.status !== "active") return;
    if (pendingWrites.length > 0) {
      event.preventDefault();
      setError("Đang lưu kết quả. Hãy thử lại sau giây lát.");
      return;
    }
    cancelEnglishSpeech();
    void authFetch(`/api/study-sessions/${session.id}/abandon`, {
      method: "POST",
      keepalive: true,
    }).catch(() => undefined);
  }

  if (!session) {
    const available = mode === "learn" ? deck?.words.filter((word) => !word.learnedAt).length ?? 0 : null;
    return (
      <main className="grid min-h-svh place-items-center bg-[linear-gradient(180deg,#f8fff3_0%,#ffffff_55%)] px-5 py-10">
        <Card className="w-full max-w-xl border-eel-light bg-white/95">
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

  if (session.status === "completed" && pendingWrites.length > 0) {
    const failedWrites = pendingWrites.filter((item) => item.failed);
    return (
      <main className="grid min-h-svh place-items-center bg-[linear-gradient(180deg,#f8fff3_0%,#ffffff_55%)] px-5 text-center">
        <Card className="w-full max-w-xl border-eel-light">
          <CardContent className="p-8 md:p-10">
            <h1 className="font-display text-3xl font-extrabold text-eel-dark-blue">
              {failedWrites.length ? "Chưa lưu được kết quả" : "Đang lưu kết quả…"}
            </h1>
            <p className="mt-3 font-bold text-ash">
              {failedWrites.length
                ? "Giữ trang này mở và thử lại để không mất tiến độ."
                : `Còn ${pendingWrites.length} từ đang được lưu.`}
            </p>
            {failedWrites.length > 0 && (
              <Button
                size="lg"
                className="mt-6"
                onClick={() => void retryFailedWrites(failedWrites)}
              >
                Thử lại
              </Button>
            )}
          </CardContent>
        </Card>
      </main>
    );
  }

  if (session.status === "completed") {
    return (
      <main className="grid min-h-svh place-items-center bg-[linear-gradient(180deg,#f3ffe9,#fff)] px-5 text-center">
        <Card className="max-w-xl border-eel-light">
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
    <div className="flex min-h-svh flex-col bg-[#fcfdfa]">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 border-b-2 border-[#eeeeee] bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-18 max-w-4xl items-center gap-4 px-4 sm:h-20 sm:px-6">
          <Link
            href={deck ? `/vocabulary/${deck.slug}` : "/vocabulary"}
            onClick={closeSession}
            aria-label="Đóng phiên học"
            className="grid size-10 shrink-0 place-items-center rounded-xl text-ash transition-colors hover:bg-[#f5f5f5] hover:text-charcoal sm:size-11"
          >
            <X className="size-5 sm:size-6" />
          </Link>

          <div className="flex-1">
            <div className="mb-1.5 flex items-center justify-between text-xs font-black">
              <span className="flex items-center gap-1.5 text-eel-dark-blue">
                <span className="inline-block size-2 rounded-full bg-ecto-green" />
                {phaseLabel}
              </span>
              <span className="font-extrabold text-ash tabular-nums">{progress}%</span>
            </div>
            <Progress value={progress} aria-label={`${phaseLabel}: ${progress}%`} className="h-3.5 bg-[#ebebeb]" />
          </div>

          <Button
            type="button"
            variant={autoSpeakEnabled ? "outline" : "secondary"}
            size="sm"
            aria-pressed={autoSpeakEnabled}
            aria-keyshortcuts="M"
            aria-label={autoSpeakEnabled ? "Tắt tự động phát âm" : "Bật tự động phát âm"}
            disabled={!speechSupported}
            onClick={toggleAutoSpeak}
            className="h-10 px-3 sm:px-4"
          >
            {autoSpeakEnabled ? <Volume2 className="size-4 text-ecto-green" /> : <VolumeX className="size-4 text-ash" />}
            <span className="hidden text-xs font-black sm:inline">Tự phát âm</span>
          </Button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-start px-4 pt-6 pb-40 sm:px-6 sm:pt-10">
        {/* FLASHCARD PHASE */}
        {session.phase === "flashcard" && currentWord && (
          <AnimatePresence mode="wait">
            <motion.div
              key={currentWord.id}
              initial={{ opacity: 0, x: 20, scale: 0.98 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -20, scale: 0.98 }}
              transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
              ref={promptRef}
              tabIndex={-1}
              className="mx-auto flex w-full max-w-lg flex-col overflow-hidden rounded-xl border-2 border-b-4 border-[#e5e5e5] border-b-[#dedede] bg-white outline-none focus-visible:ring-4 focus-visible:ring-lingot-lime/40"
            >
              {/* Card Top Meta */}
              <div className="flex items-center justify-between border-b-2 border-[#f0f0f0] bg-[#fafafa] px-5 py-3">
                <div className="flex items-center gap-1.5">
                  {currentWord.partOfSpeech.map((pos) => (
                    <Badge key={pos} variant="blue" className="text-[11px] font-black">
                      {pos}
                    </Badge>
                  ))}
                </div>
                <span className="text-xs font-black text-ash tabular-nums">
                  {flashcardIndex + 1} / {session.words.length} từ
                </span>
              </div>

              {/* Card Body */}
              <div className="flex flex-1 flex-col items-center p-6 text-center sm:p-8">
                {/* Term & Audio */}
                <div className="flex items-center justify-center gap-3">
                  <h1 className="font-display text-4xl font-black text-eel-dark-blue sm:text-5xl">
                    {currentWord.term}
                  </h1>
                  <button
                    type="button"
                    onClick={() => speakEnglish(currentWord.term, "slow")}
                    aria-label={`Nghe phát âm ${currentWord.term}`}
                    aria-keyshortcuts="P"
                    disabled={!speechSupported}
                    title="Nghe phát âm chậm (Phím P)"
                    className="grid size-11 shrink-0 place-items-center rounded-xl border-2 border-macaw-blue border-b-4 border-b-[#168bc2] bg-[#f4fbff] text-macaw-blue transition-transform hover:scale-105 active:translate-y-0.5"
                  >
                    <Volume2 className="size-5" />
                  </button>
                </div>

                {currentWord.phonetic && (
                  <p className="mt-1 font-mono text-sm font-black text-macaw-blue">
                    {currentWord.phonetic}
                  </p>
                )}

                {/* Translation Highlight Box */}
                <div className="mt-6 w-full rounded-xl border-2 border-b-4 border-lingot-lime border-b-[#8ed459] bg-[#f7fff1] py-4 px-5">
                  <p className="text-[10px] font-black uppercase tracking-wider text-[#438f0e]/80">
                    Nghĩa tiếng Việt
                  </p>
                  <p className="mt-0.5 font-display text-2xl font-black text-eel-dark-blue sm:text-3xl">
                    {currentWord.translation}
                  </p>
                </div>

                {/* Example Sentence Box */}
                {currentWord.exampleSentence && (
                  <div className="mt-3.5 w-full rounded-xl border-2 border-b-4 border-[#eeeeee] border-b-[#dedede] bg-[#fafafa] p-4 text-left sm:p-5">
                    <p className="text-[10px] font-black uppercase tracking-wider text-ash">
                      Câu ví dụ
                    </p>
                    <p className="mt-1 text-sm font-extrabold leading-relaxed text-charcoal">
                      {highlightTermInExample(currentWord.exampleSentence, currentWord.term).map((part, index) =>
                        part.highlighted ? (
                          <strong key={`${part.text}-${index}`} className="font-black text-ecto-green underline decoration-2 underline-offset-2">
                            {part.text}
                          </strong>
                        ) : (
                          <span key={`${part.text}-${index}`}>{part.text}</span>
                        ),
                      )}
                    </p>
                    {currentWord.exampleTranslation && (
                      <p className="mt-1 text-xs font-bold text-ash">
                        {currentWord.exampleTranslation}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Card Footer Actions */}
              <div className="grid grid-cols-2 gap-3 border-t-2 border-[#f0f0f0] bg-[#fafafa] p-4 sm:p-5">
                <Button
                  variant="secondary"
                  size="default"
                  className="w-full"
                  disabled={flashcardIndex === 0}
                  onClick={() => setFlashcardIndex((index) => index - 1)}
                  aria-keyshortcuts="ArrowLeft"
                >
                  <ArrowLeft className="size-4" /> Lùi
                </Button>
                <Button
                  size="default"
                  className="w-full"
                  onClick={nextFlashcard}
                  aria-keyshortcuts="ArrowRight"
                >
                  <span>{flashcardIndex === session.words.length - 1 ? "Trắc nghiệm" : "Tiếp theo"}</span>
                  <ArrowRight className="size-4" />
                </Button>
              </div>
            </motion.div>
          </AnimatePresence>
        )}

        {/* MULTIPLE CHOICE PHASE */}
        {session.phase === "multiple_choice" && currentWord && (
          <AnimatePresence mode="wait">
            <motion.div
              key={currentWord.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
              className="mx-auto w-full max-w-xl"
            >
              {/* Prompt Header */}
              <div ref={promptRef} tabIndex={-1} className="mb-6 text-center outline-none">
                <Badge variant="blue" className="gap-1.5 px-3 py-1 text-xs font-black">
                  <Headphones className="size-3.5" /> Chọn nghĩa đúng
                </Badge>
                <h1 id="quiz-prompt" className="mt-3 font-display text-4xl font-black text-eel-dark-blue sm:text-5xl">
                  {currentWord.term}
                </h1>
                <button
                  type="button"
                  onClick={() => speakEnglish(currentWord.term, "normal")}
                  className="mt-1.5 inline-flex items-center gap-1.5 font-mono text-xs font-black text-macaw-blue transition-colors hover:text-[#087db4]"
                  disabled={!speechSupported}
                  aria-keyshortcuts="P"
                >
                  <Volume2 className="size-3.5" /> {currentWord.phonetic}
                </button>
              </div>

              {/* Options Grid */}
              <div className="grid gap-3 sm:grid-cols-2" role="group" aria-label={`Chọn nghĩa của ${currentWord.term}`}>
                {options.map((option, index) => {
                  const selected = feedback?.selectedWordId === option.id;
                  const expected = feedback?.result.expectedAnswer === option.translation;
                  const letter = String.fromCharCode(65 + index);

                  let stateClass = "border-[#e5e5e5] border-b-[#dedede] bg-white text-charcoal hover:-translate-y-0.5 hover:border-macaw-blue hover:border-b-[#168bc2] hover:bg-[#f4fbff]";
                  let badgeClass = "border-[#e5e5e5] bg-[#fafafa] text-ash";

                  if (feedback) {
                    if (expected) {
                      stateClass = "border-ecto-green border-b-[#46a302] bg-[#f2ffe9] text-[#438f0e]";
                      badgeClass = "border-ecto-green bg-ecto-green text-white";
                    } else if (selected && !expected) {
                      stateClass = "border-[#ff6b6b] border-b-[#d94e4e] bg-[#fff3f3] text-[#b93636]";
                      badgeClass = "border-[#ff6b6b] bg-[#ff6b6b] text-white";
                    } else {
                      stateClass = "border-[#e5e5e5] border-b-[#dedede] bg-white text-ash/40 opacity-50";
                      badgeClass = "border-[#e5e5e5] bg-[#fafafa] text-ash/40";
                    }
                  }

                  return (
                    <motion.button
                      key={option.id}
                      type="button"
                      disabled={Boolean(feedback)}
                      onClick={() => chooseOption(option.id)}
                      aria-keyshortcuts={`${index + 1} ${letter}`}
                      animate={
                        feedback
                          ? expected
                            ? { scale: [1, 1.03, 1] }
                            : selected
                              ? { x: [0, -6, 6, -4, 4, 0] }
                              : {}
                          : {}
                      }
                      transition={{ duration: 0.3 }}
                      className={cn(
                        "flex min-h-[72px] items-center justify-between gap-3 rounded-xl border-2 border-b-4 p-4 text-left text-sm font-black transition-colors active:translate-y-0.5 sm:text-base",
                        stateClass,
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={cn("grid size-7 shrink-0 place-items-center rounded-lg border-2 text-xs font-black", badgeClass)}>
                          {letter}
                        </span>
                        <span className="font-extrabold text-charcoal">{option.translation}</span>
                      </div>

                      {feedback && expected && (
                        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 400, damping: 20 }}>
                          <CheckCircle2 className="size-5 text-ecto-green shrink-0" />
                        </motion.span>
                      )}
                      {feedback && selected && !expected && (
                        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 400, damping: 20 }}>
                          <XCircle className="size-5 text-[#d94e4e] shrink-0" />
                        </motion.span>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          </AnimatePresence>
        )}

        {/* TYPING PHASE */}
        {session.phase === "typing" && currentWord && (
          <AnimatePresence mode="wait">
            <motion.div
              key={currentWord.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{
                opacity: 1,
                y: 0,
                x: feedback?.result.isCorrect === false ? [0, -8, 8, -6, 6, -3, 3, 0] : 0,
                scale: feedback?.result.isCorrect === true ? [1, 1.02, 1] : 1,
              }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.3 }}
              ref={promptRef}
              tabIndex={-1}
              className={cn(
                "mx-auto w-full max-w-lg rounded-xl border-2 border-b-4 bg-white p-6 outline-none sm:p-8",
                feedback?.result.isCorrect === true
                  ? "border-ecto-green border-b-[#46a302]"
                  : feedback?.result.isCorrect === false
                    ? "border-[#ff6b6b] border-b-[#d94e4e]"
                    : "border-[#e5e5e5] border-b-[#dedede]",
              )}
            >
              <div className="text-center">
                <Badge variant="blue" className="text-xs font-black">
                  Gõ từ tiếng Anh
                </Badge>
                <p className="mt-4 text-[11px] font-black uppercase tracking-wider text-ash">
                  Nghĩa tiếng Việt
                </p>
                <h1 className="mt-1 font-display text-3xl font-black text-eel-dark-blue sm:text-4xl">
                  {currentWord.translation}
                </h1>

                <form onSubmit={submitTyping} className="mt-6">
                  <label className="block text-left">
                    <span className="mb-1.5 block text-xs font-black text-ash">
                      Nhập từ tiếng Anh tương ứng:
                    </span>
                    <Input
                      ref={inputRef}
                      autoFocus
                      value={answer}
                      onChange={(event) => setAnswer(event.target.value)}
                      placeholder="Gõ từ tiếng Anh…"
                      className={cn(
                        "h-14 text-center font-display text-2xl font-black text-eel-dark-blue transition-colors",
                        feedback?.result.isCorrect === true && "border-ecto-green bg-[#f7fff1] text-[#438f0e]",
                        feedback?.result.isCorrect === false && "border-[#ff6b6b] bg-[#fff7f7] text-[#b93636]",
                      )}
                      disabled={Boolean(feedback)}
                      maxLength={256}
                    />
                  </label>

                  {!feedback && (
                    <Button
                      type="submit"
                      size="lg"
                      className="mt-4 w-full"
                      disabled={!answer.trim()}
                    >
                      <span>Kiểm tra</span> <ArrowRight className="size-4" />
                    </Button>
                  )}
                </form>
              </div>
            </motion.div>
          </AnimatePresence>
        )}

      </main>

      {/* DOCKED BOTTOM FEEDBACK BAR (Fixed position so question content NEVER jumps) */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 450, damping: 32 }}
            ref={feedbackRef}
            tabIndex={-1}
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className={cn(
              "fixed inset-x-0 bottom-0 z-40 border-t-2 p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] outline-none sm:p-5",
              feedback.result.isCorrect
                ? "border-ecto-green bg-[#f2ffe9]"
                : "border-[#ff6b6b] bg-[#fff3f3]",
            )}
          >
            <div className="mx-auto flex max-w-2xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                {feedback.result.isCorrect ? (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 450, damping: 20 }}>
                    <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-ecto-green" />
                  </motion.div>
                ) : (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 450, damping: 20 }}>
                    <XCircle className="mt-0.5 size-6 shrink-0 text-[#d94e4e]" />
                  </motion.div>
                )}
                <div>
                  <h2 className={cn("text-lg font-black sm:text-xl", feedback.result.isCorrect ? "text-[#438f0e]" : "text-[#b93636]")}>
                    {feedback.result.isCorrect ? "Chính xác! Tuyệt vời" : "Chưa chính xác"}
                  </h2>
                  {!feedback.result.isCorrect && (
                    <p className="mt-0.5 text-xs font-bold text-charcoal sm:text-sm">
                      Đáp án đúng: <strong className="font-black text-eel-dark-blue text-sm sm:text-base">{feedback.result.expectedAnswer}</strong>
                    </p>
                  )}
                  {!feedback.result.isCorrect && feedback.result.phase === "typing" && currentWord?.phonetic.trim() && (
                    <p className="mt-0.5 font-mono text-xs font-black text-macaw-blue">
                      {currentWord.phonetic}
                    </p>
                  )}
                  {feedback.submittedAnswer && !feedback.result.isCorrect && (
                    <p className="mt-0.5 text-xs font-bold text-ash">
                      Bạn đã nhập: <span className="line-through">{feedback.submittedAnswer}</span>
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 sm:shrink-0">
                {session.phase === "typing" && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    onClick={() => speakEnglish(feedback.result.expectedAnswer, "normal")}
                    aria-label={`Nghe ${feedback.result.expectedAnswer}`}
                    aria-keyshortcuts="P"
                    disabled={!speechSupported}
                    className="size-11"
                  >
                    <Volume2 className="size-4 text-macaw-blue" />
                  </Button>
                )}
                <Button
                  type="button"
                  size="default"
                  variant={feedback.result.isCorrect ? "default" : "danger"}
                  onClick={continueAfterFeedback}
                  aria-keyshortcuts="Enter"
                  className="w-full sm:w-auto sm:min-w-[140px]"
                >
                  <span>Tiếp tục</span> <ArrowRight className="size-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <div className="mx-auto mt-5 w-full max-w-xl rounded-xl border-2 border-[#ffb4b4] bg-[#fff7f7] p-4 text-center font-bold text-[#c43e3e]" role="alert">
          <p>{error}</p>
        </div>
      )}

      {/* BOTTOM SHORTCUT GUIDANCE BAR */}
      <footer className="mt-8 flex flex-wrap items-center justify-center gap-3 text-xs font-bold text-ash">
        {session.phase === "flashcard" && (
          <>
            <span className="inline-flex items-center gap-1">
              <ShortcutKey>←</ShortcutKey> <ShortcutKey>→</ShortcutKey> Chuyển thẻ
            </span>
            <span>•</span>
            <span className="inline-flex items-center gap-1">
              <ShortcutKey>P</ShortcutKey> Nghe phát âm
            </span>
            <span>•</span>
            <span className="inline-flex items-center gap-1">
              <ShortcutKey>M</ShortcutKey> Tự phát âm
            </span>
          </>
        )}

        {session.phase === "multiple_choice" && !feedback && (
          <>
            <span className="inline-flex items-center gap-1">
              <ShortcutKey>1</ShortcutKey>–<ShortcutKey>4</ShortcutKey> hoặc <ShortcutKey>A</ShortcutKey>–<ShortcutKey>D</ShortcutKey> Chọn đáp án
            </span>
            <span>•</span>
            <span className="inline-flex items-center gap-1">
              <ShortcutKey>P</ShortcutKey> Nghe lại
            </span>
          </>
        )}

        {session.phase === "typing" && !feedback && (
          <span className="inline-flex items-center gap-1">
            <ShortcutKey>Enter</ShortcutKey> Kiểm tra câu trả lời
          </span>
        )}

        {feedback && (
          <>
            <span className="inline-flex items-center gap-1">
              <ShortcutKey>Enter</ShortcutKey> Chuyển tiếp
            </span>
            {session.phase === "typing" && (
              <>
                <span>•</span>
                <span className="inline-flex items-center gap-1">
                  <ShortcutKey>P</ShortcutKey> Nghe phát âm
                </span>
              </>
            )}
          </>
        )}
      </footer>
    </div>
  );
}
