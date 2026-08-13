"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Headphones,
  RotateCcw,
  Sparkles,
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
  getStudyShortcutAction,
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
  deck: VocabularyDeck;
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
              Bạn chưa học từ mới nào trong bộ “{deck.title}” hôm nay. Hãy học từ mới trước khi ôn tập!
            </p>
            <Link href={`/vocabulary/${deck.slug}`} className={buttonVariants({ size: "lg" })}>
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
        <Card className="max-w-xl border-eel-light shadow-lg">
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
              Bạn đã ôn lại xong {sessionWords.length} từ trong bộ “{deck.title}”. Lưu ý: Dữ liệu phiên này không tính vào tiến độ hay XP.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link href={`/vocabulary/${deck.slug}`} className={buttonVariants({ size: "lg" })}>
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
    <div className="min-h-svh bg-[linear-gradient(180deg,#fbfff8_0%,#fff_40%)]">
      <header className="border-b-2 border-[#eeeeee] bg-white/90 backdrop-blur">
        <div className="mx-auto flex min-h-20 max-w-[980px] items-center gap-3 px-4">
          <Link
            href={`/vocabulary/${deck.slug}`}
            className="grid size-11 place-items-center rounded-xl text-ash hover:bg-[#f5f5f5]"
          >
            <X />
          </Link>
          <div className="flex-1">
            <div className="mb-1.5 flex justify-between text-xs font-extrabold text-ash">
              <span className="flex items-center gap-1.5">
                <RotateCcw className="size-3.5 text-macaw-blue" /> {phaseTitle}
              </span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-3" />
          </div>
          <Button
            type="button"
            variant={autoSpeakEnabled ? "outline" : "secondary"}
            size="sm"
            onClick={() => setAutoSpeakEnabled(!autoSpeakEnabled)}
            className="px-3"
          >
            {autoSpeakEnabled ? <Volume2 /> : <VolumeX />}
          </Button>
        </div>
      </header>

      <main className="mx-auto flex min-h-[calc(100svh-80px)] max-w-[860px] flex-col justify-center px-5 py-8">
        {/* FLASHCARD */}
        {initialPhase === "flashcard" && currentWord && (
          <Card className="mx-auto flex w-full max-w-[600px] flex-col overflow-hidden border-eel-light border-b-4 shadow-lg sm:min-h-[450px]">
            <CardHeader className="min-h-12 justify-center border-b-2 border-[#f0f0f0] bg-[#fbfff8] px-5 py-2.5">
              <div className="flex w-full items-center justify-between gap-3">
                <Badge variant="blue">{currentWord.partOfSpeech}</Badge>
                <span className="text-xs font-extrabold text-ash tabular-nums">
                  {currentIndex + 1} / {sessionWords.length}
                </span>
              </div>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col p-5 text-center sm:p-6">
              <div className="flex flex-wrap items-center justify-center gap-3">
                <h1 className="font-display text-4xl font-extrabold text-eel-dark-blue sm:text-5xl">
                  {currentWord.term}
                </h1>
                <Button
                  type="button"
                  variant="blue"
                  size="icon"
                  className="size-10"
                  onClick={() => speakEnglish(currentWord.term, "slow")}
                >
                  <Volume2 />
                </Button>
              </div>
              <p className="mt-1.5 text-base font-extrabold text-macaw-blue">
                {currentWord.phonetic}
              </p>
              <div className="mt-4 rounded-xl border-2 border-lingot-lime/70 bg-[#f7fff1] px-4 py-4">
                <p className="text-xs font-extrabold uppercase tracking-wider text-[#438f0e]">
                  Nghĩa tiếng Việt
                </p>
                <p className="mt-1 text-2xl font-extrabold text-[#438f0e]">
                  {currentWord.translation}
                </p>
              </div>
              <div className="mt-3 rounded-xl border-2 border-[#eeeeee] bg-[#fcfcfc] p-4 text-left">
                <p className="mb-1 text-xs font-extrabold uppercase tracking-wider text-ash">
                  Ví dụ
                </p>
                <p className="font-bold leading-6 text-charcoal">
                  {highlightTermInExample(
                    currentWord.exampleSentence,
                    currentWord.term,
                  ).map((part, idx) =>
                    part.highlighted ? (
                      <strong key={idx} className="font-extrabold text-eel-dark-blue">
                        {part.text}
                      </strong>
                    ) : (
                      <span key={idx}>{part.text}</span>
                    ),
                  )}
                </p>
                <p className="mt-1 text-sm font-bold text-ash">
                  {currentWord.exampleTranslation}
                </p>
              </div>
            </CardContent>
            <CardFooter className="mt-auto grid min-h-[68px] grid-cols-2 gap-3 border-t-2 border-[#f0f0f0] bg-[#fcfcfc] p-3 sm:p-4">
              <Button
                variant="secondary"
                size="lg"
                disabled={currentIndex === 0}
                onClick={() => setCurrentIndex((i) => i - 1)}
              >
                <ArrowLeft /> Lùi
              </Button>
              <Button
                size="lg"
                onClick={() => setCurrentIndex((i) => i + 1)}
              >
                {currentIndex === sessionWords.length - 1 ? "Hoàn thành" : "Tiếp"} <ArrowRight />
              </Button>
            </CardFooter>
          </Card>
        )}

        {/* MULTIPLE CHOICE */}
        {initialPhase === "multiple_choice" && currentWord && (
          <section aria-labelledby="quiz-prompt">
            <div className="mb-7 rounded-xl text-center">
              <Badge variant="blue">
                <Headphones className="size-4" /> Chọn nghĩa đúng
              </Badge>
              <h1 id="quiz-prompt" className="mt-4 font-display text-5xl font-extrabold text-eel-dark-blue">
                {currentWord.term}
              </h1>
              <button
                type="button"
                onClick={() => speakEnglish(currentWord.term, "normal")}
                className="mt-3 inline-flex items-center gap-2 font-extrabold text-macaw-blue hover:underline"
              >
                <Volume2 className="size-5" /> {currentWord.phonetic}
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {options.map((option, index) => {
                const selected = selectedOptionId === option.id;
                const expected = currentWord.id === option.id;
                const stateClass = feedback
                  ? expected
                    ? "border-ecto-green bg-[#f2ffe9] text-[#438f0e]"
                    : selected
                      ? "border-[#ff6b6b] bg-[#fff3f3] text-[#b93636]"
                      : "border-[#dedede] bg-white text-ash opacity-65"
                  : "border-[#dedede] bg-white text-charcoal hover:border-macaw-blue hover:bg-[#f5fbff]";
                const letter = String.fromCharCode(65 + index);

                return (
                  <button
                    key={option.id}
                    type="button"
                    disabled={Boolean(feedback)}
                    onClick={() => handleChooseOption(option.id)}
                    className={cn(
                      "flex min-h-24 items-center gap-4 rounded-xl border-2 border-b-4 px-5 text-left text-lg font-extrabold transition",
                      stateClass,
                    )}
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg border-2 border-current text-sm">
                      {letter}
                    </span>
                    <span className="flex-1">{option.translation}</span>
                    {feedback && expected && <CheckCircle2 className="text-ecto-green" />}
                    {feedback && selected && !expected && <XCircle className="text-[#d94e4e]" />}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* TYPING */}
        {initialPhase === "typing" && currentWord && (
          <Card className={cn("mx-auto w-full max-w-2xl border-b-4 shadow-lg", feedback?.isCorrect === true && "border-ecto-green", feedback?.isCorrect === false && "border-[#ff6b6b]")}>
            <CardContent className="p-6 text-center md:p-10">
              <Badge variant="blue">Nhập từ tiếng Anh</Badge>
              <p className="mt-6 text-sm font-extrabold uppercase tracking-wider text-ash">
                Nghĩa tiếng Việt
              </p>
              <h1 className="mt-3 font-display text-4xl font-extrabold text-[#438f0e] sm:text-5xl">
                {currentWord.translation}
              </h1>
              <form onSubmit={handleSubmitTyping} className="mt-8">
                <Input
                  autoFocus
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Nhập từ tiếng Anh…"
                  className={cn(
                    "h-16 text-center text-xl font-extrabold",
                    feedback?.isCorrect === true && "border-ecto-green bg-[#f7fff1]",
                    feedback?.isCorrect === false && "border-[#ff6b6b] bg-[#fff7f7]",
                  )}
                  disabled={Boolean(feedback)}
                />
                {!feedback && (
                  <Button type="submit" size="lg" className="mt-5 w-full" disabled={!answer.trim()}>
                    Kiểm tra <ArrowRight />
                  </Button>
                )}
              </form>
            </CardContent>
          </Card>
        )}

        {/* FEEDBACK BOTTOM BAR */}
        {feedback && (
          <div
            className={cn(
              "mt-6 rounded-xl border-2 border-b-4 p-5 sm:flex sm:items-center sm:justify-between sm:gap-5",
              feedback.isCorrect ? "border-ecto-green bg-[#f2ffe9]" : "border-[#ff6b6b] bg-[#fff3f3]",
            )}
          >
            <div className="flex gap-3">
              {feedback.isCorrect ? (
                <CheckCircle2 className="mt-0.5 size-7 shrink-0 text-ecto-green" />
              ) : (
                <XCircle className="mt-0.5 size-7 shrink-0 text-[#d94e4e]" />
              )}
              <div>
                <h2 className={cn("text-xl font-extrabold", feedback.isCorrect ? "text-[#438f0e]" : "text-[#b93636]")}>
                  {feedback.isCorrect ? "Chính xác!" : "Chưa đúng"}
                </h2>
                {!feedback.isCorrect && (
                  <p className="mt-1 font-bold text-charcoal">
                    Đáp án đúng: <strong>{feedback.expectedAnswer}</strong>
                  </p>
                )}
              </div>
            </div>
            <Button size="lg" onClick={handleContinue} className="mt-4 sm:mt-0">
              Tiếp tục <ArrowRight />
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
