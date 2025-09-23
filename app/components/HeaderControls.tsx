"use client";

import { memo } from "react";

type ViewMode = "left" | "split" | "right";

type HeaderControlsProps = {
  side: "left" | "right";
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
  className?: string;
};

function HeaderControlsBase({
  side,
  mode,
  onChange,
  className = "",
}: HeaderControlsProps) {
  const isSplit = mode === "split";
  const soloTarget: ViewMode = side === "left" ? "left" : "right";

  const buttonBase =
    "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-white/60 hover:text-white hover:bg-white/10 active:bg-white/15 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 cursor-pointer";

  return isSplit ? (
    <button
      type="button"
      className={`${buttonBase} ${className}`}
      onClick={() => onChange(soloTarget)}
      aria-label={side === "left" ? "Show Estonian only" : "Show English only"}
      title={side === "left" ? "Show Estonian only" : "Show English only"}
    >
      <span className="tracking-widest uppercase text-[10px] sm:text-xs text-white/40">
        {side === "left" ? "Estonian" : "English"}
      </span>
      {side === "left" ? (
        <svg width="16" height="16" viewBox="0 0 24 24" className="opacity-90">
          <rect
            x="3"
            y="4"
            width="8"
            height="16"
            rx="2"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <rect
            x="13"
            y="4"
            width="8"
            height="16"
            rx="2"
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.35"
            strokeWidth="1.5"
          />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" className="opacity-90">
          <rect
            x="13"
            y="4"
            width="8"
            height="16"
            rx="2"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <rect
            x="3"
            y="4"
            width="8"
            height="16"
            rx="2"
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.35"
            strokeWidth="1.5"
          />
        </svg>
      )}
    </button>
  ) : (
    <button
      type="button"
      className={`${buttonBase} ${className}`}
      onClick={() => onChange("split")}
      aria-label="Return to split view"
      title="Return to split view"
    >
      <span className="tracking-widest uppercase text-[10px] sm:text-xs text-current">
        {side === "left" ? "Estonian" : "English"}
      </span>
      <svg width="16" height="16" viewBox="0 0 24 24">
        <rect
          x="3"
          y="4"
          width="8"
          height="16"
          rx="2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <rect
          x="13"
          y="4"
          width="8"
          height="16"
          rx="2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <rect
          x="11.5"
          y="4"
          width="1"
          height="16"
          className="fill-current"
          opacity="0.6"
        />
      </svg>
    </button>
  );
}

const HeaderControls = memo(HeaderControlsBase);
export default HeaderControls;
