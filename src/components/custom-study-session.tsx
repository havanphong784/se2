"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Headphones,
  RotateCcw,
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
import type { VocabularyDeck, VocabularyWord } from "@/lib/demo-data";
import {
  createMultipleChoiceOptions,
  getStudySpeechSpeed,
  highlightTermInExample,
  isTypingAnswerCorrect,
  moveFirstToEnd,
  selectRandomWords,
  type StudyPhase,
} from "@/lib/study";
import { cancelEnglishSpeech, canSpeakEnglish, speakEnglish } from "@/lib/speech";
import { cn } from "@/lib/utils";

type CustomStudySessionProps = {
  deck?: VocabularyDeck;
  wordsLearnedToday: VocabularyWord[];
  countParam?: string;
  typeParam?: string;
};

export function CustomStudySession({
  deck,
  wordsLearnedToday,
  countParam,
  typeParam,
}: CustomStudySessionProps) {
  // deck optional: chế độ cross-deck (ôn tất cả từ học hôm nay) không gắn deck cụ thể.
  const homeHref = deck ? `/vocabulary/${deck.slug}` : "/vocabulary";
  const initialPhase: StudyPhase =
    typeParam === "multiple_choice" || typeParam === "typing" ? typeParam : "flashcard";

  const requestedCount = countParam === "all" ? "all" : parseInt(countParam ?? "10", 10) || 10;

  const [sessionWords] = useState<VocabularyWord[]>(() =>
    selectRandomWords(wordsLearnedToday, requestedCount),
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const [queue, setQueue] = useState<string[]>(() => sessionWords.map((w) => w.id));
  const [completedWordIds, setCompletedWordIds] = useState<Set<string>>(new Set());
  const [answer, setAnswer] = useState("");
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    isCorrect: boolean;
    expectedAnswer: string;
  } | null>(null);
  const [autoSpeakEnabled, setAutoSpeakEnabled] = useState(true);
  const speechSupported = canSpeakEnglish();

  const currentWord =
    initialPhase === "flashcard"
      ? sessionWords[currentIndex]
      : sessionWords.find((w) => w.id === queue[0]);

  const options =
    initialPhase === "multiple_choice" && currentWord
      ? createMultipleChoiceOptions(
          currentWord,
          sessionWords,
          `custom:${currentWord.id}:${currentIndex}`,
        )
      : [];

  useEffect(() => {
    return () => cancelEnglishSpeech();
  }, []);

  useEffect(() => {
    if (autoSpeakEnabled && speechSupported && currentWord && !feedback && initialPhase !== "typing") {
      speakEnglish(currentWord.term, getStudySpeechSpeed(initialPhase));
    }
  }, [autoSpeakEnabled, currentWord, feedback, initialPhase, speechSupported]);

  if (sessionWords.length === 0) {
    return (
      <main className="grid min-h-svh place-items-center bg-[linear-gradient(180deg,#f8fff3_0%,#ffffff_55%)] px-5 py-10">
        <Card className="w-full max-w-xl border-eel-light text-center p-8">
          <CardContent className="space-y-4">
            <h1 className="font-display text-2xl font-extrabold text-eel-dark-blue">
              Chưa có từ mới học hôm nay
            </h1>
            <p className="text-ash font-bold">
              {deck
                ? `Bạn chưa học từ mới nào trong bộ “${deck.title}” hôm nay. Hãy học từ mới trước khi ôn tập!`
                : "Bạn chưa học từ mới nào trong ngày hôm nay. Hãy học từ mới trước khi ôn tập!"}
            </p>
            <Link href={homeHref} className={buttonVariants({ size: "lg" })}>
              <ArrowLeft /> Quay lại bộ từ
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  const isCompleted =
    initialPhase === "flashcard"
      ? currentIndex >= sessionWords.length
      : queue.length === 0;

  if (isCompleted) {
    return (
      <main className="grid min-h-svh place-items-center bg-[linear-gradient(180deg,#f3ffe9,#fff)] px-5 text-center">
        <Card className="max-w-xl border-2 border-b-4 border-eel-light">
          <CardContent className="p-8 md:p-10">
            <span className="mx-auto grid size-20 place-items-center rounded-full bg-[#eaffdc]">
              <Check className="size-11 text-ecto-green" />
            </span>
            <Badge variant="blue" className="mt-4">
              Tự chọn • Không tính điểm
            </Badge>
            <h1 className="mt-4 font-display text-3xl font-extrabold text-eel-dark-blue">
              Hoàn thành ôn tập từ mới học!
            </h1>
            <p className="mt-3 font-bold leading-7 text-ash">
              Bạn đã ôn lại xong {sessionWords.length} từ{" "}
              {deck
                ? `trong bộ “${deck.title}”. Lưu ý: Dữ liệu phiên này không tính vào tiến độ hay XP.`
                : "(tất cả bộ từ). Lưu ý: Dữ liệu phiên này không tính vào tiến độ hay XP."}
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link href={homeHref} className={buttonVariants({ size: "lg" })}>
                Quay lại bộ từ
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  const progress =
    initialPhase === "flashcard"
      ? Math.round((currentIndex / sessionWords.length) * 100)
      : Math.round((completedWordIds.size / sessionWords.length) * 100);

  function handleChooseOption(selectedId: string) {
    if (!currentWord || feedback) return;
    setSelectedOptionId(selectedId);
    const isCorrect = selectedId === currentWord.id;
    setFeedback({
      isCorrect,
      expectedAnswer: currentWord.translation,
    });
    if (autoSpeakEnabled) {
      speakEnglish(currentWord.term, "normal");
    }
  }

  function handleSubmitTyping(e: React.FormEvent) {
    e.preventDefault();
    if (!currentWord || !answer.trim() || feedback) return;
    const isCorrect = isTypingAnswerCorrect(currentWord.term, answer);
    setFeedback({
      isCorrect,
      expectedAnswer: currentWord.term,
    });
    if (autoSpeakEnabled) {
      speakEnglish(currentWord.term, "normal");
    }
  }

  function handleContinue() {
    if (!currentWord || !feedback) return;
    const { isCorrect } = feedback;
    setFeedback(null);
    setAnswer("");
    setSelectedOptionId(null);

    if (isCorrect) {
      setCompletedWordIds((prev) => new Set([...prev, currentWord.id]));
      setQueue((prev) => prev.slice(1));
    } else {
      setQueue((prev) => moveFirstToEnd(prev));
    }
  }

  const phaseTitle =
    initialPhase === "flashcard"
      ? "Flashcard (Tự chọn)"
      : initialPhase === "multiple_choice"
        ? "Trắc nghiệm (Tự chọn)"
        : "Nhập từ (Tự chọn)";

  return (
    <div className="flex min-h-svh flex-col bg-[#fcfdfa]">
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b-2 border-[#eeeeee] bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-18 max-w-4xl items-center gap-4 px-4 sm:h-20 sm:px-6">
          <Link
            href={homeHref}
            className="grid size-10 shrink-0 place-items-center rounded-xl text-ash transition-colors hover:bg-[#f5f5f5] hover:text-charcoal sm:size-11"
          >
            <X className="size-5 sm:size-6" />
          </Link>

          <div className="flex-1">
            <div className="mb-1.5 flex items-center justify-between text-xs font-black">
              <span className="flex items-center gap-1.5 text-eel-dark-blue">
                <RotateCcw className="size-3.5 text-macaw-blue" />
                {phaseTitle}
              </span>
              <span className="font-extrabold text-ash tabular-nums">{progress}%</span>
            </div>
            <Progress value={progress} className="h-3.5 bg-[#ebebeb]" />
          </div>

          <Button
            type="button"
            variant={autoSpeakEnabled ? "outline" : "secondary"}
            size="sm"
            onClick={() => setAutoSpeakEnabled(!autoSpeakEnabled)}
            className="h-10 px-3 sm:px-4"
          >
            {autoSpeakEnabled ? <Volume2 className="size-4 text-ecto-green" /> : <VolumeX className="size-4 text-ash" />}
            <span className="hidden text-xs font-black sm:inline">Tự phát âm</span>
          </Button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-start px-4 pt-6 pb-36 sm:px-6 sm:pt-10">
        {/* FLASHCARD */}
        {initialPhase === "flashcard" && currentWord && (
          <AnimatePresence mode="wait">
            <motion.div
              key={currentWord.id}
              initial={{ opacity: 0, x: 20, scale: 0.98 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -20, scale: 0.98 }}
              transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
              className="mx-auto flex w-full max-w-xl flex-col overflow-hidden rounded-xl border-2 border-b-4 border-eel-light border-b-[#bde897] bg-white"
            >
              <div className="flex items-center justify-between border-b-2 border-[#f0f0f0] bg-[#fafdf8] px-6 py-3.5">
                <div className="flex items-center gap-2">
                  {currentWord.partOfSpeech.length > 0 && (
                    <Badge variant="blue" className="text-xs font-black">
                      {currentWord.partOfSpeech.join(", ")}
                    </Badge>
                  )}
                </div>
                <span className="text-xs font-black text-ash tabular-nums">
                  {currentIndex + 1} / {sessionWords.length} từ
                </span>
              </div>

              <div className="flex flex-1 flex-col p-6 text-center sm:p-8">
                <div className="flex items-center justify-center gap-3">
                  <h1 className="font-display text-4xl font-black text-eel-dark-blue sm:text-5xl">
                    {currentWord.term}
                  </h1>
                  <button
                    type="button"
                    onClick={() => speakEnglish(currentWord.term, "slow")}
                    aria-label={`Nghe phát âm ${currentWord.term}`}
                    title="Nghe phát âm chậm"
                    className="grid size-11 shrink-0 place-items-center rounded-xl border-2 border-macaw-blue border-b-4 border-b-[#168bc2] bg-[#f4fbff] text-macaw-blue transition-transform hover:scale-105 active:translate-y-0.5"
                  >
                    <Volume2 className="size-5" />
                  </button>
                </div>

                {currentWord.phonetic && (
                  <p className="mt-1 font-mono text-base font-black text-macaw-blue">
                    {currentWord.phonetic}
                  </p>
                )}

                <div className="mt-6 rounded-xl border-2 border-b-4 border-lingot-lime border-b-[#8ed459] bg-[#f7fff1] p-5">
                  <p className="text-[11px] font-black uppercase tracking-wider text-[#438f0e]">
                    Nghĩa tiếng Việt
                  </p>
                  <p className="mt-1 font-display text-2xl font-black text-eel-dark-blue sm:text-3xl">
                    {currentWord.translation}
                  </p>
                </div>

                {currentWord.exampleSentence && (
                  <div className="mt-4 rounded-xl border-2 border-b-4 border-[#eeeeee] border-b-[#dedede] bg-[#fafafa] p-4 text-left sm:p-5">
                    <p className="text-[10px] font-black uppercase tracking-wider text-ash">
                      Câu ví dụ
                    </p>
                    <p className="mt-1 text-sm font-extrabold leading-relaxed text-charcoal sm:text-base">
                      {highlightTermInExample(
                        currentWord.exampleSentence,
                        currentWord.term,
                      ).map((part, idx) =>
                        part.highlighted ? (
                          <strong key={idx} className="font-black text-ecto-green underline decoration-2 underline-offset-2">
                            {part.text}
                          </strong>
                        ) : (
                          <span key={idx}>{part.text}</span>
                        ),
                      )}
                    </p>
                    {currentWord.exampleTranslation && (
                      <p className="mt-1 text-xs font-bold text-ash sm:text-sm">
                        {currentWord.exampleTranslation}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 border-t-2 border-[#f0f0f0] bg-[#fafafa] p-4 sm:p-5">
                <Button
                  variant="secondary"
                  size="lg"
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex((i) => i - 1)}
                >
                  <ArrowLeft className="size-4" /> Lùi
                </Button>
                <Button
                  size="lg"
                  onClick={() => setCurrentIndex((i) => i + 1)}
                >
                  <span>{currentIndex === sessionWords.length - 1 ? "Hoàn thành" : "Tiếp theo"}</span>
                  <ArrowRight className="size-4" />
                </Button>
              </div>
            </motion.div>
          </AnimatePresence>
        )}

        {/* MULTIPLE CHOICE */}
        {initialPhase === "multiple_choice" && currentWord && (
          <AnimatePresence mode="wait">
            <motion.div
              key={currentWord.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
              className="mx-auto w-full max-w-2xl"
            >
              <div className="mb-8 text-center">
                <Badge variant="blue" className="gap-1.5 px-3 py-1 text-xs font-black">
                  <Headphones className="size-3.5" /> Chọn nghĩa đúng cho từ
                </Badge>
                <h1 id="quiz-prompt" className="mt-4 font-display text-4xl font-black text-eel-dark-blue sm:text-5xl">
                  {currentWord.term}
                </h1>
                <button
                  type="button"
                  onClick={() => speakEnglish(currentWord.term, "normal")}
                  className="mt-2 inline-flex items-center gap-2 font-mono text-sm font-black text-macaw-blue transition-colors hover:text-[#087db4]"
                >
                  <Volume2 className="size-4" /> {currentWord.phonetic}
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {options.map((option, index) => {
                  const selected = selectedOptionId === option.id;
                  const expected = currentWord.id === option.id;
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
                      stateClass = "border-[#e5e5e5] border-b-[#dedede] bg-white text-ash/60 opacity-60";
                      badgeClass = "border-[#e5e5e5] bg-[#fafafa] text-ash/60";
                    }
                  }

                  return (
                    <motion.button
                      key={option.id}
                      type="button"
                      disabled={Boolean(feedback)}
                      onClick={() => handleChooseOption(option.id)}
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
                        "flex min-h-20 items-center justify-between gap-3.5 rounded-xl border-2 border-b-4 p-4 text-left text-base font-black transition-all sm:min-h-22 sm:p-5",
                        stateClass,
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg border-2 text-xs font-black", badgeClass)}>
                          {letter}
                        </span>
                        <span className="truncate text-base sm:text-lg">{option.translation}</span>
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

        {/* TYPING */}
        {initialPhase === "typing" && currentWord && (
          <AnimatePresence mode="wait">
            <motion.div
              key={currentWord.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{
                opacity: 1,
                y: 0,
                x: feedback?.isCorrect === false ? [0, -8, 8, -6, 6, -3, 3, 0] : 0,
                scale: feedback?.isCorrect === true ? [1, 1.02, 1] : 1,
              }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.3 }}
              className={cn(
                "mx-auto w-full max-w-xl rounded-xl border-2 border-b-4 bg-white p-6 sm:p-8",
                feedback?.isCorrect === true
                  ? "border-ecto-green border-b-[#46a302]"
                  : feedback?.isCorrect === false
                    ? "border-[#ff6b6b] border-b-[#d94e4e]"
                    : "border-eel-light border-b-[#bde897]",
              )}
            >
              <div className="text-center">
                <Badge variant="blue" className="text-xs font-black">
                  Gõ từ tiếng Anh
                </Badge>
                <p className="mt-4 text-xs font-black uppercase tracking-wider text-ash">
                  Nghĩa tiếng Việt
                </p>
                <h1 className="mt-1 font-display text-3xl font-black text-eel-dark-blue sm:text-4xl">
                  {currentWord.translation}
                </h1>

                <form onSubmit={handleSubmitTyping} className="mt-7">
                  <label className="block text-left">
                    <span className="mb-2 block text-xs font-black uppercase tracking-wider text-ash">
                      Nhập câu trả lời của bạn:
                    </span>
                    <Input
                      autoFocus
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      placeholder="Nhập từ tiếng Anh…"
                      className={cn(
                        "h-16 text-center font-display text-2xl font-black text-eel-dark-blue transition-colors",
                        feedback?.isCorrect === true && "border-ecto-green bg-[#f7fff1] text-[#438f0e]",
                        feedback?.isCorrect === false && "border-[#ff6b6b] bg-[#fff7f7] text-[#b93636]",
                      )}
                      disabled={Boolean(feedback)}
                    />
                  </label>

                  {!feedback && (
                    <Button
                      type="submit"
                      size="lg"
                      className="mt-5 w-full"
                      disabled={!answer.trim()}
                    >
                      <span>Kiểm tra đáp án</span> <ArrowRight />
                    </Button>
                  )}
                </form>
              </div>
            </motion.div>
          </AnimatePresence>
        )}

        {/* BOTTOM SHORTCUT GUIDANCE BAR */}
        <footer className="mt-8 flex flex-wrap items-center justify-center gap-3 text-xs font-bold text-ash">
          {initialPhase === "flashcard" && (
            <span className="inline-flex items-center gap-1">
              Bấm <strong className="font-extrabold text-charcoal">Tiếp theo</strong> để chuyển thẻ
            </span>
          )}
          {initialPhase === "multiple_choice" && !feedback && (
            <span className="inline-flex items-center gap-1">
              Chọn đáp án phù hợp từ các lựa chọn trên
            </span>
          )}
          {initialPhase === "typing" && !feedback && (
            <span className="inline-flex items-center gap-1">
              Nhấn <strong className="font-extrabold text-charcoal">Enter</strong> để kiểm tra
            </span>
          )}
          {feedback && (
            <span className="inline-flex items-center gap-1">
              Nhấn <strong className="font-extrabold text-charcoal">Tiếp tục</strong> để sang câu tiếp theo
            </span>
          )}
        </footer>
      </main>

      {/* DOCKED BOTTOM FEEDBACK BAR (Fixed to prevent content jumping) */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 450, damping: 32 }}
            className={cn(
              "fixed inset-x-0 bottom-0 z-40 border-t-2 p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] outline-none sm:p-5",
              feedback.isCorrect
                ? "border-ecto-green bg-[#f2ffe9]"
                : "border-[#ff6b6b] bg-[#fff3f3]",
            )}
          >
            <div className="mx-auto flex max-w-2xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                {feedback.isCorrect ? (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 450, damping: 20 }}>
                    <CheckCircle2 className="mt-0.5 size-7 shrink-0 text-ecto-green" />
                  </motion.div>
                ) : (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 450, damping: 20 }}>
                    <XCircle className="mt-0.5 size-7 shrink-0 text-[#d94e4e]" />
                  </motion.div>
                )}
                <div>
                  <h2 className={cn("text-lg font-black sm:text-xl", feedback.isCorrect ? "text-[#438f0e]" : "text-[#b93636]")}>
                    {feedback.isCorrect ? "Chính xác! Tuyệt vời" : "Chưa chính xác"}
                  </h2>
                  {!feedback.isCorrect && (
                    <p className="mt-1 text-sm font-bold text-charcoal">
                      Đáp án đúng: <strong className="font-black text-eel-dark-blue text-base">{feedback.expectedAnswer}</strong>
                    </p>
                  )}
                </div>
              </div>

              <Button
                type="button"
                size="lg"
                variant={feedback.isCorrect ? "default" : "danger"}
                onClick={handleContinue}
                className="w-full sm:w-auto sm:min-w-[140px]"
              >
                <span>Tiếp tục</span> <ArrowRight className="size-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
