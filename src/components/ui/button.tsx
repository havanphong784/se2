import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border-2 px-5 text-[15px] font-extrabold tracking-[0.045em] transition-[transform,background-color,border-color,color] duration-150 ease-out focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-lingot-lime/50 disabled:pointer-events-none disabled:opacity-50 active:translate-y-0.5 [&_svg]:size-5 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "border-ecto-green border-b-[#46a302] bg-ecto-green text-white hover:bg-[#51bd02] active:border-b-ecto-green",
        outline:
          "border-lingot-lime border-b-[#8ed459] bg-white text-[#438f0e] hover:bg-[#f7fff1] active:border-b-lingot-lime",
        blue: "border-macaw-blue border-b-[#168bc2] bg-macaw-blue text-white hover:bg-[#16a5e8] active:border-b-macaw-blue",
        secondary:
          "border-[#d9d9d9] border-b-[#bdbdbd] bg-white text-charcoal hover:bg-[#f7f7f7] active:border-b-[#d9d9d9]",
        ghost:
          "border-transparent bg-transparent text-ash hover:bg-[#f5f5f5] hover:text-charcoal",
        danger:
          "border-[#ff6b6b] border-b-[#d94e4e] bg-[#ff6b6b] text-white hover:bg-[#f25f5f] active:border-b-[#ff6b6b]",
      },
      size: {
        default: "h-12",
        sm: "h-10 min-h-10 px-4 text-[13px]",
        lg: "h-14 px-7 text-[16px]",
        icon: "size-11 min-h-11 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  ),
);
Button.displayName = "Button";

export { Button, buttonVariants };
