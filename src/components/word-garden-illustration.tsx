import { cn } from "@/lib/utils";

export function WordGardenIllustration({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 260 210"
      className={cn("h-auto w-full", className)}
      fill="none"
    >
      <path
        d="M41 176h181"
        stroke="#D7FFB8"
        strokeWidth="8"
        strokeLinecap="round"
      />
      <path
        d="M115 152c-29-22-36-56-20-91 25 17 38 53 20 91Z"
        fill="#A5ED6E"
        stroke="#438F0E"
        strokeWidth="3"
      />
      <path
        d="M127 148c5-36 28-60 66-66 0 38-25 65-66 66Z"
        fill="#58CC02"
        stroke="#438F0E"
        strokeWidth="3"
      />
      <path
        d="M121 154c0-29 5-50 23-71M119 151c-4-27-10-43-21-62"
        stroke="#438F0E"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M76 144h95l-10 45H86l-10-45Z"
        fill="#1CB0F6"
        stroke="#087DB4"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d="M90 144h67v-13c0-8-7-15-15-15h-37c-8 0-15 7-15 15v13Z"
        fill="white"
        stroke="#042C60"
        strokeWidth="3"
      />
      <circle cx="108" cy="132" r="3" fill="#042C60" />
      <circle cx="138" cy="132" r="3" fill="#042C60" />
      <path
        d="M114 137c6 5 13 5 18 0"
        stroke="#042C60"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M50 73h44a12 12 0 0 1 12 12v7H62a12 12 0 0 1-12-12v-7Z"
        fill="white"
        stroke="#1CB0F6"
        strokeWidth="3"
      />
      <path
        d="M59 84h28"
        stroke="#1CB0F6"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M169 37h39a10 10 0 0 1 10 10v9h-39a10 10 0 0 1-10-10v-9Z"
        fill="white"
        stroke="#A5ED6E"
        strokeWidth="3"
      />
      <path
        d="M178 48h24"
        stroke="#438F0E"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="46" cy="121" r="7" fill="#D7FFB8" />
      <circle cx="217" cy="109" r="7" fill="#BFE9FD" />
      <path d="m40 42 3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7Z" fill="#58CC02" />
    </svg>
  );
}
