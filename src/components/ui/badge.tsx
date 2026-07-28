import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex min-h-7 items-center gap-1 rounded-xl border-2 px-2.5 py-1 text-xs font-extrabold tracking-[0.045em]",
  {
    variants: {
      variant: {
        default: "border-eel-light bg-[#f7fff1] text-[#438f0e]",
        blue: "border-[#bfe9fd] bg-[#f3fbff] text-[#087db4]",
        neutral: "border-[#e5e5e5] bg-white text-ash",
        warning: "border-[#ffe89b] bg-[#fffaf0] text-[#9b6b00]",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
