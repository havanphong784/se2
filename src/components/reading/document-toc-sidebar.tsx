"use client";

import React, { useState } from "react";
import {
  BookOpen,
  ChevronRight,
  Layers,
  FileText,
  Clock,
  Trash2,
  Bookmark,
  Check,
  X,
  Plus,
  Zap,
  RotateCcw,
  Square,
  Sparkles,
} from "lucide-react";
import type {
  StructuredDocumentMeta,
  TableOfContentItem,
} from "@/types/reading";

interface DocumentTocSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  documentMeta: StructuredDocumentMeta | null;
  allSavedDocs?: StructuredDocumentMeta[];
  activeChunkIndex: number;
  onSelectTocItem: (item: TableOfContentItem) => void;
  onSelectDocument?: (docId: string) => void;
  onDeleteDocument?: (docId: string) => void;
  onNewDocument?: () => void;
  onSaveCurrentSession?: () => void;
  isDocumentSaved?: boolean;
  analyzedSentencesCount?: number;
  chunkAnalyzedCount?: number;
  totalChunkSentences?: number;
  allChunkSentencesCount?: number;
  isPreanalyzingChunk?: boolean;
  onStartPreanalyzeChunk?: () => void;
  onStopPreanalyzeChunk?: () => void;
  onClearDocumentAnalyses?: () => void;
}

export function DocumentTocSidebar({
  isOpen,
  onClose,
  documentMeta,
  allSavedDocs = [],
  activeChunkIndex,
  onSelectTocItem,
  onSelectDocument,
  onDeleteDocument,
  onNewDocument,
  onSaveCurrentSession,
  isDocumentSaved = false,
  analyzedSentencesCount = 0,
  chunkAnalyzedCount = 0,
  totalChunkSentences,
  allChunkSentencesCount,
  isPreanalyzingChunk = false,
  onStartPreanalyzeChunk,
  onStopPreanalyzeChunk,
  onClearDocumentAnalyses,
}: DocumentTocSidebarProps) {
  const [tab, setTab] = useState<"toc" | "history">("toc");

  if (!isOpen) return null;

  const totalChunks = documentMeta?.totalChunks || 1;
  const progressPercent = Math.min(
    100,
    Math.round(((activeChunkIndex + 1) / totalChunks) * 100)
  );

  const totalSentences = totalChunkSentences ?? allChunkSentencesCount ?? 0;
  const chunkPercent =
    totalSentences > 0
      ? Math.min(100, Math.round((chunkAnalyzedCount / totalSentences) * 100))
      : 0;

  return (
    <>
      {/* Backdrop overlay làm mờ nền và chống các thành phần khác che khuất hoặc chạm nhầm */}
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside className="fixed inset-y-0 left-0 z-50 flex w-80 max-w-[85vw] flex-col border-r-2 border-[#e5e5e5] bg-white shadow-2xl animate-in slide-in-from-left duration-200">
        {/* Header bar */}
        <div className="flex items-center justify-between border-b-2 border-[#eeeeee] p-4">
          <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-[#e5f6fd] text-[#1cb0f6]">
              <BookOpen className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-black text-eel-dark-blue truncate">
                Cấu trúc &amp; Chỉ mục
              </h3>
              <p
                className="text-[11px] font-bold text-ash truncate"
                title={documentMeta?.title || "Tài liệu đang mở"}
              >
                {documentMeta?.title || "Tài liệu đang mở"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-ash hover:bg-gray-100 hover:text-charcoal cursor-pointer"
            title="Đóng sidebar"
          >
            <X className="size-4.5" />
          </button>
        </div>

      {/* Tabs chuyển đổi: Mục lục bài hiện tại vs Lịch sử tài liệu */}
      <div className="flex border-b border-[#eeeeee] bg-[#fafafa] p-1.5 gap-1 text-xs font-bold">
        <button
          type="button"
          onClick={() => setTab("toc")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 transition-all ${
            tab === "toc"
              ? "bg-white text-eel-dark-blue shadow-2xs border border-[#e5e5e5]"
              : "text-ash hover:text-charcoal"
          }`}
        >
          <Layers className="size-3.5" /> Mục lục (TOC)
        </button>
        <button
          type="button"
          onClick={() => setTab("history")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 transition-all ${
            tab === "history"
              ? "bg-white text-eel-dark-blue shadow-2xs border border-[#e5e5e5]"
              : "text-ash hover:text-charcoal"
          }`}
        >
          <Clock className="size-3.5" /> Thư viện ({allSavedDocs.length})
        </button>
      </div>

      {/* Tiến độ đọc của tài liệu hiện tại */}
      {tab === "toc" && documentMeta && (
        <div className="border-b border-[#eeeeee] bg-[#f9fdf5] p-3">
          <div className="flex items-center justify-between text-[11px] font-extrabold text-eel-dark-blue mb-1">
            <span>Tiến độ đọc tài liệu:</span>
            <span className="text-[#438f0e]">{progressPercent}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-[#e5e5e5]">
            <div
              className="h-full bg-ecto-green transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="mt-1 flex items-center justify-between text-[10px] font-semibold text-ash">
            <span>
              Phần {activeChunkIndex + 1} / {totalChunks}
            </span>
            <span>{documentMeta.totalPages} trang tổng cộng</span>
          </div>
        </div>
      )}

      {/* Khối Trạng thái AI & Offline */}
      {tab === "toc" && documentMeta && (
        <div className="border-b border-[#eeeeee] bg-[#f8fafc] p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-black text-eel-dark-blue">
              <Zap className="size-3.5 text-[#1cb0f6] fill-[#1cb0f6]" />
              <span>Trạng thái AI &amp; Offline</span>
            </div>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                chunkPercent === 100
                  ? "bg-[#f7fff1] text-[#438f0e] border border-eel-light"
                  : isPreanalyzingChunk
                  ? "bg-amber-100 text-amber-800 border border-amber-300 animate-pulse"
                  : "bg-blue-50 text-[#087db4] border border-[#bfe9fd]"
              }`}
            >
              {chunkPercent === 100
                ? "Sẵn sàng 100%"
                : isPreanalyzingChunk
                ? "Đang phân tích"
                : `${chunkPercent}%`}
            </span>
          </div>

          {/* Thanh progress nhỏ và thông số câu trong phần này */}
          <div>
            <div className="flex items-center justify-between text-[11px] font-bold text-charcoal mb-1">
              <span>Độ sẵn sàng AI:</span>
              <span className="font-mono text-[#087db4]">
                {chunkAnalyzedCount}/{totalSentences} câu trong phần này ({chunkPercent}%)
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#e2e8f0]">
              <div
                className={`h-full transition-all duration-300 ${
                  chunkPercent === 100 ? "bg-ecto-green" : "bg-[#1cb0f6]"
                }`}
                style={{ width: `${chunkPercent}%` }}
              />
            </div>
          </div>

          {/* Tổng số câu đã phân tích toàn tài liệu */}
          <div className="flex items-center justify-between text-[10.5px] font-semibold text-ash">
            <span>Tổng số câu đã phân tích toàn tài liệu:</span>
            <span className="font-mono font-bold text-charcoal">
              {analyzedSentencesCount} câu
            </span>
          </div>

          {/* Nút hành động */}
          <div className="pt-0.5 space-y-1.5">
            {isPreanalyzingChunk ? (
              <button
                type="button"
                onClick={onStopPreanalyzeChunk}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-red-300 bg-red-50 py-2 text-xs font-bold text-red-600 hover:bg-red-100 hover:border-red-400 transition-colors cursor-pointer shadow-xs"
              >
                <Square className="size-3.5 fill-red-600 text-red-600" />
                <span>Đang phân tích... (Bấm để dừng)</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onStartPreanalyzeChunk}
                disabled={chunkPercent === 100}
                className={`flex w-full items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-bold transition-all shadow-xs ${
                  chunkPercent === 100
                    ? "border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed"
                    : "border-[#1cb0f6] bg-[#1cb0f6] text-white hover:bg-[#16a5e8] cursor-pointer active:translate-y-0.5"
                }`}
              >
                <Zap className={`size-3.5 ${chunkPercent === 100 ? "text-gray-400" : "text-white fill-white"}`} />
                <span>
                  {chunkPercent === 100
                    ? "Đã sẵn sàng offline phần này"
                    : "⚡ Phân tích trước toàn bộ phần này"}
                </span>
              </button>
            )}

            {/* Nút làm mới / xóa cache AI của tài liệu */}
            {onClearDocumentAnalyses && (
              <button
                type="button"
                onClick={() => {
                  if (
                    confirm(
                      `Bạn có chắc muốn xóa sạch toàn bộ cache phân tích AI của tài liệu "${
                        documentMeta.title || "này"
                      }" trong IndexedDB để phân tích lại từ đầu?`
                    )
                  ) {
                    onClearDocumentAnalyses();
                  }
                }}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white py-1.5 text-[11px] font-bold text-ash hover:text-red-600 hover:border-red-200 hover:bg-red-50/50 transition-colors cursor-pointer"
                title="Xóa cache phân tích AI đã lưu của tài liệu này"
              >
                <RotateCcw className="size-3 text-current" />
                <span>Làm mới / Xóa cache AI của tài liệu</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Tab 1: Cây Mục lục (Table of Contents) */}
      {tab === "toc" && (
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {(!documentMeta?.toc || documentMeta.toc.length === 0) ? (
            <div className="py-10 text-center text-xs text-ash">
              <Bookmark className="mx-auto size-8 text-gray-300 mb-2" />
              <span>Tài liệu không có mục lục phân cấp.</span>
            </div>
          ) : (
            documentMeta.toc.map((item) => {
              const isActive = item.chunkIndex === activeChunkIndex;

              const indentClass =
                item.level === 1
                  ? "pl-2 font-black text-eel-dark-blue"
                  : item.level === 2
                  ? "pl-5 font-bold text-charcoal"
                  : "pl-8 font-medium text-ash";

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onSelectTocItem(item);
                    onClose();
                  }}
                  className={`group flex w-full items-center justify-between rounded-xl py-2 pr-2.5 text-xs transition-all text-left ${indentClass} ${
                    isActive
                      ? "bg-[#e5f6fd] border border-[#bfe9fd] text-[#087db4]"
                      : "hover:bg-gray-100"
                  }`}
                >
                  <div className="flex items-center gap-1.5 min-w-0 flex-1 pr-2">
                    <ChevronRight
                      className={`size-3 shrink-0 transition-transform ${
                        isActive ? "rotate-90 text-[#1cb0f6]" : "text-gray-400 group-hover:translate-x-0.5"
                      }`}
                    />
                    <span className="truncate min-w-0 flex-1">{item.title}</span>
                  </div>
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.2 text-[10px] font-mono font-bold ${
                      isActive
                        ? "bg-[#1cb0f6] text-white"
                        : "bg-gray-100 text-ash group-hover:bg-gray-200"
                    }`}
                  >
                    Trang {item.pageNumber}
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}

      {/* Tab 2: Thư viện tài liệu đã lưu trong IndexedDB */}
      {tab === "history" && (
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {onSaveCurrentSession && (
            <button
              onClick={onSaveCurrentSession}
              disabled={isDocumentSaved}
              className={`flex w-full items-center justify-center gap-1.5 rounded-xl border-2 py-2.5 text-xs font-black transition-colors ${
                isDocumentSaved
                  ? "border-[#a5ed6e] bg-[#f7fff1] text-[#438f0e] cursor-default opacity-85"
                  : "border-ecto-green bg-[#f7fff1] text-[#438f0e] hover:bg-[#ebfcdb] cursor-pointer"
              }`}
            >
              {isDocumentSaved ? (
                <>
                  <Check className="size-4 text-[#438f0e]" /> Đã lưu trong thư viện (.vdoc)
                </>
              ) : (
                <>
                  <Bookmark className="size-4 text-ecto-green" /> Lưu phiên học hiện tại (.vdoc)
                </>
              )}
            </button>
          )}

          {onNewDocument && (
            <button
              onClick={() => {
                onNewDocument();
                onClose();
              }}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-[#bfe9fd] bg-[#f0f9ff] py-2.5 text-xs font-black text-[#1cb0f6] hover:bg-[#e0f2fe] transition-colors"
            >
              <Plus className="size-4" /> Nhập thêm tài liệu mới
            </button>
          )}

          {allSavedDocs.length === 0 ? (
            <div className="py-10 text-center text-xs text-ash">
              <FileText className="mx-auto size-8 text-gray-300 mb-2" />
              <span>Chưa có tài liệu nào trong thư viện.</span>
            </div>
          ) : (
            allSavedDocs.map((doc) => {
              const isCurrent = doc.id === documentMeta?.id;

              return (
                <div
                  key={doc.id}
                  onClick={() => {
                    if (onSelectDocument && !isCurrent) {
                      onSelectDocument(doc.id);
                      onClose();
                    }
                  }}
                  className={`group relative flex items-start justify-between rounded-xl border-2 p-3 text-xs transition-all cursor-pointer ${
                    isCurrent
                      ? "border-ecto-green bg-[#f7fff1]"
                      : "border-[#e5e5e5] bg-white hover:border-gray-300"
                  }`}
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-extrabold text-eel-dark-blue truncate">
                        {doc.title}
                      </span>
                      {isCurrent && (
                        <span className="rounded bg-ecto-green px-1.5 py-0.2 text-[9px] font-black text-white">
                          Đang đọc
                        </span>
                      )}
                      <span className="rounded bg-[#f0fdf4] border border-[#bbf7d0] px-1 py-0.2 text-[9px] font-mono font-bold text-[#16a34a]">
                        .vdoc
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[10px] font-semibold text-ash flex-wrap">
                      <span>{doc.totalPages} trang</span>
                      <span>•</span>
                      <span>{doc.totalWords} từ</span>
                      <span>•</span>
                      <span className="uppercase">{doc.sourceType}</span>
                    </div>
                  </div>

                  {onDeleteDocument && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Bạn có chắc muốn xóa tài liệu "${doc.title}" khỏi IndexedDB?`)) {
                          onDeleteDocument(doc.id);
                        }
                      }}
                      className="opacity-0 group-hover:opacity-100 rounded-lg p-1 text-ash hover:bg-red-50 hover:text-red-500 transition-opacity"
                      title="Xóa tài liệu này"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </aside>
  </>
  );
}
