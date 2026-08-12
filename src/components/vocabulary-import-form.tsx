"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Download, FileUp, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  MAX_IMPORT_BYTES,
  parseVocabularyImport,
  type ImportFormat,
  type ImportParseResult,
} from "@/lib/vocabulary-import";

type PersonalDeck = { id: string; title: string; slug: string };

type Success = {
  deck: { slug: string; title: string };
  summary: { imported: number; skippedDuplicates: number };
};

export function VocabularyImportForm({
  available,
  decks,
}: {
  available: boolean;
  decks: PersonalDeck[];
}) {
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState<ImportFormat>("csv");
  const [preview, setPreview] = useState<ImportParseResult | null>(null);
  const [destination, setDestination] = useState<"new" | "existing">("new");
  const [deckId, setDeckId] = useState(decks[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [level, setLevel] = useState("Tự chọn");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<Success | null>(null);

  async function selectFile(selected: File | null) {
    setFile(selected);
    setError(null);
    setSuccess(null);
    if (!selected) return setPreview(null);
    const detected = selected.name.toLowerCase().endsWith(".json") ? "json" : "csv";
    setFormat(detected);
    if (selected.size > MAX_IMPORT_BYTES) {
      setPreview({
        words: [], sourceRows: 0, skippedDuplicates: 0, warnings: [],
        errors: [{ row: 0, message: "Tệp vượt quá 2 MiB." }],
      });
      return;
    }
    setPreview(parseVocabularyImport(await selected.text(), detected));
  }

  async function submit() {
    if (!file || !preview || preview.errors.length) return;
    setSubmitting(true);
    setError(null);
    const body = new FormData();
    body.set("file", file);
    body.set("format", format);
    body.set("destination", destination);
    if (destination === "existing") body.set("deckId", deckId);
    else {
      body.set("title", title);
      body.set("description", description);
      body.set("level", level);
    }
    try {
      const response = await fetch("/api/vocabulary/import", { method: "POST", body });
      const result = (await response.json()) as Success & { error?: { message?: string } };
      if (!response.ok) throw new Error(result.error?.message ?? "Không thể nhập từ vựng.");
      setSuccess(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể nhập từ vựng.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
      <Card className="p-5 md:p-6">
        <Badge variant="blue"><FileUp className="size-4" /> CSV hoặc JSON</Badge>
        <h2 className="mt-4 text-2xl font-extrabold text-eel-dark-blue">Chọn tệp từ vựng</h2>
        <p className="mt-2 text-sm font-bold leading-6 text-ash">
          Bắt buộc có term và translation. Tối đa 2 MiB và 2.000 dòng.
        </p>
        <div className="mt-4 rounded-xl border-2 border-[#eeeeee] bg-[#fafafa] p-4">
          <p className="text-sm font-extrabold text-eel-dark-blue">Chưa biết định dạng tệp?</p>
          <p className="mt-1 text-sm font-bold leading-6 text-ash">
            Tải tệp mẫu, thay nội dung ví dụ bằng từ của bạn rồi chọn tệp bên dưới.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href="/templates/vocabulary-import-template.csv"
              download
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Download className="size-4" /> Tải mẫu CSV
            </a>
            <a
              href="/templates/vocabulary-import-template.json"
              download
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Download className="size-4" /> Tải mẫu JSON
            </a>
          </div>
        </div>
        <Input
          type="file"
          accept=".csv,.json,text/csv,application/json"
          disabled={!available || submitting}
          onChange={(event) => void selectFile(event.target.files?.[0] ?? null)}
          className="mt-5"
        />

        <div className="mt-6 border-t-2 border-[#eeeeee] pt-5">
          <p className="font-extrabold text-eel-dark-blue">Đích import</p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant={destination === "new" ? "default" : "secondary"} onClick={() => setDestination("new")}>Bộ mới</Button>
            <Button size="sm" variant={destination === "existing" ? "default" : "secondary"} disabled={!decks.length} onClick={() => setDestination("existing")}>Bộ cá nhân có sẵn</Button>
          </div>
          {destination === "new" ? (
            <div className="mt-4 space-y-3">
              <Input placeholder="Tên bộ từ *" value={title} onChange={(event) => setTitle(event.target.value)} />
              <Input placeholder="Mô tả" value={description} onChange={(event) => setDescription(event.target.value)} />
              <Input placeholder="Trình độ" value={level} onChange={(event) => setLevel(event.target.value)} />
            </div>
          ) : (
            <select value={deckId} onChange={(event) => setDeckId(event.target.value)} className="mt-4 h-12 w-full rounded-xl border-2 border-[#dedede] bg-white px-4 font-bold">
              {decks.map((deck) => <option key={deck.id} value={deck.id}>{deck.title}</option>)}
            </select>
          )}
        </div>

        {!available && <p className="mt-5 text-sm font-bold text-[#c43e3e]">Cần database và user đã seed để import.</p>}
        {error && <p role="alert" className="mt-5 text-sm font-bold text-[#c43e3e]">{error}</p>}
        <Button
          className="mt-6 w-full"
          disabled={!available || !file || !preview || !!preview.errors.length || !preview.words.length || submitting || (destination === "new" ? !title.trim() : !deckId)}
          onClick={() => void submit()}
        >
          {submitting ? <Loader2 className="animate-spin" /> : <FileUp />} Nhập từ vựng
        </Button>
      </Card>

      <Card className="overflow-hidden p-5 md:p-6">
        <h2 className="text-2xl font-extrabold text-eel-dark-blue">Xem trước</h2>
        {!preview ? (
          <p className="mt-4 font-bold text-ash">Chọn tệp để kiểm tra nội dung trước khi lưu.</p>
        ) : (
          <>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge variant="neutral">{preview.sourceRows} dòng</Badge>
              <Badge>{preview.words.length} hợp lệ</Badge>
              <Badge variant="neutral">{preview.skippedDuplicates} trùng</Badge>
              {!!preview.errors.length && <Badge variant="neutral">{preview.errors.length} lỗi</Badge>}
            </div>
            {!!preview.errors.length && (
              <ul className="mt-4 max-h-40 space-y-1 overflow-auto rounded-xl bg-[#fff7f7] p-4 text-sm font-bold text-[#c43e3e]">
                {preview.errors.slice(0, 30).map((item, index) => <li key={`${item.row}-${index}`}>Dòng {item.row || "tệp"}: {item.message}</li>)}
              </ul>
            )}
            <div className="mt-5 max-h-[440px] overflow-auto">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead><tr className="border-b-2 border-[#eeeeee] text-ash"><th className="p-3">Term</th><th className="p-3">Translation</th><th className="p-3">Loại từ</th><th className="p-3">Ví dụ</th></tr></thead>
                <tbody>{preview.words.slice(0, 50).map((word, index) => <tr key={`${word.term}-${index}`} className="border-b border-[#eeeeee]"><td className="p-3 font-extrabold text-eel-dark-blue">{word.term}</td><td className="p-3 font-bold">{word.translation}</td><td className="p-3 text-ash">{word.partOfSpeech || "—"}</td><td className="max-w-xs p-3 text-ash">{word.exampleSentence || "—"}</td></tr>)}</tbody>
              </table>
            </div>
          </>
        )}
        {success && (
          <div role="status" className="mt-5 rounded-xl border-2 border-eel-light bg-[#fbfff8] p-4">
            <p className="flex items-center gap-2 font-extrabold text-[#438f0e]"><CheckCircle2 /> Import thành công</p>
            <p className="mt-2 font-bold text-ash">Đã thêm {success.summary.imported} từ, bỏ qua {success.summary.skippedDuplicates} từ trùng.</p>
            <Link href={`/vocabulary/${success.deck.slug}`} className={buttonVariants({ variant: "outline", className: "mt-4" })}>Mở bộ {success.deck.title}</Link>
          </div>
        )}
      </Card>
    </div>
  );
}
