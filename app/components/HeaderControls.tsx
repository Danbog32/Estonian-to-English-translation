"use client";

import { memo } from "react";
import {
  LeftFocusedViewIcon,
  RightFocusedViewIcon,
  SplitViewIcon,
} from "./ViewIcons";
import LangDropdown from "./LangDropdown";
import FirebaseApiSwitchComponent, {
  type ObsConnectionSettings,
} from "./FirebaseApiSwitchComponent";
import { LanguageCode, SOURCE_LANGUAGES } from "../utils/languages";
import type { ObsStreamingStatus } from "../hooks/useObsCaptionPublisher";

type ViewMode = "left" | "split" | "right";

type HeaderControlsProps = {
  side: "left" | "right";
  label: string;
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
  currentLang?: LanguageCode;
  onLanguageChange?: (lang: LanguageCode) => void;
  sourceLang?: LanguageCode;
  onSourceLanguageChange?: (lang: LanguageCode) => void;
  className?: string;
  disabled?: boolean;
  // OBS props to pass to FirebaseApiSwitchComponent
  obsEnabled?: boolean;
  obsStatus?: ObsStreamingStatus;
  obsError?: string | null;
  obsSettings?: ObsConnectionSettings;
  onObsEnabledChange?: (enabled: boolean) => void;
  onObsSettingsChange?: (settings: ObsConnectionSettings) => void;
};

function HeaderControlsBase({
  side,
  label,
  mode,
  onChange,
  currentLang,
  onLanguageChange,
  sourceLang,
  onSourceLanguageChange,
  className = "",
  disabled = false,
  obsEnabled,
  obsStatus,
  obsError,
  obsSettings,
  onObsEnabledChange,
  onObsSettingsChange,
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
      {/* Source language dropdown (left side) */}
      {side === "left" && sourceLang && onSourceLanguageChange && (
        <LangDropdown
          currentLang={sourceLang}
          onLanguageChange={onSourceLanguageChange}
          disabled={disabled}
          availableLanguages={SOURCE_LANGUAGES}
        />
      )}
      {/* Target language dropdown (right side) */}
      {side === "right" && currentLang && onLanguageChange && (
        <LangDropdown
          currentLang={currentLang}
          onLanguageChange={onLanguageChange}
          disabled={disabled}
        />
      )}

      {side === "right" && (
        <FirebaseApiSwitchComponent
          obsEnabled={obsEnabled}
          obsStatus={obsStatus}
          obsError={obsError}
          obsSettings={obsSettings}
          onObsEnabledChange={onObsEnabledChange}
          onObsSettingsChange={onObsSettingsChange}
        />
      )}
    </div>
  );
}

const HeaderControls = memo(HeaderControlsBase);
export default HeaderControls;
