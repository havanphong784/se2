"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

export interface ReaderTooltipProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
  badge?: string;
  badgeVariant?: "blue" | "green" | "amber" | "gray";
  shortcut?: string;
  align?: "start" | "center" | "end";
  side?: "top" | "bottom";
  delayMs?: number;
  className?: string;
}

export function ReaderTooltip({
  children,
  title,
  description,
  badge,
  badgeVariant = "blue",
  shortcut,
  align = "center",
  side = "bottom",
  delayMs = 350,
  className,
}: ReaderTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const clearTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const handleMouseEnter = useCallback(() => {
    clearTimer();
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delayMs);
  }, [clearTimer, delayMs]);

  const handleMouseLeave = useCallback(() => {
    clearTimer();
    setIsVisible(false);
  }, [clearTimer]);

  const handleClick = useCallback(() => {
    clearTimer();
    setIsVisible(false);
  }, [clearTimer]);

  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, [clearTimer]);

  if (!title && !description && !badge && !shortcut) {
    return <>{children}</>;
  }

  const alignClasses = {
    start: "left-0",
    center: "left-1/2 -translate-x-1/2",
    end: "right-0",
  }[align];

  const sideClasses = {
    top: "bottom-full mb-3",
    bottom: "top-full mt-3",
  }[side];

  const pointerAlignClasses = {
    start: "left-4",
    center: "left-1/2 -translate-x-1/2",
    end: "right-4",
  }[align];

  const badgeStyles = {
    blue: "bg-[#e5f6fd] border-[#bfe9fd] text-[#087db4]",
    green: "bg-[#f7fff1] border-[#d7ffb8] text-[#438f0e]",
    amber: "bg-[#fff9e6] border-[#ffe58f] text-[#8c5100]",
    gray: "bg-[#fafafa] border-[#e5e5e5] text-charcoal",
  }[badgeVariant];

  return (
    <div
      className={cn("relative inline-flex shrink-0", className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      {children}

      {isVisible && (
        <div
          role="tooltip"
          className={cn(
            "absolute z-50 pointer-events-none text-left",
            "w-max min-w-[210px] max-w-[280px] rounded-2xl",
            "border-2 border-b-4 border-[#e5e5e5] border-b-[#dedede] bg-white p-3 shadow-xl",
            "animate-in fade-in zoom-in-95 duration-150",
            sideClasses,
            alignClasses
          )}
        >
          {/* Speech bubble pointer */}
          {side === "bottom" && (
            <>
              <div
                className={cn(
                  "absolute -top-2 w-0 h-0 border-x-[7px] border-x-transparent border-b-[8px] border-b-[#e5e5e5]",
                  pointerAlignClasses
                )}
              />
              <div
                className={cn(
                  "absolute -top-1.5 w-0 h-0 border-x-[6px] border-x-transparent border-b-[7px] border-b-white",
                  pointerAlignClasses
                )}
              />
            </>
          )}

          {side === "top" && (
            <>
              <div
                className={cn(
                  "absolute -bottom-2 w-0 h-0 border-x-[7px] border-x-transparent border-t-[8px] border-t-[#dedede]",
                  pointerAlignClasses
                )}
              />
              <div
                className={cn(
                  "absolute -bottom-1.5 w-0 h-0 border-x-[6px] border-x-transparent border-t-[7px] border-t-white",
                  pointerAlignClasses
                )}
              />
            </>
          )}

          {/* Header Row */}
          {(title || badge || shortcut) && (
            <div className="flex items-center justify-between gap-2">
              {title && (
                <span className="text-xs font-black tracking-tight text-eel-dark-blue">
                  {title}
                </span>
              )}
              <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                {badge && (
                  <span
                    className={cn(
                      "rounded-md border px-1.5 py-0.5 text-[10px] font-black",
                      badgeStyles
                    )}
                  >
                    {badge}
                  </span>
                )}
                {shortcut && (
                  <kbd className="rounded-md bg-[#fafafa] border-2 border-b-3 border-[#e5e5e5] px-1.5 py-0.5 text-[10px] font-mono font-black text-charcoal shadow-2xs">
                    {shortcut}
                  </kbd>
                )}
              </div>
            </div>
          )}

          {/* Description */}
          {description && (
            <p className="text-[11.5px] font-bold text-ash leading-relaxed mt-1">
              {description}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
