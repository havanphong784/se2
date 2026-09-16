"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeftRight,
  BookOpen,
  Clock,
  Copy,
  FolderPlus,
  History,
  Languages,
  Lightbulb,
  Loader2,
  Sparkles,
  Trash2,
  Volume2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AddWordDialog } from "@/components/add-word-dialog";
import { speakWord } from "@/lib/speech";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth-provider";
import { useDecks } from "@/lib/hooks/use-queries";

type PersonalDeck = { id: string; title: string; slug: string };

type TranslationResult = {
  original: string;
  translated: string;
  direction: "en-vi" | "vi-en";
  confidence: number | null;
  phonetic?: string;
  audioUrl?: string;
  partsOfSpeech?: string[];
  exampleSentence?: string;
  exampleTranslation?: string;
};

type TranslationHistoryItem = {
  id: string;
  original: string;
  translated: string;
  direction: "en-vi" | "vi-en";
  timestamp: string;
};

const SUGGESTED_TOPICS = [
  { label: "Trường học", query: "school" },
  { label: "Môi trường", query: "environment" },
  { label: "Du lịch", query: "travel" },
  { label: "Trí tuệ nhân tạo", query: "artificial intelligence" },
  { label: "Sức khỏe", query: "health" },
  { label: "Kinh tế", query: "economy" },
  { label: "Ẩm thực", query: "cuisine" },
];

export function TranslationTool({
  decks: initialDecks,
}: {
  available: boolean;
  decks: PersonalDeck[];
}) {
  const { authFetch } = useAuth();
  const [direction, setDirection] = useState<"en-vi" | "vi-en">("en-vi");
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const translateControllerRef = useRef<AbortController | null>(null);

  const STORAGE_KEY = "vocabloom_translation_history";

  // Recent translation history state
  const [history, setHistory] = useState<TranslationHistoryItem[]>([]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        const parsed: unknown = saved ? JSON.parse(saved) : [];
        if (Array.isArray(parsed)) setHistory(parsed);
      } catch {
        // Ignore localStorage errors
      }
    });
    return () => {
      active = false;
      translateControllerRef.current?.abort();
    };
  }, []);

  function handleClearHistory() {
    setHistory([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore localStorage errors
    }
  }

  // Deck modal state
  const { data: remoteDecks } = useDecks();
  const [createdDecks, setCreatedDecks] = useState<PersonalDeck[]>([]);
  const decks = useMemo(() => {
    const list = remoteDecks
      ? remoteDecks
          .filter((d) => d.ownership === "personal")
          .map((d) => ({ id: d.id, title: d.title, slug: d.slug }))
      : initialDecks;
    const combined = [...createdDecks, ...list];
    const seen = new Set<string>();
    return combined.filter((d) => {
      if (seen.has(d.id)) return false;
      seen.add(d.id);
      return true;
    });
  }, [remoteDecks, initialDecks, createdDecks]);

  const [showDeckModal, setShowDeckModal] = useState(false);

  function handleSwapDirection() {
    translateControllerRef.current?.abort();
    setDirection((prev) => (prev === "en-vi" ? "vi-en" : "en-vi"));
    if (result) {
      setInputText(result.translated);
      setResult(null);
    }
  }

  async function performTranslate(textToTranslate: string, dir: "en-vi" | "vi-en" = direction) {
    if (!textToTranslate.trim()) return;
    translateControllerRef.current?.abort();
    const controller = new AbortController();
    translateControllerRef.current = controller;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await authFetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: textToTranslate.trim(), direction: dir }),
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Lỗi dịch từ.");
      }
      if (translateControllerRef.current !== controller) return;
      setResult(data);

      // Add to history
      setHistory((prev) => {
        const newItem: TranslationHistoryItem = {
          id: crypto.randomUUID(),
          original: data.original,
          translated: data.translated,
          direction: data.direction,
          timestamp: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
        };
        const next = [newItem, ...prev.filter((h) => h.original !== data.original).slice(0, 9)];
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          // Ignore localStorage errors
        }
        return next;
      });
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      if (translateControllerRef.current === controller) {
        setError(err instanceof Error ? err.message : "Không thể kết nối dịch vụ dịch.");
      }
    } finally {
      if (translateControllerRef.current === controller) {
        translateControllerRef.current = null;
        setLoading(false);
      }
    }
  }

  function handleTranslate() {
    performTranslate(inputText, direction);
  }

  function handleTopicClick(query: string) {
    setInputText(query);
    setDirection("en-vi");
    performTranslate(query, "en-vi");
  }

  function handleHistoryClick(item: TranslationHistoryItem) {
    setInputText(item.original);
    setDirection(item.direction);
    performTranslate(item.original, item.direction);
  }

  function handleCopy() {
    if (!result) return;
    navigator.clipboard.writeText(result.translated);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleSpeak(text: string) {
    if (!text.trim()) return;
    speakWord(text.trim(), result?.audioUrl, "normal");
  }

  function handleOpenAddModal() {
    if (!result) return;
    setShowDeckModal(true);
  }

  const englishTextToSpeak =
    result && result.direction === "en-vi"
      ? result.original
      : result && result.direction === "vi-en"
        ? result.translated
        : "";

  return (
    <div className="grid gap-8 lg:grid-cols-12">
      {/* Left Column: Translation Workspace (8 cols) */}
      <div className="space-y-6 lg:col-span-8">
        <Card className="border-eel-light border-b-4">
          <CardHeader className="bg-[#fbfff8] pb-4 border-b border-[#eeeeee]">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <Badge variant="blue" className="gap-1.5 text-xs font-extrabold">
                <Languages className="size-4" /> Bảng dịch trực tiếp
              </Badge>

              {/* Direction toggle */}
              <div className="flex items-center gap-2 font-extrabold text-eel-dark-blue text-sm">
                <span className={cn(direction === "en-vi" && "text-[#438f0e] font-black")}>
                  Tiếng Anh
                </span>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleSwapDirection}
                  title="Đổi chiều dịch"
                  className="size-9 rounded-lg p-0 border-2 border-[#e5e5e5]"
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
                <div className="flex justify-between items-center">
                  <label className="text-xs font-extrabold uppercase tracking-wider text-ash">
                    Văn bản gốc ({direction === "en-vi" ? "Tiếng Anh" : "Tiếng Việt"})
                  </label>
                  {inputText && (
                    <button
                      type="button"
                      onClick={() => setInputText("")}
                      className="text-xs font-bold text-ash hover:text-red-500"
                    >
                      Xóa
                    </button>
                  )}
                </div>
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      handleTranslate();
                    }
                  }}
                  placeholder={
                    direction === "en-vi"
                      ? "Nhập từ hoặc câu tiếng Anh cần dịch (Ví dụ: environment, hello, ...)"
                      : "Nhập từ hoặc câu tiếng Việt cần dịch (Ví dụ: xin chào, môi trường, ...)"
                  }
                  rows={6}
                  maxLength={2000}
                  className="w-full resize-none rounded-xl border-2 border-[#e5e5e5] p-4 text-base font-bold text-eel-dark-blue focus:border-ecto-green focus:outline-none transition-colors"
                />
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-ash">
                    {inputText.length}/2000 ký tự (Ctrl + Enter để dịch)
                  </span>
                  {direction === "en-vi" && inputText.trim() && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSpeak(inputText)}
                      className="h-8 gap-1 text-xs font-extrabold text-macaw-blue hover:bg-blue-50"
                    >
                      <Volume2 className="size-4" /> Nghe phát âm
                    </Button>
                  )}
                </div>
              </div>

              {/* Result area */}
              <div className="space-y-2">
                <label className="text-xs font-extrabold uppercase tracking-wider text-ash">
                  Bản dịch ({direction === "en-vi" ? "Tiếng Việt" : "Tiếng Anh"})
                </label>
                <div className="relative min-h-[168px] w-full rounded-xl border-2 border-[#e5e5e5] bg-[#fcfcfc] p-4">
                  {loading ? (
                    <div className="flex h-36 items-center justify-center text-ash gap-2 font-bold">
                      <Loader2 className="size-6 animate-spin text-ecto-green" /> Đang dịch qua Google API…
                    </div>
                  ) : result ? (
                    <div className="space-y-3">
                      <p className="text-xl font-extrabold text-[#438f0e] leading-relaxed select-all">
                        {result.translated}
                      </p>

                      {/* Rich dictionary details badge section */}
                      {(result.phonetic || (result.partsOfSpeech && result.partsOfSpeech.length > 0)) && (
                        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#eeeeee]">
                          {result.phonetic && (
                            <button
                              type="button"
                              onClick={() => handleSpeak(englishTextToSpeak)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-macaw-blue/40 bg-[#f0f9ff] px-2.5 py-1 text-xs font-black text-macaw-blue hover:bg-[#e0f2fe] transition"
                              title="Click để nghe phát âm phiên âm IPA"
                            >
                              <Volume2 className="size-3.5" />
                              {result.phonetic}
                            </button>
                          )}
                          {result.partsOfSpeech?.map((pos, idx) => (
                            <Badge key={idx} variant="blue" className="text-xs font-bold">
                              {pos}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {/* Example sentence & translation if available */}
                      {result.exampleSentence && (
                        <div className="text-xs font-bold text-ash border-t border-[#f0f0f0] pt-2 space-y-1 bg-[#f8fafc] p-2.5 rounded-lg">
                          <p>
                            <span className="font-extrabold text-eel-dark-blue">Ví dụ Anh:</span> &ldquo;
                            {result.exampleSentence}&rdquo;
                          </p>
                          {result.exampleTranslation && (
                            <p className="text-[#438f0e]">
                              <span className="font-extrabold text-[#438f0e]">Dịch Việt:</span> &ldquo;{result.exampleTranslation}&rdquo;
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex h-36 flex-col items-center justify-center text-center text-ash/60">
                      <Languages className="size-8 mb-2 opacity-40" />
                      <p className="text-sm font-bold italic">
                        Nhập từ vựng hoặc câu ở bên trái để xem bản dịch…
                      </p>
                    </div>
                  )}
                </div>

                {result && (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={handleCopy}
                      className="h-9 text-xs font-extrabold border-2"
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
                        className="h-9 text-xs font-extrabold text-macaw-blue border-2"
                      >
                        <Volume2 className="size-3.5" /> Nghe từ tiếng Anh
                      </Button>
                    )}

                    <Button
                      type="button"
                      variant="blue"
                      size="sm"
                      onClick={handleOpenAddModal}
                      className="h-9 text-xs ml-auto font-black"
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
            <div className="flex justify-end pt-2 border-t border-[#eeeeee]">
              <Button
                type="button"
                size="lg"
                onClick={handleTranslate}
                disabled={loading || !inputText.trim()}
                className="w-full sm:w-auto min-w-[160px] font-black"
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

        {/* Topic suggestions */}
        <Card className="border-eel-light border-b-4 bg-[#fbfff8]">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3 text-xs font-extrabold uppercase tracking-wider text-ash">
              <Sparkles className="size-4 text-ecto-green" /> Từ vựng gợi ý theo chủ đề nhanh
            </div>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_TOPICS.map((topic) => (
                <button
                  key={topic.query}
                  type="button"
                  onClick={() => handleTopicClick(topic.query)}
                  className="rounded-xl border-2 border-[#e5e5e5] bg-white px-3.5 py-1.5 text-xs font-extrabold text-eel-dark-blue hover:border-ecto-green hover:bg-[#f2ffe9] hover:text-[#438f0e] transition"
                >
                  {topic.label} ({topic.query})
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right Column: History & Quick Deck Access (4 cols) */}
      <div className="space-y-6 lg:col-span-4">
        {/* Recent Translation History */}
        <Card className="border-eel-light border-b-4">
          <CardHeader className="pb-3 border-b border-[#eeeeee]">
            <CardTitle className="flex items-center justify-between text-base font-extrabold text-eel-dark-blue">
              <span className="flex items-center gap-2">
                <History className="size-4 text-macaw-blue" />
                Lịch sử dịch
              </span>
              {history.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearHistory}
                  className="text-xs font-bold text-ash hover:text-red-500"
                  title="Xóa lịch sử"
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-3">
            {history.length === 0 ? (
              <div className="py-6 text-center text-xs font-bold text-ash/70">
                <Clock className="size-6 mx-auto mb-2 opacity-40" />
                Chưa có từ nào được dịch trong phiên làm việc này.
              </div>
            ) : (
              <ul className="divide-y divide-[#eeeeee] space-y-2">
                {history.map((item) => (
                  <li key={item.id} className="pt-2 first:pt-0">
                    <button
                      type="button"
                      onClick={() => handleHistoryClick(item)}
                      className="w-full text-left p-2.5 rounded-xl border border-transparent hover:border-[#e5e5e5] hover:bg-[#f9fafb] transition group"
                    >
                      <div className="flex justify-between items-start">
                        <span className="text-xs font-extrabold text-eel-dark-blue group-hover:text-macaw-blue">
                          {item.original}
                        </span>
                        <span className="text-[10px] font-bold text-ash">{item.timestamp}</span>
                      </div>
                      <p className="text-xs font-bold text-[#438f0e] truncate mt-0.5">
                        &rarr; {item.translated}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Personal Decks Summary */}
        <Card className="border-eel-light border-b-4 bg-[#fafafa]">
          <CardHeader className="pb-3 border-b border-[#eeeeee]">
            <CardTitle className="flex items-center justify-between text-base font-extrabold text-eel-dark-blue">
              <span className="flex items-center gap-2">
                <BookOpen className="size-4 text-ecto-green" />
                Gói từ cá nhân ({decks.length})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {decks.length === 0 ? (
              <p className="text-xs font-bold text-ash">
                Bạn chưa tạo gói từ cá nhân nào. Hãy dịch một từ và bấm &ldquo;Thêm vào gói từ&rdquo; để tạo mới!
              </p>
            ) : (
              <div className="space-y-2">
                {decks.slice(0, 4).map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between rounded-xl border border-[#e5e5e5] bg-white p-2.5 text-xs font-bold text-eel-dark-blue"
                  >
                    <span className="truncate max-w-[180px] font-extrabold">{d.title}</span>
                    <Link
                      href={`/vocabulary/${d.slug}`}
                      className="text-xs font-extrabold text-macaw-blue hover:underline shrink-0"
                    >
                      Xem gói &rarr;
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Helpful Tips Card */}
        <Card className="border-eel-light border-b-4 bg-[#f0f9ff]">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs font-black uppercase text-macaw-blue">
              <Lightbulb className="size-4" /> Mẹo học từ vựng hiệu quả
            </div>
            <ul className="text-xs font-bold text-eel-dark-blue space-y-1.5 leading-relaxed list-disc list-inside">
              <li>Tra từ đơn lẻ để hệ thống tự động tìm phiên âm IPA &amp; loại từ.</li>
              <li>Lưu ngay từ vừa tra vào gói từ vựng cá nhân để học lặp lại ngắt quãng.</li>
              <li>Sử dụng tính năng đọc âm thanh để luyện nghe và phát âm theo.</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Modal dialog for adding word to deck */}
      {showDeckModal && result && (
        <AddWordDialog
          isOpen={showDeckModal}
          onClose={() => setShowDeckModal(false)}
          initialWord={{
            term: result.direction === "en-vi" ? result.original : result.translated,
            translation: result.direction === "en-vi" ? result.translated : result.original,
            phonetic: result.phonetic,
            audioUrl: result.audioUrl,
            partOfSpeech: result.partsOfSpeech,
            exampleSentence: result.exampleSentence,
            exampleTranslation: result.exampleTranslation,
          }}
          onSuccess={(deck) => {
            setCreatedDecks((prev) => [deck, ...prev]);
          }}
        />
      )}
    </div>
  );
}
