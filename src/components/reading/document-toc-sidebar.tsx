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
  X,
  Plus,
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
}: DocumentTocSidebarProps) {
  const [tab, setTab] = useState<"toc" | "history">("toc");

  if (!isOpen) return null;

  const totalChunks = documentMeta?.totalChunks || 1;
  const progressPercent = Math.min(
    100,
    Math.round(((activeChunkIndex + 1) / totalChunks) * 100)
  );

  return (
    <aside className="fixed inset-y-0 left-0 z-50 flex w-80 max-w-[85vw] flex-col border-r-2 border-[#e5e5e5] bg-white shadow-2xl animate-in slide-in-from-left duration-200">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b-2 border-[#eeeeee] p-4">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-xl bg-[#e5f6fd] text-[#1cb0f6]">
            <BookOpen className="size-4" />
          </div>
          <div>
            <h3 className="text-sm font-black text-eel-dark-blue">
              Cấu trúc &amp; Chỉ mục
            </h3>
            <p className="text-[11px] font-bold text-ash truncate max-w-[170px]">
              {documentMeta?.title || "Tài liệu đang mở"}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-ash hover:bg-gray-100 hover:text-charcoal"
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
                  <div className="flex items-center gap-1.5 min-w-0 pr-2">
                    <ChevronRight
                      className={`size-3 shrink-0 transition-transform ${
                        isActive ? "rotate-90 text-[#1cb0f6]" : "text-gray-400 group-hover:translate-x-0.5"
                      }`}
                    />
                    <span className="truncate">{item.title}</span>
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
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-ecto-green bg-[#f7fff1] py-2.5 text-xs font-black text-[#438f0e] hover:bg-[#ebfcdb] transition-colors"
            >
              <Bookmark className="size-4 text-ecto-green" /> Lưu phiên học hiện tại (.vdoc)
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
  );
}
