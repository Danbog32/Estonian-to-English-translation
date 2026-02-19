"use client";

import { ReactNode } from "react";

export type StatusBannerTone = "success" | "warning" | "danger" | "neutral";
export type StatusBannerIcon =
  | "check"
  | "clock"
  | "alert"
  | "offline"
  | "cog"
  | "pause";

type StatusBannerProps = {
  title: string;
  hint?: string | null;
  detail?: string | null;
  tone?: StatusBannerTone;
  icon?: StatusBannerIcon;
  animatePulse?: boolean;
  action?: {
    label: string;
    onClick: () => void;
    ariaLabel?: string;
  };
  footer?: ReactNode;
};

const toneStyles: Record<
  StatusBannerTone,
  { dot: string; ring: string; iconColor: string }
> = {
  success: {
    dot: "bg-emerald-400",
    ring: "ring-emerald-400/30",
    iconColor: "text-emerald-400",
  },
  warning: {
    dot: "bg-amber-400",
    ring: "ring-amber-400/30",
    iconColor: "text-amber-300",
  },
  danger: {
    dot: "bg-rose-500",
    ring: "ring-rose-500/30",
    iconColor: "text-rose-400",
  },
  neutral: {
    dot: "bg-gray-400",
    ring: "ring-white/20",
    iconColor: "text-white/70",
  },
};

function BannerIcon({
  icon,
  toneColor,
}: {
  icon: StatusBannerIcon;
  toneColor: string;
}) {
  if (icon === "check") {
    return (
      <svg aria-hidden="true" viewBox="0 0 20 20" className={`h-4 w-4 ${toneColor}`}>
        <path
          fill="currentColor"
          d="M7.8 14.6 3.9 10.7l1.4-1.4 2.5 2.5 6.9-6.9 1.4 1.4z"
        />
      </svg>
    );
  }
  if (icon === "alert") {
    return (
      <svg aria-hidden="true" viewBox="0 0 20 20" className={`h-4 w-4 ${toneColor}`}>
        <path
          fill="currentColor"
          d="M10 2 1 18h18L10 2Zm1 12H9v2h2v-2Zm0-8H9v6h2V6Z"
        />
      </svg>
    );
  }
  if (icon === "offline") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className={`h-4 w-4 ${toneColor}`}>
        <path
          fill="currentColor"
          d="M2 8.8A15.9 15.9 0 0 1 12 5c3.6 0 7 1.2 9.7 3.3l-1.6 1.2A13.6 13.6 0 0 0 12 7c-3 0-5.9 1-8.2 2.7L2 8.8Zm3.6 2.7c1.8-1.2 3.9-1.9 6.4-1.9 2.4 0 4.7.7 6.5 1.9l-1.6 1.2a11 11 0 0 0-4.9-1.2c-1.8 0-3.5.4-4.9 1.2l-1.5-1.2Zm3.4 2.6c1-.5 2.1-.8 3.2-.8 1.2 0 2.3.3 3.3.8l-1.6 1.2c-.5-.2-1.1-.3-1.7-.3s-1.2.1-1.7.3L9 14.1Zm3 2.6c.6 0 1.1.5 1.1 1.1S12.6 19 12 19s-1.1-.5-1.1-1.1.5-1.2 1.1-1.2Z"
        />
      </svg>
    );
  }
  if (icon === "cog") {
    return (
      <svg aria-hidden="true" viewBox="0 0 20 20" className={`h-4 w-4 ${toneColor}`}>
        <path
          fill="currentColor"
          d="M8.7 1h2.6l.4 2.2 2 .9 2-1.2 1.8 1.8-1.2 2 .9 2 .2.4v2.6l-2.2.4-.9 2 1.2 2-1.8 1.8-2-1.2-2 .9-.4 2.2H8.7l-.4-2.2-2-.9-2 1.2L2.5 16l1.2-2-.9-2-.2-.4V8.7l2.2-.4.9-2-1.2-2L7 2.5l2 1.2 2-.9L8.7 1Zm1.3 5.3A3.7 3.7 0 1 0 14 10a3.7 3.7 0 0 0-4-3.7Z"
        />
      </svg>
    );
  }
  if (icon === "pause") {
    return (
      <svg aria-hidden="true" viewBox="0 0 20 20" className={`h-4 w-4 ${toneColor}`}>
        <path fill="currentColor" d="M6 4h3v12H6V4Zm5 0h3v12h-3V4Z" />
      </svg>
    );
  }
  if (icon === "clock") {
    return (
      <svg aria-hidden="true" viewBox="0 0 20 20" className={`h-4 w-4 ${toneColor}`}>
        <path
          fill="currentColor"
          d="M10 4.5a5.5 5.5 0 1 0 5.5 5.5h-1.8A3.7 3.7 0 1 1 10 6.3V4.5Zm-.9.4v5.8h5.8V8.9h-4V4.9H9.1Z"
        />
      </svg>
    );
  }
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className={`h-4 w-4 ${toneColor}`}>
      <circle cx="10" cy="10" r="4.5" fill="currentColor" />
    </svg>
  );
}

export default function StatusBanner({
  title,
  hint,
  detail,
  tone = "neutral",
  icon = "offline",
  animatePulse = true,
  action,
  footer,
}: StatusBannerProps) {
  const styles = toneStyles[tone];

  return (
    <div
      className={
        "flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-white shadow-xl backdrop-blur-md ring-1 " +
        styles.ring
      }
    >
      <span className="relative inline-flex h-3.5 w-3.5 items-center justify-center">
        {animatePulse && (
          <span
            className={`absolute inline-flex h-full w-full animate-ping rounded-full ${styles.dot} opacity-30`}
          />
        )}
        <span
          className={`relative inline-flex h-3.5 w-3.5 rounded-full ${styles.dot}`}
        />
      </span>
      <div className="flex min-w-0 w-[16rem] flex-col">
        <div className="flex items-center gap-2">
          <BannerIcon icon={icon} toneColor={styles.iconColor} />
          <span className="text-sm font-medium tracking-tight">{title}</span>
        </div>
        {hint && <span className="text-[11px] text-white/70">{hint}</span>}
        {detail && <span className="text-[10px] text-white/50">{detail}</span>}
        {footer}
      </div>
      {action && (
        <button
          className="ml-1 rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-white hover:bg-white/15 active:bg-white/10"
          onClick={action.onClick}
          aria-label={action.ariaLabel || action.label}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
