"use client";

import { memo } from "react";
import {
  LeftFocusedViewIcon,
  RightFocusedViewIcon,
  SplitViewIcon,
} from "./ViewIcons";
import LangDropdown from "./LangDropdown";

type ViewMode = "left" | "split" | "right";
type TargetLanguage = "en" | "ru";

type HeaderControlsProps = {
  side: "left" | "right";
  label: string;
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
  currentLang?: TargetLanguage;
  onLanguageChange?: (lang: TargetLanguage) => void;
  className?: string;
  disabled?: boolean;
};

function HeaderControlsBase({
  side,
  label,
  mode,
  onChange,
  currentLang,
  onLanguageChange,
  className = "",
  disabled = false,
}: HeaderControlsProps) {
  const isSplit = mode === "split";
  const soloTarget: ViewMode = side === "left" ? "left" : "right";

  const buttonBase =
    "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-white/60 hover:text-white hover:bg-white/10 active:bg-white/15 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 cursor-pointer";

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      {/* Position button */}
      {isSplit ? (
        <button
          type="button"
          className={buttonBase}
          onClick={() => onChange(soloTarget)}
          aria-label={`Show ${label} only`}
          title={`Show ${label} only`}
        >
          <span className="tracking-widest uppercase text-[10px] sm:text-xs text-white/40">
            full view
          </span>
          {side === "left" ? <LeftFocusedViewIcon /> : <RightFocusedViewIcon />}
        </button>
      ) : (
        <button
          type="button"
          className={buttonBase}
          onClick={() => onChange("split")}
          aria-label="Return to split view"
          title="Return to split view"
        >
          <span className="tracking-widest uppercase text-[10px] sm:text-xs text-current">
            Split view
          </span>
          <SplitViewIcon />
        </button>
      )}

      {/* Language button - only show on right side */}
      {side === "right" && currentLang && onLanguageChange && (
        <LangDropdown
          currentLang={currentLang}
          onLanguageChange={onLanguageChange}
          disabled={disabled}
        />
      )}
    </div>
  );
}

const HeaderControls = memo(HeaderControlsBase);
export default HeaderControls;
