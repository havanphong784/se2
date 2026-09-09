"use client";

import React, { useState, useRef } from "react";
import {
  FileText,
  UploadCloud,
  Image as ImageIcon,
  Loader2,
  AlertCircle,
  FileUp,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { extractTextFromPdf, extractTextFromImage } from "@/lib/reading/extractors";

interface DocumentImporterProps {
  onImportComplete: (text: string, title: string, sourceType: "raw_text" | "pdf" | "image") => void;
  onCancel?: () => void;
}

const SAMPLE_TEXT = `The rapid advance of artificial intelligence has raised profound questions about the future of work. Rarely have engineers and scholars witnessed technological shifts occurring at such an unprecedented velocity. 

While some routine occupations may gradually diminish, modern organizations must foster human resilience and adaptability. By integrating cutting-edge tools with creative problem-solving, individuals can unlock extraordinary potential and thrive in this evolving landscape.`;

export function DocumentImporter({ onImportComplete, onCancel }: DocumentImporterProps) {
  const [tab, setTab] = useState<"text" | "pdf" | "image">("text");
  const [rawText, setRawText] = useState("");
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<{ percent: number; status: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportText = () => {
    if (!rawText.trim()) {
      setError("Vui lòng nhập hoặc dán nội dung văn bản tiếng Anh.");
      return;
    }
    setError(null);
    const docTitle = title.trim() || rawText.trim().slice(0, 30) + "...";
    onImportComplete(rawText.trim(), docTitle, "raw_text");
  };

  const handleUseSampleText = () => {
    setRawText(SAMPLE_TEXT);
    setTitle("The Impact of Artificial Intelligence");
    setError(null);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setLoading(true);
    const fileName = file.name;

    try {
      if (tab === "pdf") {
        if (!file.name.toLowerCase().endsWith(".pdf")) {
          throw new Error("Vui lòng chọn file có định dạng .pdf");
        }
        const text = await extractTextFromPdf(file);
        onImportComplete(text, fileName.replace(/\.pdf$/i, ""), "pdf");
      } else if (tab === "image") {
        if (!file.type.startsWith("image/")) {
          throw new Error("Vui lòng chọn file ảnh (.png, .jpg, .webp)");
        }
        setOcrProgress({ percent: 10, status: "Đang nạp mô hình OCR tiếng Anh..." });
        const text = await extractTextFromImage(file, (p, s) => {
          setOcrProgress({ percent: Math.round(p * 100), status: s });
        });
        onImportComplete(text, fileName.replace(/\.[^/.]+$/, ""), "image");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
      setOcrProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="rounded-2xl border-2 border-b-4 border-[#e5e5e5] bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eeeeee] pb-4">
        <div>
          <h2 className="text-xl font-extrabold text-eel-dark-blue">
            Nhập tài liệu đọc hiểu tiếng Anh
          </h2>
          <p className="text-xs font-bold text-ash mt-0.5">
            Chọn nguồn tài liệu để bắt đầu trải nghiệm đọc và bóc tách câu từ thông minh
          </p>
        </div>

        {/* Tabs chọn nguồn */}
        <div className="flex items-center rounded-xl border-2 border-[#e5e5e5] bg-[#fafafa] p-1 gap-1">
          <button
            type="button"
            onClick={() => {
              setTab("text");
              setError(null);
            }}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-extrabold transition-all ${
              tab === "text"
                ? "bg-white text-eel-dark-blue shadow-xs border border-[#e5e5e5]"
                : "text-ash hover:text-charcoal"
            }`}
          >
            <FileText className="size-4" /> Dán văn bản
          </button>
          <button
            type="button"
            onClick={() => {
              setTab("pdf");
              setError(null);
            }}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-extrabold transition-all ${
              tab === "pdf"
                ? "bg-white text-eel-dark-blue shadow-xs border border-[#e5e5e5]"
                : "text-ash hover:text-charcoal"
            }`}
          >
            <UploadCloud className="size-4" /> File PDF
          </button>
          <button
            type="button"
            onClick={() => {
              setTab("image");
              setError(null);
            }}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-extrabold transition-all ${
              tab === "image"
                ? "bg-white text-eel-dark-blue shadow-xs border border-[#e5e5e5]"
                : "text-ash hover:text-charcoal"
            }`}
          >
            <ImageIcon className="size-4" /> Ảnh chụp (OCR)
          </button>
        </div>
      </div>

      <div className="mt-5">
        {/* Error notification */}
        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border-2 border-[#ffccd5] bg-[#fff5f7] p-3 text-xs font-bold text-[#c92a2a]">
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Tab 1: Dán văn bản */}
        {tab === "text" && (
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-black text-eel-dark-blue">
                  Tiêu đề tài liệu <span className="font-normal text-ash">(tùy chọn)</span>
                </label>
                <button
                  type="button"
                  onClick={handleUseSampleText}
                  className="flex items-center gap-1 text-[11px] font-extrabold text-[#1cb0f6] hover:underline"
                >
                  <Sparkles className="size-3.5" /> Dùng văn bản mẫu B2/C1
                </button>
              </div>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ví dụ: The Impact of AI on Future of Work"
                className="w-full rounded-xl border-2 border-[#e5e5e5] px-3.5 py-2 text-sm font-semibold text-charcoal focus:border-macaw-blue focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-eel-dark-blue mb-1">
                Nội dung tiếng Anh
              </label>
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                rows={8}
                placeholder="Dán văn bản tiếng Anh vào đây..."
                className="w-full rounded-xl border-2 border-[#e5e5e5] p-3.5 text-sm font-medium leading-relaxed text-charcoal focus:border-macaw-blue focus:outline-none resize-y"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              {onCancel && (
                <Button variant="ghost" size="sm" onClick={onCancel}>
                  Hủy
                </Button>
              )}
              <Button variant="default" size="default" onClick={handleImportText} className="gap-2">
                Bắt đầu đọc hiểu ngay
              </Button>
            </div>
          </div>
        )}

        {/* Tab 2: Upload PDF */}
        {tab === "pdf" && (
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#d9d9d9] bg-[#fafafa] p-10 text-center">
            <input
              type="file"
              ref={fileInputRef}
              accept=".pdf,application/pdf"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="flex size-16 items-center justify-center rounded-2xl border-2 border-b-4 border-[#bfe9fd] bg-[#f0f9ff] text-[#1cb0f6]">
              <UploadCloud className="size-8" />
            </div>
            <h3 className="mt-4 text-base font-black text-eel-dark-blue">
              Tải lên tài liệu PDF tiếng Anh
            </h3>
            <p className="mt-1 max-w-sm text-xs font-semibold leading-relaxed text-ash">
              Hệ thống sẽ tự động bóc tách text layer từ PDF thành các đoạn và câu để phân tích.
            </p>

            <Button
              variant="blue"
              size="default"
              disabled={loading}
              onClick={() => fileInputRef.current?.click()}
              className="mt-6 gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Đang trích xuất nội dung...
                </>
              ) : (
                <>
                  <FileUp className="size-4" /> Chọn file PDF từ máy tính
                </>
              )}
            </Button>
          </div>
        )}

        {/* Tab 3: Upload Image OCR */}
        {tab === "image" && (
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#d9d9d9] bg-[#fafafa] p-10 text-center">
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="flex size-16 items-center justify-center rounded-2xl border-2 border-b-4 border-[#ffd7aa] bg-[#fffaf5] text-[#ea580c]">
              <ImageIcon className="size-8" />
            </div>
            <h3 className="mt-4 text-base font-black text-eel-dark-blue">
              Chụp ảnh hoặc Tải ảnh văn bản (OCR)
            </h3>
            <p className="mt-1 max-w-sm text-xs font-semibold leading-relaxed text-ash">
              Sử dụng công nghệ AI OCR chạy trực tiếp trên trình duyệt để nhận diện chữ tiếng Anh từ trang sách hoặc ảnh chụp.
            </p>

            {ocrProgress && (
              <div className="mt-4 w-full max-w-xs space-y-1.5">
                <div className="flex justify-between text-[11px] font-bold text-ash">
                  <span>{ocrProgress.status}</span>
                  <span>{ocrProgress.percent}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                  <div
                    className="h-full bg-ecto-green transition-all duration-200"
                    style={{ width: `${ocrProgress.percent}%` }}
                  />
                </div>
              </div>
            )}

            <Button
              variant="default"
              size="default"
              disabled={loading}
              onClick={() => fileInputRef.current?.click()}
              className="mt-6 gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Đang xử lý OCR...
                </>
              ) : (
                <>
                  <FileUp className="size-4" /> Chọn file ảnh để quét chữ
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
