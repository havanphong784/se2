import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-flex size-10 items-center justify-center", className)}
    >
      <svg viewBox="0 0 48 48" className="size-full" fill="none">
        <path
          d="M24 19.5c-6.4 0-11.5-3.9-11.5-8.7C12.5 5.9 17.6 2 24 2s11.5 3.9 11.5 8.8c0 4.8-5.1 8.7-11.5 8.7Z"
          fill="#A5ED6E"
          stroke="#438F0E"
          strokeWidth="2.5"
        />
        <path
          d="M19.1 21.8c-5.4 3.4-11.8 2.8-14.3-1.3-2.6-4.1-.3-10.1 5.1-13.5 5.4-3.3 11.8-2.8 14.3 1.3 2.6 4.1.3 10.2-5.1 13.5Z"
          fill="#58CC02"
          stroke="#438F0E"
          strokeWidth="2.5"
        />
        <path
          d="M28.9 21.8c5.4 3.4 11.8 2.8 14.3-1.3 2.6-4.1.3-10.1-5.1-13.5-5.4-3.3-11.8-2.8-14.3 1.3-2.6 4.1-.3 10.2 5.1 13.5Z"
          fill="#58CC02"
          stroke="#438F0E"
          strokeWidth="2.5"
        />
        <rect
          x="11"
          y="17"
          width="26"
          height="26"
          rx="12"
          fill="#58CC02"
          stroke="#438F0E"
          strokeWidth="2.5"
        />
        <circle cx="19" cy="29" r="2.1" fill="#042C60" />
        <circle cx="29" cy="29" r="2.1" fill="#042C60" />
        <path
          d="M19.5 35c2.8 2.2 6.2 2.2 9 0"
          stroke="#042C60"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

export function BrandName({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <BrandMark className={compact ? "size-8" : undefined} />
      {!compact && (
        <span className="font-display text-[26px] font-extrabold leading-none text-ecto-green">
          VocaBloom
        </span>
      )}
    </span>
  );
}
