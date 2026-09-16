"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  Check,
  CheckCircle2,
  FolderPlus,
  Headphones,
  Loader2,
  Plus,
  Sparkles,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/components/auth-provider";
import { useDecks, useInvalidateAuthData } from "@/lib/hooks/use-queries";
import { playAudioUrl } from "@/lib/speech";
import { cn } from "@/lib/utils";

export interface AddWordDialogProps {
  isOpen: boolean;
  onClose: () => void;
  defaultDeckId?: string;
  defaultDeckTitle?: string;
  initialWord?: {
    term?: string;
    translation?: string;
    phonetic?: string;
    audioUrl?: string | null;
    partOfSpeech?: string[];
    exampleSentence?: string;
    exampleTranslation?: string;
  };
  onSuccess?: (deck: { id: string; slug: string; title: string }) => void;
}

const COMMON_POS = [
  { key: "noun", vi: "danh từ" },
  { key: "verb", vi: "động từ" },
  { key: "adjective", vi: "tính từ" },
  { key: "adverb", vi: "phó từ" },
  { key: "preposition", vi: "giới từ" },
  { key: "interjection", vi: "thán từ" },
];

const DECK_LEVELS = ["Tự chọn", "A1", "A2", "B1", "B2", "C1", "C2"];

function AddWordDialogContent({
  onClose,
  defaultDeckId,
  defaultDeckTitle,
  initialWord,
  onSuccess,
}: Omit<AddWordDialogProps, "isOpen">) {
  const { authFetch } = useAuth();
  const invalidateAuthData = useInvalidateAuthData();
  const { data: remoteDecks } = useDecks();

  const titleId = useId();
  const modalRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lookupAbortRef = useRef<AbortController | null>(null);

  // Danh sách gói từ của người dùng
  const decks = useMemo(() => {
    if (!remoteDecks) return [];
    return remoteDecks
      .filter((d) => d.ownership === "personal")
      .map((d) => ({ id: d.id, title: d.title, slug: d.slug }));
  }, [remoteDecks]);

  // Form states khởi tạo từ props
  const [term, setTerm] = useState(initialWord?.term || "");
  const [translation, setTranslation] = useState(initialWord?.translation || "");
  const [phonetic, setPhonetic] = useState(initialWord?.phonetic || "");
  const [audioUrl, setAudioUrl] = useState(initialWord?.audioUrl || "");
  const [partsOfSpeech, setPartsOfSpeech] = useState<string[]>(
    initialWord?.partOfSpeech || [],
  );
  const [customPosInput, setCustomPosInput] = useState(
    initialWord?.partOfSpeech?.join(", ") || "",
  );
  const [exampleSentence, setExampleSentence] = useState(
    initialWord?.exampleSentence || "",
  );
  const [exampleTranslation, setExampleTranslation] = useState(
    initialWord?.exampleTranslation || "",
  );

  // Gói từ đích
  const [destinationType, setDestinationType] = useState<"existing" | "new">(
    defaultDeckId || decks.length > 0 ? "existing" : "new",
  );
  const [selectedDeckId, setSelectedDeckId] = useState<string>(
    defaultDeckId || decks[0]?.id || "",
  );
  const [newTitle, setNewTitle] = useState(defaultDeckTitle || "");
  const [newDescription, setNewDescription] = useState("");
  const [newLevel, setNewLevel] = useState("Tự chọn");

  // Lookup API status
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupStatus, setLookupStatus] = useState<
    "idle" | "found" | "not_found" | "error"
  >("idle");
  const [availableDefinitions, setAvailableDefinitions] = useState<
    Array<{ partOfSpeechVi: string; definition: string; example?: string }>
  >([]);

  // Audio playback status
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  // Submission status
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Đóng dialog khi nhấn ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      lookupAbortRef.current?.abort();
    };
  }, [isSubmitting, onClose]);

  // Tra cứu tự động Free Dictionary API
  const performDictionaryLookup = useCallback(
    async (wordToLookup: string) => {
      const clean = wordToLookup.trim();
      if (!clean || clean.length < 2) return;

      lookupAbortRef.current?.abort();
      const controller = new AbortController();
      lookupAbortRef.current = controller;

      setIsLookingUp(true);
      setLookupStatus("idle");

      try {
        const res = await authFetch(
          `/api/dictionary/lookup?word=${encodeURIComponent(clean)}`,
          { signal: controller.signal },
        );

        if (!res.ok) {
          throw new Error("Lỗi kết nối từ điển");
        }

        const data = await res.json();
        if (controller.signal.aborted) return;

        if (data.foundInDictionary) {
          setLookupStatus("found");
          if (data.phonetic) {
            setPhonetic((prev) => prev || data.phonetic);
          }
          if (data.audioUrl) {
            setAudioUrl((prev) => prev || data.audioUrl);
          }
          if (data.partsOfSpeechVi && data.partsOfSpeechVi.length > 0) {
            setPartsOfSpeech((prev) => (prev.length ? prev : data.partsOfSpeechVi));
            setCustomPosInput((prev) => (prev ? prev : data.partsOfSpeechVi.join(", ")));
          }
          if (data.translation) {
            setTranslation((prev) => prev || data.translation);
          }
          if (data.exampleSentence) {
            setExampleSentence((prev) => prev || data.exampleSentence);
          }
          if (data.exampleTranslation) {
            setExampleTranslation((prev) => prev || data.exampleTranslation);
          }
          if (Array.isArray(data.allDefinitions) && data.allDefinitions.length > 0) {
            setAvailableDefinitions(data.allDefinitions);
          }
        } else {
          setLookupStatus("not_found");
          if (data.translation) {
            setTranslation((prev) => prev || data.translation);
          }
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setLookupStatus("error");
      } finally {
        if (!controller.signal.aborted) {
          setIsLookingUp(false);
        }
      }
    },
    [authFetch],
  );

  // Debounce auto-lookup khi gõ từ vựng
  useEffect(() => {
    const clean = term.trim();
    if (!clean || clean.length < 2) return;
    if (initialWord?.term === clean && initialWord?.phonetic) return;

    const timer = setTimeout(() => {
      performDictionaryLookup(clean);
    }, 600);

    return () => clearTimeout(timer);
  }, [term, initialWord?.term, initialWord?.phonetic, performDictionaryLookup]);

  function handlePlayAudio() {
    if (!audioUrl) return;
    setIsPlayingAudio(true);
    playAudioUrl(audioUrl, () => {
      setIsPlayingAudio(false);
    });
  }

  function handleTogglePos(posVi: string) {
    let next: string[];
    if (partsOfSpeech.includes(posVi)) {
      next = partsOfSpeech.filter((p) => p !== posVi);
    } else {
      next = [...partsOfSpeech, posVi];
    }
    setPartsOfSpeech(next);
    setCustomPosInput(next.join(", "));
  }

  function handleCustomPosChange(val: string) {
    setCustomPosInput(val);
    const parsed = val
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    setPartsOfSpeech(parsed);
  }

  function handleSelectDefinition(def: { definition: string; example?: string }) {
    if (def.example && !exampleSentence) {
      setExampleSentence(def.example);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!term.trim() || !translation.trim()) {
      setFeedbackMessage({
        type: "error",
        text: "Vui lòng nhập từ tiếng Anh và nghĩa tiếng Việt.",
      });
      return;
    }

    setIsSubmitting(true);
    setFeedbackMessage(null);

    const posFinal = customPosInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const payload = {
      destination:
        destinationType === "existing"
          ? { type: "existing", deckId: selectedDeckId }
          : { type: "new", title: newTitle, description: newDescription, level: newLevel },
      word: {
        term: term.trim(),
        translation: translation.trim(),
        phonetic: phonetic.trim(),
        audioUrl: audioUrl.trim(),
        partOfSpeech: posFinal,
        exampleSentence: exampleSentence.trim(),
        exampleTranslation: exampleTranslation.trim(),
      },
    };

    try {
      const response = await authFetch("/api/translate/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.message || "Không thể thêm từ vào gói.");
      }

      setFeedbackMessage({
        type: "success",
        text: data.message || `Đã thêm từ "${term}" thành công!`,
      });

      invalidateAuthData();
      if (data.deck) {
        onSuccess?.(data.deck);
      }

      closeTimerRef.current = setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err) {
      setFeedbackMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Đã xảy ra lỗi khi thêm từ.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-xs animate-in fade-in duration-150"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <Card
        ref={modalRef}
        className="max-h-[92vh] w-full max-w-xl overflow-y-auto border-2 border-b-4 border-eel-light border-b-lingot-lime bg-white shadow-xl"
      >
        <CardHeader className="relative border-b-2 border-[#f0f0f0] bg-[#fbfff8] p-5 pr-14">
          <CardTitle
            id={titleId}
            className="flex items-center gap-2.5 font-display text-xl font-extrabold text-eel-dark-blue"
          >
            <span className="grid size-9 place-items-center rounded-xl border-2 border-b-4 border-macaw-blue border-b-[#168bc2] bg-macaw-blue text-white">
              <FolderPlus className="size-4" />
            </span>
            Thêm từ vựng vào gói
          </CardTitle>
          <p className="mt-1 text-xs font-bold text-ash">
            Tự động lấy phiên âm, phát âm audio, từ loại và ví dụ từ Free Dictionary API.
          </p>

          <button
            type="button"
            aria-label="Đóng hộp thoại"
            disabled={isSubmitting}
            onClick={onClose}
            className="absolute right-4 top-4 grid size-9 place-items-center rounded-xl border-2 border-b-4 border-[#e5e5e5] border-b-[#dedede] bg-white text-ash transition-all hover:border-macaw-blue hover:text-eel-dark-blue active:translate-y-0.5"
          >
            <X className="size-4" />
          </button>
        </CardHeader>

        <CardContent className="p-5 space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Field 1: English Word (Term) with Auto-lookup button */}
            <div>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <label className="text-xs font-black uppercase tracking-wider text-eel-dark-blue">
                  Từ tiếng Anh <span className="text-[#ff4b4b]">*</span>
                </label>
                <div className="flex items-center gap-1.5">
                  {isLookingUp && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-macaw-blue animate-pulse">
                      <Loader2 className="size-3 animate-spin" /> Đang tra Free Dictionary…
                    </span>
                  )}
                  {lookupStatus === "found" && !isLookingUp && (
                    <Badge variant="default" className="gap-1 text-[10px] font-black border-ecto-green bg-ecto-green text-white py-0.5">
                      <Check className="size-3" /> Đã lấy từ Free Dictionary
                    </Badge>
                  )}
                  {lookupStatus === "not_found" && !isLookingUp && (
                    <Badge variant="neutral" className="text-[10px] font-bold py-0.5">
                      Chưa có trong từ điển
                    </Badge>
                  )}
                </div>
              </div>

              <div className="relative flex gap-2">
                <Input
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  placeholder="Nhập từ vựng tiếng Anh (vd: serendipity, learn…)"
                  required
                  autoFocus
                  className="h-11 rounded-xl border-2 border-[#e5e5e5] font-extrabold text-eel-dark-blue focus:border-ecto-green text-base"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={isLookingUp || !term.trim()}
                  onClick={() => performDictionaryLookup(term)}
                  title="Tra cứu từ điển ngay"
                  className="shrink-0 h-11 px-3 border-2 border-b-4 border-[#e5e5e5] border-b-[#dedede] font-black text-xs text-charcoal hover:border-macaw-blue hover:text-macaw-blue active:translate-y-0.5"
                >
                  <Sparkles className="size-3.5 mr-1 text-macaw-blue" />
                  Tra cứu
                </Button>
              </div>
            </div>

            {/* Field 2: Vietnamese Translation */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-eel-dark-blue mb-1.5">
                Nghĩa tiếng Việt <span className="text-[#ff4b4b]">*</span>
              </label>
              <Input
                value={translation}
                onChange={(e) => setTranslation(e.target.value)}
                placeholder="Nghĩa của từ tiếng Việt…"
                required
                className="h-11 rounded-xl border-2 border-[#e5e5e5] font-bold text-eel-dark-blue focus:border-ecto-green"
              />
            </div>

            {/* Quick definitions chips from Free Dictionary API if available */}
            {availableDefinitions.length > 0 && (
              <div className="rounded-xl border-2 border-[#e5e5e5] bg-[#fafafa] p-3 space-y-1.5">
                <p className="text-[11px] font-black uppercase tracking-wider text-ash flex items-center gap-1">
                  <Sparkles className="size-3 text-macaw-blue" /> Định nghĩa từ Free Dictionary:
                </p>
                <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                  {availableDefinitions.slice(0, 3).map((d, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleSelectDefinition(d)}
                      className="w-full text-left rounded-lg bg-white border border-[#e5e5e5] p-2 text-xs text-charcoal hover:border-ecto-green hover:bg-[#f7fff1] transition flex flex-col gap-0.5"
                    >
                      <span className="font-extrabold text-[#438f0e] text-[10px] uppercase">
                        [{d.partOfSpeechVi}]
                      </span>
                      <span className="font-medium line-clamp-1">{d.definition}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Field 3 & 4: Phonetic & Audio */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-ash mb-1.5">
                  Phiên âm IPA
                </label>
                <Input
                  value={phonetic}
                  onChange={(e) => setPhonetic(e.target.value)}
                  placeholder="/.../"
                  className="h-10 rounded-xl border-2 border-[#e5e5e5] font-mono text-sm font-bold text-eel-dark-blue"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-black uppercase tracking-wider text-ash">
                    Audio phát âm
                  </label>
                  {audioUrl && (
                    <button
                      type="button"
                      onClick={handlePlayAudio}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-black transition-all",
                        isPlayingAudio
                          ? "border-macaw-blue bg-[#f0f9ff] text-macaw-blue animate-pulse"
                          : "border-lingot-lime bg-[#f7fff1] text-[#438f0e] hover:bg-lingot-lime/20 active:translate-y-0.5",
                      )}
                    >
                      {isPlayingAudio ? (
                        <>
                          <Headphones className="size-3" /> Đang phát…
                        </>
                      ) : (
                        <>
                          <Volume2 className="size-3" /> Nghe thử
                        </>
                      )}
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Input
                    value={audioUrl}
                    onChange={(e) => setAudioUrl(e.target.value)}
                    placeholder="https://...mp3"
                    className="h-10 rounded-xl border-2 border-[#e5e5e5] font-mono text-xs font-medium text-eel-dark-blue pr-8"
                  />
                  {audioUrl && (
                    <button
                      type="button"
                      onClick={() => setAudioUrl("")}
                      title="Xóa audio URL"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ash hover:text-[#ff4b4b]"
                    >
                      <VolumeX className="size-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Field 5: Parts of speech with quick toggles */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-black uppercase tracking-wider text-ash">
                  Từ loại
                </label>
                <span className="text-[11px] font-bold text-ash">Chọn nhanh hoặc tự nhập</span>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {COMMON_POS.map((p) => {
                  const isSelected = partsOfSpeech.includes(p.vi);
                  return (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => handleTogglePos(p.vi)}
                      className={cn(
                        "rounded-lg border-2 px-2.5 py-1 text-xs font-extrabold transition-all active:translate-y-0.5",
                        isSelected
                          ? "border-ecto-green border-b-2 bg-[#f2ffe9] text-[#438f0e]"
                          : "border-[#e5e5e5] bg-white text-ash hover:border-[#bdbdbd]",
                      )}
                    >
                      {p.vi}
                    </button>
                  );
                })}
              </div>
              <Input
                value={customPosInput}
                onChange={(e) => handleCustomPosChange(e.target.value)}
                placeholder="danh từ, động từ, tính từ…"
                className="h-9 rounded-xl border-2 border-[#e5e5e5] text-xs font-bold text-eel-dark-blue"
              />
            </div>

            {/* Field 6 & 7: Example sentence & translation */}
            <div className="space-y-2 rounded-xl border-2 border-[#e5e5e5] bg-[#fafafa] p-3.5">
              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-ash mb-1">
                  Câu ví dụ tiếng Anh
                </label>
                <Input
                  value={exampleSentence}
                  onChange={(e) => setExampleSentence(e.target.value)}
                  placeholder="VD: They run every morning in the park."
                  className="h-9 rounded-xl border-2 border-[#e5e5e5] bg-white text-xs font-bold text-eel-dark-blue"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-ash mb-1">
                  Dịch câu ví dụ tiếng Việt
                </label>
                <Input
                  value={exampleTranslation}
                  onChange={(e) => setExampleTranslation(e.target.value)}
                  placeholder="VD: Họ chạy bộ mỗi sáng trong công viên."
                  className="h-9 rounded-xl border-2 border-[#e5e5e5] bg-white text-xs font-bold text-eel-dark-blue"
                />
              </div>
            </div>

            {/* Destination Pack Selector */}
            <div className="space-y-2 pt-2 border-t-2 border-[#f0f0f0]">
              <label className="block text-xs font-black uppercase tracking-wider text-eel-dark-blue">
                Lưu vào gói từ nào?
              </label>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={decks.length === 0}
                  onClick={() => setDestinationType("existing")}
                  className={cn(
                    "flex items-center justify-center rounded-xl border-2 border-b-4 p-2.5 text-xs font-black transition-all active:translate-y-0.5",
                    destinationType === "existing"
                      ? "border-ecto-green border-b-[#46a302] bg-[#f2ffe9] text-[#438f0e]"
                      : "border-[#e5e5e5] border-b-[#dedede] bg-white text-ash hover:border-ash",
                  )}
                >
                  Gói cá nhân hiện có ({decks.length})
                </button>
                <button
                  type="button"
                  onClick={() => setDestinationType("new")}
                  className={cn(
                    "flex items-center justify-center rounded-xl border-2 border-b-4 p-2.5 text-xs font-black transition-all active:translate-y-0.5",
                    destinationType === "new"
                      ? "border-ecto-green border-b-[#46a302] bg-[#f2ffe9] text-[#438f0e]"
                      : "border-[#e5e5e5] border-b-[#dedede] bg-white text-ash hover:border-ash",
                  )}
                >
                  <Plus className="size-3.5 mr-1" /> Tạo gói mới
                </button>
              </div>

              {destinationType === "existing" ? (
                <div>
                  <select
                    value={selectedDeckId}
                    onChange={(e) => setSelectedDeckId(e.target.value)}
                    className="w-full rounded-xl border-2 border-b-4 border-[#e5e5e5] border-b-[#dedede] p-2.5 text-sm font-extrabold text-eel-dark-blue bg-white focus:border-ecto-green focus:outline-none"
                  >
                    {decks.map((deck) => (
                      <option key={deck.id} value={deck.id}>
                        {deck.title}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="space-y-2 rounded-xl border-2 border-[#e5e5e5] bg-[#fafafa] p-3">
                  <div>
                    <label className="block text-xs font-extrabold uppercase text-ash mb-1">
                      Tên gói mới *
                    </label>
                    <Input
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="VD: Từ vựng IELTS nâng cao"
                      required
                      className="h-9 rounded-xl border-2 border-[#e5e5e5] bg-white text-xs font-bold text-eel-dark-blue"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-extrabold uppercase text-ash mb-1">
                      Mô tả ngắn
                    </label>
                    <Input
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                      placeholder="Mô tả mục tiêu của gói từ này…"
                      className="h-9 rounded-xl border-2 border-[#e5e5e5] bg-white text-xs font-bold text-eel-dark-blue"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-extrabold uppercase text-ash mb-1">
                      Trình độ
                    </label>
                    <select
                      value={newLevel}
                      onChange={(e) => setNewLevel(e.target.value)}
                      className="w-full rounded-xl border-2 border-[#e5e5e5] p-2 text-xs font-bold text-eel-dark-blue bg-white focus:border-ecto-green"
                    >
                      {DECK_LEVELS.map((lvl) => (
                        <option key={lvl} value={lvl}>
                          {lvl}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Feedback alert */}
            {feedbackMessage && (
              <div
                role="alert"
                className={cn(
                  "rounded-xl border-2 border-b-4 p-3.5 text-sm font-black flex items-center gap-2.5 animate-in fade-in",
                  feedbackMessage.type === "success"
                    ? "border-ecto-green border-b-[#46a302] bg-[#f2ffe9] text-[#438f0e]"
                    : "border-[#ff6b6b] border-b-[#d94e4e] bg-[#fff3f3] text-[#b93636]",
                )}
              >
                {feedbackMessage.type === "success" && (
                  <CheckCircle2 className="size-5 shrink-0" />
                )}
                {feedbackMessage.text}
              </div>
            )}

            {/* Form actions */}
            <div className="flex gap-2.5 justify-end pt-3 border-t-2 border-[#f0f0f0]">
              <Button
                type="button"
                variant="secondary"
                disabled={isSubmitting}
                onClick={onClose}
                className="font-black"
              >
                Hủy bỏ
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !term.trim() || !translation.trim()}
                className="min-w-[140px] font-black"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin mr-1.5" /> Đang lưu…
                  </>
                ) : (
                  "Lưu vào gói"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export function AddWordDialog(props: AddWordDialogProps) {
  if (!props.isOpen) return null;
  return <AddWordDialogContent {...props} />;
}
