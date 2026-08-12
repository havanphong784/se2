"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Check,
  Clock3,
  RotateCcw,
  Sprout,
  Volume2,
  X,
} from "lucide-react";

import { BrandName } from "@/components/brand-mark";
import { DataSourceNotice } from "@/components/data-source-notice";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { DataSource } from "@/lib/data";
import type { VocabularyDeck, VocabularyWord } from "@/lib/demo-data";
import {
  computeNextReview,
  createStudyQueue,
  MAX_CARD_PRESENTATIONS,
  summarizeSession,
  type Rating,
} from "@/lib/study";
import { cn } from "@/lib/utils";

const ratingMeta: Record<
  Rating,
  { label: string; color: string; shortcut: string }
> = {
  again: {
    label: "Chưa nhớ",
    color: "border-[#ff8f8f] border-b-[#d95f5f] text-[#c43e3e] hover:bg-[#fff7f7]",
    shortcut: "1",
  },
  hard: {
    label: "Hơi khó",
    color: "border-[#ffd66b] border-b-[#d9a82e] text-[#9b6b00] hover:bg-[#fffaf0]",
    shortcut: "2",
  },
  good: {
    label: "Đã nhớ",
    color: "border-ecto-green border-b-[#46a302] text-[#438f0e] hover:bg-[#f7fff1]",
    shortcut: "3",
  },
};

function formatReviewDelay(intervalDays: number, rating: Rating) {
  if (rating === "again") return "10 phút";
  const next = computeNextReview({ intervalDays }, rating, new Date());
  return `${next.intervalDays} ngày`;
}

function speak(term: string) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(term);
  utterance.lang = "en-US";
  utterance.rate = 0.86;
  window.speechSynthesis.speak(utterance);
}

function saveLocalRating(word: VocabularyWord, rating: Rating) {
  try {
    const key = "vocabloom:word-progress";
    const current = JSON.parse(localStorage.getItem(key) ?? "{}") as Record<string, unknown>;
    current[word.id] = { rating, reviewedAt: new Date().toISOString() };
    localStorage.setItem(key, JSON.stringify(current));
  } catch {
    // Browser storage is an optional fallback; PostgreSQL remains authoritative.
  }
}

export function StudySession({
  deck,
  dataSource = "database",
}: {
  deck: VocabularyDeck;
  dataSource?: DataSource;
}) {
  const [queueCreatedAt] = useState(() => new Date());
  const initialQueue = useMemo(
    () => createStudyQueue(deck.words, queueCreatedAt),
    [deck.words, queueCreatedAt],
  );
  const [queue, setQueue] = useState(initialQueue);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [finished, setFinished] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [sessionId, setSessionId] = useState(() => crypto.randomUUID());
  const cardRef = useRef<HTMLButtonElement>(null);
  const learnedWordIdsRef = useRef(new Set<string>());
  const repeatCountsRef = useRef(new Map<string, number>());
  const syncFailedRef = useRef(false);
  const word = queue[index];
  const progress = finished ? 100 : Math.round((index / queue.length) * 100);

  async function finishSession(nextRatings: Rating[]) {
    const summary = summarizeSession(nextRatings, queue.length);
    const durationSeconds = Math.max(1, Math.round((Date.now() - startedAt) / 1_000));

    if (syncFailedRef.current) {
      setSaveError(
        "Phiên học đã hoàn tất nhưng có tiến độ chưa đồng bộ. Kết quả phiên chưa được cộng vào máy chủ.",
      );
      setFinished(true);
      setSaving(false);
      return;
    }

    try {
      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          deckId: deck.id,
          reviewedCount: summary.reviewed,
          learnedCount: learnedWordIdsRef.current.size,
          correctCount: summary.hard + summary.good,
          durationSeconds,
        }),
      });
      const result = (await response.json()) as { persisted?: boolean };
      if (!response.ok || result.persisted !== true) throw new Error("Không thể lưu phiên học");
    } catch {
      setSaveError("Phiên học đã hoàn tất nhưng chưa đồng bộ được lên máy chủ.");
    } finally {
      setFinished(true);
      setSaving(false);
    }
  }

  async function rate(rating: Rating) {
    if (!flipped || saving || !word) return;
    setSaving(true);
    const nextRatings = [...ratings, rating];
    setRatings(nextRatings);
    saveLocalRating(word, rating);
    let repeatedWord = word;

    try {
      const response = await fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wordId: word.id,
          rating,
          intervalDays: word.intervalDays,
        }),
      });
      const result = (await response.json()) as {
        persisted?: boolean;
        status?: VocabularyWord["status"];
        mastery?: number;
        intervalDays?: number;
        nextReviewAt?: string;
      };
      if (!response.ok || result.persisted !== true) throw new Error("Không thể lưu tiến độ");
      repeatedWord = {
        ...word,
        status: result.status ?? word.status,
        mastery: result.mastery ?? word.mastery,
        intervalDays: result.intervalDays ?? word.intervalDays,
        nextReviewAt: result.nextReviewAt ?? word.nextReviewAt,
      };
      if (word.status === "new" && result.status !== "new") {
        learnedWordIdsRef.current.add(word.id);
      }
      setSaveError(null);
    } catch {
      syncFailedRef.current = true;
      setSaveError("Chưa đồng bộ được tiến độ. Kết quả vẫn được lưu trên thiết bị này.");
    }

    await new Promise((resolve) => window.setTimeout(resolve, 120));
    let nextQueue = queue;
    if (rating === "again") {
      const repeatCount = repeatCountsRef.current.get(word.id) ?? 0;
      if (repeatCount < MAX_CARD_PRESENTATIONS - 1) {
        repeatCountsRef.current.set(word.id, repeatCount + 1);
        nextQueue = [...queue, repeatedWord];
        setQueue(nextQueue);
      }
    }

    if (index === nextQueue.length - 1) {
      await finishSession(nextRatings);
    } else {
      setIndex((current) => current + 1);
      setFlipped(false);
      setSaving(false);
    }
  }

  function restart() {
    setQueue(initialQueue);
    setIndex(0);
    setFlipped(false);
    setRatings([]);
    setFinished(false);
    setSaving(false);
    setSaveError(null);
    setStartedAt(Date.now());
    setSessionId(crypto.randomUUID());
    learnedWordIdsRef.current.clear();
    repeatCountsRef.current.clear();
    syncFailedRef.current = false;
  }

  useEffect(() => {
    if (!finished) cardRef.current?.focus({ preventScroll: true });
  }, [finished, index]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!flipped || finished) return;
      const rating = ({ "1": "again", "2": "hard", "3": "good" } as const)[
        event.key as "1" | "2" | "3"
      ];
      if (rating) {
        event.preventDefault();
        void rate(rating);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  if (!queue.length) {
    return (
      <div className="grid min-h-svh place-items-center px-5 text-center">
        <div>
          <Sprout className="mx-auto size-12 text-ecto-green" />
          <h1 className="mt-4 text-2xl font-extrabold text-eel-dark-blue">Bộ từ đang trống</h1>
          <Link href="/vocabulary" className={buttonVariants({ className: "mt-6" })}>
            <ArrowLeft /> Quay lại thư viện
          </Link>
        </div>
      </div>
    );
  }

  const summary = summarizeSession(ratings, queue.length);

  return (
    <div className="min-h-svh bg-white">
      <header className="border-b-2 border-[#eeeeee] bg-white">
        <div className="mx-auto flex h-20 max-w-[940px] items-center gap-4 px-4 sm:px-6">
          <Link
            href={`/vocabulary/${deck.slug}`}
            aria-label="Đóng phiên học"
            className="grid size-11 shrink-0 place-items-center rounded-xl text-ash hover:bg-[#f5f5f5] focus-visible:ring-4 focus-visible:ring-lingot-lime/40"
          >
            <X className="size-6" />
          </Link>
          <Progress value={progress} className="h-4 flex-1" aria-label={`${progress}% phiên học`} />
          <span className="w-16 text-right text-sm font-extrabold text-ash tabular-nums">
            {finished ? queue.length : index + 1}/{queue.length}
          </span>
        </div>
      </header>

      {dataSource !== "database" && (
        <div className="mx-auto max-w-[940px] px-4 pt-5 sm:px-6">
          <DataSourceNotice source={dataSource} />
        </div>
      )}

      <AnimatePresence mode="wait">
        {finished ? (
          <motion.section
            key="summary"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.24, ease: [0.23, 1, 0.32, 1] }}
            className="mx-auto flex min-h-[calc(100svh-80px)] max-w-2xl flex-col items-center justify-center px-5 py-12 text-center"
          >
            <motion.div
              initial={{ y: 8 }}
              animate={{ y: [8, -5, 0] }}
              transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
              className="relative grid size-28 place-items-center rounded-xl border-2 border-ecto-green bg-[#f7fff1]"
            >
              <Sprout className="size-14 text-ecto-green" strokeWidth={2.3} />
              <motion.span
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.18 }}
                className="absolute -right-3 -top-3 grid size-10 place-items-center rounded-xl border-2 border-[#ffd66b] bg-white"
              >
                ✨
              </motion.span>
            </motion.div>
            <Badge className="mt-6">
              <Check className="size-4" /> Hoàn thành phiên học
            </Badge>
            <h1 className="mt-4 font-display text-balance text-[42px] font-extrabold leading-[1.08] text-eel-dark-blue md:text-[52px]">
              Khu vườn vừa xanh thêm!
            </h1>
            <p className="mt-3 max-w-lg text-pretty font-bold leading-7 text-ash">
              Bạn đã ôn hết {summary.reviewed} từ trong bộ “{deck.title}”. Hẹn gặp lại đúng lúc những từ này cần được tưới nhé.
            </p>
            {saveError && (
              <p role="status" className="mt-3 text-sm font-bold text-[#c43e3e]">
                {saveError}
              </p>
            )}

            <div className="mt-8 grid w-full grid-cols-3 divide-x-2 divide-[#eeeeee] border-y-2 border-[#eeeeee] py-5">
              <div>
                <p className="text-2xl font-extrabold text-[#c43e3e] tabular-nums">{summary.again}</p>
                <p className="mt-1 text-xs font-extrabold uppercase tracking-[0.06em] text-ash">Học lại</p>
              </div>
              <div>
                <p className="text-2xl font-extrabold text-[#9b6b00] tabular-nums">{summary.hard}</p>
                <p className="mt-1 text-xs font-extrabold uppercase tracking-[0.06em] text-ash">Hơi khó</p>
              </div>
              <div>
                <p className="text-2xl font-extrabold text-[#438f0e] tabular-nums">{summary.good}</p>
                <p className="mt-1 text-xs font-extrabold uppercase tracking-[0.06em] text-ash">Đã nhớ</p>
              </div>
            </div>

            <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
              <Button size="lg" onClick={restart}>
                <RotateCcw /> Học lại bộ này
              </Button>
              <Link
                href={`/vocabulary/${deck.slug}`}
                className={buttonVariants({ variant: "secondary", size: "lg" })}
              >
                Xem danh sách từ
              </Link>
            </div>
          </motion.section>
        ) : (
          <motion.section
            key={word.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="mx-auto flex min-h-[calc(100svh-80px)] max-w-[820px] flex-col px-4 py-6 sm:px-6 sm:py-8"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span aria-hidden="true" className="text-2xl">
                  {deck.emoji}
                </span>
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-[0.07em] text-ash">Bộ từ</p>
                  <p className="font-extrabold text-eel-dark-blue">{deck.title}</p>
                </div>
              </div>
              <Badge variant="neutral">
                <Clock3 className="size-4" /> Ôn ngắt quãng
              </Badge>
            </div>

            <div
              className="relative min-h-[390px] w-full flex-1 rounded-xl sm:min-h-[430px]"
              style={{ perspective: 1200 }}
            >
              <button
                ref={cardRef}
                type="button"
                aria-pressed={flipped}
                aria-label={flipped ? `Đáp án: ${word.translation}. Lật về mặt trước` : `Từ ${word.term}. Lật để xem nghĩa`}
                onClick={() => setFlipped((value) => !value)}
                className="absolute inset-0 rounded-xl focus-visible:ring-4 focus-visible:ring-macaw-blue/25"
              >
              <motion.div
                className="absolute inset-0"
                animate={{ rotateY: flipped ? 180 : 0 }}
                transition={{ duration: 0.42, ease: [0.77, 0, 0.175, 1] }}
                style={{ transformStyle: "preserve-3d" }}
              >
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center rounded-xl border-2 border-[#dedede] border-b-4 border-b-[#cfcfcf] bg-white p-7 text-center"
                  style={{ backfaceVisibility: "hidden" }}
                >
                  <Badge variant="blue" className="absolute left-5 top-5">
                    {word.partOfSpeech}
                  </Badge>
                  <p className="font-display text-balance text-[48px] font-extrabold leading-none text-eel-dark-blue sm:text-[64px]">
                    {word.term}
                  </p>
                  <p className="mt-5 text-lg font-extrabold text-macaw-blue">{word.phonetic}</p>
                  <span className="absolute bottom-6 inline-flex items-center gap-2 text-sm font-extrabold text-ash">
                    <RotateCcw className="size-4" /> Chạm để xem nghĩa
                  </span>
                </div>

                <div
                  className="absolute inset-0 flex flex-col items-center justify-center rounded-xl border-2 border-eel-light border-b-4 border-b-lingot-lime bg-[#fbfff8] p-7 text-center"
                  style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
                >
                  <Badge className="absolute left-5 top-5">Nghĩa tiếng Việt</Badge>
                  <p className="font-display text-balance text-[38px] font-extrabold leading-tight text-[#438f0e] sm:text-[50px]">
                    {word.translation}
                  </p>
                  <div className="mt-7 max-w-xl border-t-2 border-eel-light pt-6">
                    <p className="text-lg font-extrabold leading-7 text-eel-dark-blue">
                      {word.exampleSentence}
                    </p>
                    <p className="mt-2 font-bold leading-6 text-ash">{word.exampleTranslation}</p>
                  </div>
                  <span className="absolute bottom-6 inline-flex items-center gap-2 text-sm font-extrabold text-ash">
                    <RotateCcw className="size-4" /> Chạm để lật lại
                  </span>
                </div>
              </motion.div>
              </button>
              <button
                type="button"
                onClick={() => speak(word.term)}
                aria-label={`Nghe phát âm ${word.term}`}
                className={cn(
                  "absolute right-5 top-5 z-20 grid size-12 place-items-center rounded-xl border-2 border-macaw-blue bg-white text-macaw-blue transition-opacity hover:bg-[#f3fbff] focus-visible:ring-4 focus-visible:ring-macaw-blue/20",
                  flipped && "pointer-events-none opacity-0",
                )}
              >
                <Volume2 className="size-6" />
              </button>
            </div>

            <div className="mt-5 min-h-[86px]">
              {flipped ? (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="grid grid-cols-3 gap-2 sm:gap-3"
                >
                  {(Object.keys(ratingMeta) as Rating[]).map((rating) => {
                    const meta = ratingMeta[rating];
                    return (
                      <button
                        key={rating}
                        type="button"
                        disabled={saving}
                        onClick={() => void rate(rating)}
                        className={cn(
                          "min-h-[72px] rounded-xl border-2 border-b-4 bg-white px-2 font-extrabold transition-[transform,background-color,border-color] focus-visible:ring-4 focus-visible:ring-lingot-lime/40 active:translate-y-0.5 disabled:opacity-50",
                          meta.color,
                        )}
                      >
                        <span className="block text-sm sm:text-[15px]">{meta.label}</span>
                        <span className="mt-1 block text-[11px] opacity-70 sm:text-xs">
                          {formatReviewDelay(word.intervalDays, rating)} · phím {meta.shortcut}
                        </span>
                      </button>
                    );
                  })}
                </motion.div>
              ) : (
                <p className="flex min-h-[72px] items-center justify-center text-center text-sm font-extrabold text-ash">
                  Tự nhớ nghĩa trước, rồi lật thẻ để kiểm tra.
                </p>
              )}
            </div>
            {saveError && (
              <p role="status" className="mt-2 text-center text-sm font-bold text-[#c43e3e]">
                {saveError}
              </p>
            )}
            <span className="sr-only" aria-live="polite">
              {flipped ? `Đã hiện nghĩa của ${word.term}` : `Từ mới: ${word.term}`}
            </span>
          </motion.section>
        )}
      </AnimatePresence>

      <div className="pointer-events-none fixed bottom-3 left-3 hidden opacity-40 xl:block">
        <BrandName />
      </div>
    </div>
  );
}
