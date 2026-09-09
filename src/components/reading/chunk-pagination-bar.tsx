"use client";

import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StructuredDocumentMeta } from "@/types/reading";

interface ChunkPaginationBarProps {
  meta: StructuredDocumentMeta | null;
  activeChunkIndex: number;
  currentChapterTitle?: string;
  startPage: number;
  endPage: number;
  onPrevChunk: () => void;
  onNextChunk: () => void;
  onToggleToc?: () => void;
  onSelectChunkIndex?: (index: number) => void;
  className?: string;
}

export function ChunkPaginationBar({
  meta,
  activeChunkIndex,
  currentChapterTitle,
  startPage,
  endPage,
  onPrevChunk,
  onNextChunk,
  onSelectChunkIndex,
  className,
}: ChunkPaginationBarProps) {
  if (!meta) return null;

  const totalChunks = meta.totalChunks || 1;
  const hasPrev = activeChunkIndex > 0;
  const hasNext = activeChunkIndex < totalChunks - 1;

  return (
    <div
      className={cn("flex items-center gap-1 sm:gap-1.5", className)}
      title={currentChapterTitle ? `Chương: ${currentChapterTitle}` : undefined}
    >
      {/* Nút lùi phần trước */}
      <button
        type="button"
        onClick={onPrevChunk}
        disabled={!hasPrev}
        className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-[#e5e5e5] bg-[#fafafa] text-charcoal hover:bg-white hover:border-[#1cb0f6] disabled:opacity-30 disabled:hover:border-[#e5e5e5] transition-all cursor-pointer disabled:cursor-not-allowed"
        title="Xem phần trước"
      >
        <ChevronLeft className="size-4" />
      </button>

      {/* Nhãn hoặc Dropdown chọn phần */}
      {totalChunks > 1 && onSelectChunkIndex ? (
        <select
          value={activeChunkIndex}
          onChange={(e) => onSelectChunkIndex(Number(e.target.value))}
          aria-label="Chọn phần đọc"
          className="h-8 rounded-lg border border-[#e5e5e5] bg-[#fafafa] px-2 text-xs font-black text-eel-dark-blue hover:bg-white focus:border-[#1cb0f6] focus:outline-none cursor-pointer max-w-[190px] sm:max-w-none"
        >
          {Array.from({ length: totalChunks }, (_, i) => {
            const sP = i * (meta.pagesPerChunk || 10) + 1;
            const eP = Math.min(
              (i + 1) * (meta.pagesPerChunk || 10),
              meta.totalPages || 1
            );
            return (
              <option key={i} value={i}>
                Phần {i + 1}/{totalChunks} (Trang {sP}-{eP})
              </option>
            );
          })}
        </select>
      ) : (
        <div className="flex h-8 items-center gap-1 rounded-lg border border-[#e5e5e5] bg-[#fafafa] px-2.5 text-xs font-extrabold text-eel-dark-blue whitespace-nowrap">
          <span>
            Phần {activeChunkIndex + 1}/{totalChunks}
          </span>
          <span className="font-semibold text-ash text-[11px]">
            (Trang {startPage}-{endPage})
          </span>
        </div>
      )}

      {/* Nút tiến phần kế tiếp */}
      <button
        type="button"
        onClick={onNextChunk}
        disabled={!hasNext}
        className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-[#e5e5e5] bg-[#fafafa] text-charcoal hover:bg-white hover:border-[#1cb0f6] disabled:opacity-30 disabled:hover:border-[#e5e5e5] transition-all cursor-pointer disabled:cursor-not-allowed"
        title="Xem phần sau"
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}
