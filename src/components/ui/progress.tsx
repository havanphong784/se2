"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

function Progress({
  className,
  value = 0,
  "aria-label": ariaLabel,
  ...props
}: React.ComponentProps<"div"> & { value?: number | null }) {
  const safeValue = Math.min(100, Math.max(0, value ?? 0));

  return (
    <div
      role="progressbar"
      aria-label={ariaLabel}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={safeValue}
      className={cn(
        "relative h-3 w-full overflow-hidden rounded-xl bg-[#e9e9e9]",
        className,
      )}
      {...props}
    >
      <div
        className="h-full w-full origin-left rounded-xl bg-ecto-green transition-transform duration-300 ease-out motion-reduce:transition-none"
        style={{ transform: `translateX(-${100 - safeValue}%)` }}
      />
    </div>
  );
}

export { Progress };
