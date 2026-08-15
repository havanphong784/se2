"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeftRight,
  CheckCircle2,
  Copy,
  FolderPlus,
  Languages,
  Loader2,
  Plus,
  Sparkles,
  Volume2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { speakEnglish } from "@/lib/speech";
import { cn } from "@/lib/utils";

type PersonalDeck = { id: string; title: string; slug: string };

type TranslationResult = {
  original: string;
  translated: string;
  direction: "en-vi" | "vi-en";
  confidence: number | null;
  phonetic?: string;
  partsOfSpeech?: string[];
  exampleSentence?: string;
  exampleTranslation?: string;
};

export function TranslationTool({
  available,
  decks: initialDecks,
}: {
  available: boolean;
  decks: PersonalDeck[];
}) {
  const [direction, setDirection] = useState<"en-vi" | "vi-en">("en-vi");
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Deck modal state
  const [decks, setDecks] = useState<PersonalDeck[]>(initialDecks);
  const [showDeckModal, setShowDeckModal] = useState(false);
  const [destinationType, setDestinationType] = useState<"existing" | "new">(
    decks.length > 0 ? "existing" : "new",
  );
  const [selectedDeckId, setSelectedDeckId] = useState(decks[0]?.id ?? "");
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newLevel, setNewLevel] = useState("Tự chọn");

  // Editable fields for saving
  const [customPhonetic, setCustomPhonetic] = useState("");
  const [customPartsOfSpeech, setCustomPartsOfSpeech] = useState("");
  const [customExampleSentence, setCustomExampleSentence] = useState("");
  const [customExampleTranslation, setCustomExampleTranslation] = useState("");
  const [addingWord, setAddingWord] = useState(false);
  const [addMessage, setAddMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  function handleSwapDirection() {
    setDirection((prev) => (prev === "en-vi" ? "vi-en" : "en-vi"));
    if (result) {
      setInputText(result.translated);
      setResult(null);
    }
  }

  async function handleTranslate() {
    if (!inputText.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: inputText.trim(), direction }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Lỗi dịch từ.");
      }
      setResult(data);

      // Pre-fill modal states with dict details if returned
      setCustomPhonetic(data.phonetic || "");
      setCustomPartsOfSpeech(data.partsOfSpeech ? data.partsOfSpeech.join(", ") : "");
      setCustomExampleSentence(data.exampleSentence || "");
      setCustomExampleTranslation(data.exampleTranslation || "");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Không thể kết nối dịch vụ dịch.");
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    if (!result) return;
    navigator.clipboard.writeText(result.translated);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleSpeak(text: string) {
    if (!text.trim()) return;
    speakEnglish(text.trim(), "normal");
  }

  function handleOpenAddModal() {
    if (!result) return;
    setAddMessage(null);
    setShowDeckModal(true);
  }

  async function handleAddWordToDeck(e: React.FormEvent) {
    e.preventDefault();
    if (!result) return;
    setAddingWord(true);
    setAddMessage(null);

    const term = result.direction === "en-vi" ? result.original : result.translated;
    const translation = result.direction === "en-vi" ? result.translated : result.original;

    const parts = customPartsOfSpeech
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);

    const payload = {
      destination:
        destinationType === "existing"
          ? { type: "existing", deckId: selectedDeckId }
          : { type: "new", title: newTitle, description: newDescription, level: newLevel },
      word: {
        term,
        translation,
        phonetic: customPhonetic,
        partOfSpeech: parts,
        exampleSentence: customExampleSentence,
        exampleTranslation: customExampleTranslation,
      },
    };

    try {
      const response = await fetch("/api/translate/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.message || "Không thể thêm từ vào gói.");
      }

      setAddMessage({ type: "success", text: data.message });

      if (destinationType === "new" && data.deck) {
        setDecks((prev) => [data.deck, ...prev]);
        setSelectedDeckId(data.deck.id);
        setDestinationType("existing");
        setNewTitle("");
        setNewDescription("");
      }
      setTimeout(() => {
        setShowDeckModal(false);
        setAddMessage(null);
      }, 1500);
    } catch (err: unknown) {
      setAddMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Lỗi thêm từ vào gói.",
      });
    } finally {
      setAddingWord(false);
    }
  }

  const englishTextToSpeak =
    result && result.direction === "en-vi"
      ? result.original
      : result && result.direction === "vi-en"
        ? result.translated
        : "";

  return (
    <div className="space-y-8">
      {/* Header card */}
      <Card className="border-eel-light border-b-4 shadow-sm">
        <CardHeader className="bg-[#fbfff8] pb-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Badge variant="blue" className="gap-1.5">
              <Languages className="size-4" /> Dịch thuật thông minh
            </Badge>

            {/* Direction toggle */}
            <div className="flex items-center gap-2 font-extrabold text-eel-dark-blue">
              <span className={cn(direction === "en-vi" && "text-[#438f0e] font-black")}>
                Tiếng Anh
              </span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleSwapDirection}
                title="Đổi chiều dịch"
                className="size-9 rounded-lg p-0"
              >
                <ArrowLeftRight className="size-4" />
              </Button>
              <span className={cn(direction === "vi-en" && "text-[#438f0e] font-black")}>
                Tiếng Việt
              </span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pt-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Input area */}
            <div className="space-y-2">
              <label className="text-xs font-extrabold uppercase tracking-wider text-ash">
                Văn bản gốc ({direction === "en-vi" ? "Tiếng Anh" : "Tiếng Việt"})
              </label>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={
                  direction === "en-vi"
                    ? "Nhập từ hoặc câu tiếng Anh cần dịch…"
                    : "Nhập từ hoặc câu tiếng Việt cần dịch…"
                }
                rows={5}
                className="w-full resize-none rounded-xl border-2 border-[#e5e5e5] p-4 text-base font-bold text-eel-dark-blue focus:border-ecto-green focus:outline-none"
              />
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-ash">
                  {inputText.length}/2000 ký tự
                </span>
                {direction === "en-vi" && inputText.trim() && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSpeak(inputText)}
                    className="h-8 gap-1 text-xs"
                  >
                    <Volume2 className="size-4 text-macaw-blue" /> Nghe
                  </Button>
                )}
              </div>
            </div>

            {/* Result area */}
            <div className="space-y-2">
              <label className="text-xs font-extrabold uppercase tracking-wider text-ash">
                Bản dịch ({direction === "en-vi" ? "Tiếng Việt" : "Tiếng Anh"})
              </label>
              <div className="relative min-h-[140px] w-full rounded-xl border-2 border-[#e5e5e5] bg-[#fcfcfc] p-4">
                {loading ? (
                  <div className="flex h-28 items-center justify-center text-ash gap-2 font-bold">
                    <Loader2 className="size-5 animate-spin text-ecto-green" /> Đang dịch…
                  </div>
                ) : result ? (
                  <div className="space-y-3">
                    <p className="text-xl font-extrabold text-[#438f0e] leading-relaxed">
                      {result.translated}
                    </p>

                    {/* Rich dictionary details badge section */}
                    {(result.phonetic || (result.partsOfSpeech && result.partsOfSpeech.length > 0)) && (
                      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[#eeeeee]">
                        {result.phonetic && (
                          <button
                            type="button"
                            onClick={() => handleSpeak(englishTextToSpeak)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-macaw-blue/40 bg-[#f0f9ff] px-2.5 py-1 text-xs font-black text-macaw-blue hover:bg-[#e0f2fe] transition"
                            title="Click để nghe phát âm phiên âm"
                          >
                            <Volume2 className="size-3.5" />
                            {result.phonetic}
                          </button>
                        )}
                        {result.partsOfSpeech?.map((pos, idx) => (
                          <Badge key={idx} variant="blue" className="text-xs">
                            {pos}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Example sentence & translation if available */}
                    {result.exampleSentence && (
                      <div className="text-xs font-bold text-ash border-t border-[#f0f0f0] pt-2 space-y-0.5">
                        <p>
                          <span className="font-extrabold text-eel-dark-blue">Ví dụ:</span> &ldquo;
                          {result.exampleSentence}&rdquo;
                        </p>
                        {result.exampleTranslation && (
                          <p className="text-[#438f0e]">
                            &rarr; &ldquo;{result.exampleTranslation}&rdquo;
                          </p>
                        )}
                      </div>
                    )}

                    {result.confidence !== null && (
                      <p className="text-[11px] font-bold text-ash/80">
                        Độ khớp dịch: {Math.round(result.confidence * 100)}%
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm font-bold text-ash/60 italic">
                    Kết quả dịch sẽ xuất hiện ở đây…
                  </p>
                )}
              </div>

              {result && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleCopy}
                    className="h-9 text-xs"
                  >
                    <Copy className="size-3.5" />
                    {copied ? "Đã chép" : "Sao chép"}
                  </Button>

                  {englishTextToSpeak && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => handleSpeak(englishTextToSpeak)}
                      className="h-9 text-xs"
                    >
                      <Volume2 className="size-3.5 text-macaw-blue" /> Đọc từ tiếng Anh
                    </Button>
                  )}

                  <Button
                    type="button"
                    variant="blue"
                    size="sm"
                    onClick={handleOpenAddModal}
                    className="h-9 text-xs ml-auto"
                  >
                    <FolderPlus className="size-4" /> Thêm vào gói từ
                  </Button>
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="rounded-xl border-2 border-[#ff6b6b] bg-[#fff3f3] p-4 text-sm font-bold text-[#b93636]">
              {error}
            </div>
          )}

          {/* Action row */}
          <div className="flex justify-end pt-2">
            <Button
              type="button"
              size="lg"
              onClick={handleTranslate}
              disabled={loading || !inputText.trim()}
              className="w-full sm:w-auto"
            >
              {loading ? (
                <>
                  <Loader2 className="size-5 animate-spin" /> Đang dịch…
                </>
              ) : (
                <>
                  <Sparkles className="size-5" /> Dịch ngay
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Modal dialog for adding word to deck */}
      {showDeckModal && result && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-lg border-eel-light border-b-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <CardHeader className="bg-[#fbfff8] border-b border-[#f0f0f0]">
              <CardTitle className="flex items-center gap-2 text-xl font-black text-eel-dark-blue">
                <FolderPlus className="size-5 text-macaw-blue" />
                Thêm từ vào gói vựng
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              {/* Target info preview */}
              <div className="rounded-xl border-2 border-lingot-lime/70 bg-[#f7fff1] p-3 text-sm">
                <p className="font-extrabold text-[#438f0e]">
                  Từ tiếng Anh:{" "}
                  <span className="text-eel-dark-blue">
                    {result.direction === "en-vi" ? result.original : result.translated}
                  </span>
                </p>
                <p className="font-extrabold text-[#438f0e]">
                  Nghĩa tiếng Việt:{" "}
                  <span className="text-eel-dark-blue">
                    {result.direction === "en-vi" ? result.translated : result.original}
                  </span>
                </p>
              </div>

              <form onSubmit={handleAddWordToDeck} className="space-y-4">
                {/* Destination selector */}
                <div className="space-y-2">
                  <label className="text-xs font-extrabold uppercase tracking-wider text-ash">
                    Chọn gói từ
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={decks.length === 0}
                      onClick={() => setDestinationType("existing")}
                      className={cn(
                        "flex items-center justify-center rounded-xl border-2 p-3 text-sm font-extrabold transition",
                        destinationType === "existing"
                          ? "border-ecto-green bg-[#f2ffe9] text-[#438f0e]"
                          : "border-[#e5e5e5] bg-white text-ash hover:border-ash",
                      )}
                    >
                      Gói hiện có ({decks.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setDestinationType("new")}
                      className={cn(
                        "flex items-center justify-center rounded-xl border-2 p-3 text-sm font-extrabold transition",
                        destinationType === "new"
                          ? "border-ecto-green bg-[#f2ffe9] text-[#438f0e]"
                          : "border-[#e5e5e5] bg-white text-ash hover:border-ash",
                      )}
                    >
                      <Plus className="size-4 mr-1" /> Gói mới
                    </button>
                  </div>
                </div>

                {destinationType === "existing" ? (
                  <div className="space-y-2">
                    <label className="text-xs font-extrabold uppercase tracking-wider text-ash">
                      Danh sách gói từ cá nhân
                    </label>
                    <select
                      value={selectedDeckId}
                      onChange={(e) => setSelectedDeckId(e.target.value)}
                      className="w-full rounded-xl border-2 border-[#e5e5e5] p-3 text-sm font-extrabold text-eel-dark-blue bg-white"
                    >
                      {decks.map((deck) => (
                        <option key={deck.id} value={deck.id}>
                          {deck.title}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="space-y-3 rounded-xl border-2 border-[#e5e5e5] bg-[#fcfcfc] p-4">
                    <div>
                      <label className="text-xs font-extrabold uppercase tracking-wider text-ash">
                        Tên gói mới *
                      </label>
                      <Input
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        placeholder="VD: Từ vựng Du lịch 2026"
                        required
                        className="mt-1 font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-extrabold uppercase tracking-wider text-ash">
                        Mô tả ngắn
                      </label>
                      <Input
                        value={newDescription}
                        onChange={(e) => setNewDescription(e.target.value)}
                        placeholder="Mô tả cho gói từ này…"
                        className="mt-1 font-bold text-sm"
                      />
                    </div>
                  </div>
                )}

                {/* Additional optional fields */}
                <details open className="rounded-xl border-2 border-[#e5e5e5] bg-white p-3 text-xs">
                  <summary className="font-extrabold text-ash cursor-pointer select-none">
                    Thông tin từ vựng bổ sung
                  </summary>
                  <div className="mt-3 space-y-3 pt-2 border-t border-[#f0f0f0]">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="font-extrabold text-ash">Phiên âm IPA</label>
                        <Input
                          value={customPhonetic}
                          onChange={(e) => setCustomPhonetic(e.target.value)}
                          placeholder="/.../"
                          className="mt-1 h-9 text-xs font-bold"
                        />
                      </div>
                      <div>
                        <label className="font-extrabold text-ash">Loại từ (phân cách phẩy)</label>
                        <Input
                          value={customPartsOfSpeech}
                          onChange={(e) => setCustomPartsOfSpeech(e.target.value)}
                          placeholder="danh từ, động từ"
                          className="mt-1 h-9 text-xs font-bold"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="font-extrabold text-ash">Câu ví dụ (tiếng Anh)</label>
                      <Input
                        value={customExampleSentence}
                        onChange={(e) => setCustomExampleSentence(e.target.value)}
                        placeholder="Sentence in English…"
                        className="mt-1 h-9 text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="font-extrabold text-ash">Dịch câu ví dụ (tiếng Việt)</label>
                      <Input
                        value={customExampleTranslation}
                        onChange={(e) => setCustomExampleTranslation(e.target.value)}
                        placeholder="Dịch câu ví dụ…"
                        className="mt-1 h-9 text-xs font-bold"
                      />
                    </div>
                  </div>
                </details>

                {addMessage && (
                  <div
                    className={cn(
                      "rounded-xl border-2 p-3 text-sm font-bold flex items-center gap-2",
                      addMessage.type === "success"
                        ? "border-ecto-green bg-[#f2ffe9] text-[#438f0e]"
                        : "border-[#ff6b6b] bg-[#fff3f3] text-[#b93636]",
                    )}
                  >
                    {addMessage.type === "success" && (
                      <CheckCircle2 className="size-5 shrink-0" />
                    )}
                    {addMessage.text}
                  </div>
                )}

                <div className="flex gap-3 justify-end pt-2 border-t border-[#f0f0f0]">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setShowDeckModal(false)}
                    disabled={addingWord}
                  >
                    Hủy
                  </Button>
                  <Button type="submit" disabled={addingWord}>
                    {addingWord ? (
                      <>
                        <Loader2 className="size-4 animate-spin" /> Đang lưu…
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
      )}
    </div>
  );
}
