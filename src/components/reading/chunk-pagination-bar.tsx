"use client";

import React from "react";
import { ChevronLeft, ChevronRight, Menu, Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { StructuredDocumentMeta } from "@/types/reading";

interface ChunkPaginationBarProps {
  meta: StructuredDocumentMeta | null;
  activeChunkIndex: number;
  currentChapterTitle?: string;
  startPage: number;
  endPage: number;
  onPrevChunk: () => void;
  onNextChunk: () => void;
  onToggleToc: () => void;
  onSelectChunkIndex?: (index: number) => void;
}

export function ChunkPaginationBar({
  meta,
  activeChunkIndex,
  currentChapterTitle,
  startPage,
  endPage,
  onPrevChunk,
  onNextChunk,
  onToggleToc,
  onSelectChunkIndex,
}: ChunkPaginationBarProps) {
  if (!meta) return null;

  const totalChunks = meta.totalChunks || 1;
  const hasPrev = activeChunkIndex > 0;
  const hasNext = activeChunkIndex < totalChunks - 1;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border-2 border-b-4 border-[#e5e5e5] bg-white p-2.5 shadow-xs">
      {/* Nút bật/tắt Mục lục TOC */}
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={onToggleToc}
          className="gap-1.5 font-bold"
        >
          <Menu className="size-4 text-[#1cb0f6]" />
          <span>Mục lục</span>
          {meta.toc && meta.toc.length > 0 && (
            <span className="rounded-md bg-[#e5f6fd] px-1.5 py-0.2 text-[10px] font-black text-[#087db4]">
              {meta.toc.length}
            </span>
          )}
        </Button>

        {/* Tiêu đề chương / phần hiện tại */}
        {currentChapterTitle && (
          <div className="hidden md:flex items-center gap-1.5 rounded-xl bg-[#fafafa] border border-[#e5e5e5] px-3 py-1.5 text-xs">
            <Bookmark className="size-3.5 text-[#58cc02] shrink-0" />
            <span className="font-extrabold text-eel-dark-blue truncate max-w-[240px]">
              {currentChapterTitle}
            </span>
          </div>
        )}
      </div>

      {/* Điều hướng Chunks / Trang */}
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={onPrevChunk}
          disabled={!hasPrev}
          className="gap-1 font-bold text-xs"
          title="Xem phần trước (10 trang trước)"
        >
          <ChevronLeft className="size-4" />
          <span className="hidden sm:inline">Phần trước</span>
        </Button>

        {/* Bộ chọn trực tiếp Chunk */}
        {totalChunks > 1 && onSelectChunkIndex ? (
          <select
            value={activeChunkIndex}
            onChange={(e) => onSelectChunkIndex(Number(e.target.value))}
            aria-label="Chọn phần đọc"
            className="rounded-xl border-2 border-[#e5e5e5] bg-[#fafafa] px-2.5 py-1 text-xs font-black text-eel-dark-blue focus:border-[#1cb0f6] focus:outline-none cursor-pointer"
          >
            {Array.from({ length: totalChunks }, (_, i) => {
              const sP = i * meta.pagesPerChunk + 1;
              const eP = Math.min((i + 1) * meta.pagesPerChunk, meta.totalPages);
              return (
                <option key={i} value={i}>
                  Phần {i + 1}/{totalChunks} (Trang {sP}-{eP})
                </option>
              );
            })}
          </select>
        ) : (
          <div className="flex items-center gap-1 px-2 text-xs font-extrabold text-eel-dark-blue">
            <span>
              Phần {activeChunkIndex + 1}/{totalChunks}
            </span>
            <span className="font-semibold text-ash">
              (Trang {startPage}-{endPage})
            </span>
          </div>
        )}

        <Button
          variant="secondary"
          size="sm"
          onClick={onNextChunk}
          disabled={!hasNext}
          className="gap-1 font-bold text-xs"
          title="Xem phần tiếp theo (10 trang sau)"
        >
          <span className="hidden sm:inline">Phần sau</span>
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
