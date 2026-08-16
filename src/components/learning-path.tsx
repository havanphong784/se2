import Link from "next/link";
import { ArrowRight, Check, LockKeyhole, Sprout } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { deckProgress, type VocabularyDeck } from "@/lib/demo-data";

export function LearningPath({ decks }: { decks: VocabularyDeck[] }) {
  return (
    <ol
      className={`relative mt-6 space-y-4 ${
        decks.length > 1
          ? "before:absolute before:bottom-7 before:left-[27px] before:top-7 before:w-1 before:rounded-xl before:bg-eel-light"
          : ""
      }`}
    >
      {decks.map((deck, index) => {
        const progress = deckProgress(deck);
        const started = progress.percent > 0;
        const prevDeckProgress = index > 0 ? deckProgress(decks[index - 1]) : null;
        const available =
          index === 0 || (prevDeckProgress !== null && prevDeckProgress.percent >= 100);

        return (
          <li key={deck.id} className="relative flex gap-4">
            <span
              className={`relative z-10 grid size-14 shrink-0 place-items-center rounded-xl border-2 text-xl ${
                progress.percent >= 85
                  ? "border-ecto-green bg-ecto-green text-white"
                  : available
                    ? "border-lingot-lime bg-white text-[#438f0e]"
                    : "border-[#dedede] bg-white text-[#aaaaaa]"
              }`}
            >
              {progress.percent >= 85 ? (
                <Check className="size-6" strokeWidth={3} />
              ) : available ? (
                <Sprout className="size-6" strokeWidth={2.5} />
              ) : (
                <LockKeyhole className="size-5" />
              )}
            </span>

            <div className="min-w-0 flex-1 rounded-xl border-2 border-[#e5e5e5] bg-white p-4 md:flex md:items-center md:gap-5">
              <span className="mr-3 text-2xl md:mr-0" aria-hidden="true">
                {deck.emoji}
              </span>
              <div className="mt-2 min-w-0 flex-1 md:mt-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-extrabold text-eel-dark-blue">{deck.title}</h3>
                  <Badge variant="neutral">{deck.level}</Badge>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <Progress value={progress.percent} className="h-2.5 max-w-xs" />
                  <span className="shrink-0 text-xs font-extrabold text-ash tabular-nums">
                    {progress.percent}%
                  </span>
                </div>
              </div>
              {available ? (
                <Link
                  href={`/vocabulary/${deck.slug}`}
                  aria-label={`Mở bộ từ ${deck.title}`}
                  className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl font-extrabold text-macaw-blue underline decoration-2 underline-offset-4 focus-visible:ring-4 focus-visible:ring-macaw-blue/20 md:mt-0"
                >
                  {started ? "Tiếp tục" : "Bắt đầu"} <ArrowRight className="size-4" />
                </Link>
              ) : (
                <span className="mt-3 inline-flex min-h-11 items-center text-sm font-extrabold text-[#aaaaaa] md:mt-0">
                  Hoàn thành bài trước
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
