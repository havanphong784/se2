import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(
        "flex h-12 w-full rounded-xl border-2 border-[#dedede] bg-[#fafafa] px-4 text-[15px] font-bold text-charcoal outline-none transition-[border-color,background-color] placeholder:text-[#a7a7a7] focus:border-macaw-blue focus:bg-white focus:ring-4 focus:ring-macaw-blue/15 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
