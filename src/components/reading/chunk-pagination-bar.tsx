"use client";

import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StructuredDocumentMeta } from "@/types/reading";
import { ReaderTooltip } from "./reader-tooltip";

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
      <ReaderTooltip
        title="Xem phần trước"
        description={
          hasPrev
            ? `Chuyển về phần ${activeChunkIndex} của tài liệu.`
            : "Bạn đang ở phần đầu tiên của tài liệu."
        }
        align="center"
      >
        <button
          type="button"
          onClick={onPrevChunk}
          disabled={!hasPrev}
          aria-label="Xem phần trước"
          className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-[#e5e5e5] bg-[#fafafa] text-charcoal hover:bg-white hover:border-[#1cb0f6] disabled:opacity-30 disabled:hover:border-[#e5e5e5] transition-all cursor-pointer disabled:cursor-not-allowed"
        >
          <ChevronLeft className="size-4" />
        </button>
      </ReaderTooltip>

      {/* Nhãn hoặc Dropdown chọn phần */}
      {totalChunks > 1 && onSelectChunkIndex ? (
        <select
          value={activeChunkIndex}
          onChange={(e) => onSelectChunkIndex(Number(e.target.value))}
          aria-label="Chọn phần đọc"
          className="h-8 rounded-lg border border-[#e5e5e5] bg-[#fafafa] px-2 text-xs font-black text-eel-dark-blue hover:bg-white focus:border-[#1cb0f6] focus:outline-none cursor-pointer w-auto min-w-[160px] max-w-[280px]"
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
      <ReaderTooltip
        title="Xem phần sau"
        description={
          hasNext
            ? `Chuyển tiếp sang phần ${activeChunkIndex + 2} của tài liệu.`
            : "Bạn đang ở phần cuối cùng của tài liệu."
        }
        align="center"
      >
        <button
          type="button"
          onClick={onNextChunk}
          disabled={!hasNext}
          aria-label="Xem phần sau"
          className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-[#e5e5e5] bg-[#fafafa] text-charcoal hover:bg-white hover:border-[#1cb0f6] disabled:opacity-30 disabled:hover:border-[#e5e5e5] transition-all cursor-pointer disabled:cursor-not-allowed"
        >
          <ChevronRight className="size-4" />
        </button>
      </ReaderTooltip>
    </div>
  );
}
