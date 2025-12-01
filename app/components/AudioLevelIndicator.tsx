"use client";

interface AudioLevelIndicatorProps {
  level: number; // 0-1 range
  className?: string;
}

/**
 * Minimalistic audio level indicator with animated vertical bars.
 * Shows real-time microphone input levels during recording.
 */
export function AudioLevelIndicator({
  level,
  className = "",
}: AudioLevelIndicatorProps) {
  // Normalize level to ensure it's within 0-1 range
  const normalizedLevel = Math.max(0, Math.min(1, level));

  // Create 4 bars with different heights based on the audio level
  // Each bar gets a different portion of the total level for a wave effect
  const bars = [
    normalizedLevel * 0.85 + 0.10, // Bar 1: 10-95%
    normalizedLevel * 0.90 + 0.05, // Bar 2: 5-95% (most responsive)
    normalizedLevel * 0.85 + 0.10, // Bar 3: 10-95%
    normalizedLevel * 0.80 + 0.15, // Bar 4: 15-95%
  ];

  return (
    <div
      className={`flex items-center gap-[3px] h-5 ${className}`}
      role="meter"
      aria-label="Audio input level"
      aria-valuenow={Math.round(normalizedLevel * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      {bars.map((barLevel, index) => (
        <div
          key={index}
          className="relative w-[3px] h-full flex items-center justify-center"
        >
          <div
            className="w-full rounded-full bg-emerald-400 transition-all duration-50 ease-out origin-center"
            style={{
              height: `${barLevel * 100}%`,
              opacity: 0.4 + barLevel * 0.6, // 40-100% opacity for better visibility
              boxShadow:
                barLevel > 0.5
                  ? `0 0 6px rgba(52, 211, 153, ${barLevel * 0.8})`
                  : "none",
            }}
          />
        </div>
      ))}
    </div>
  );
}

