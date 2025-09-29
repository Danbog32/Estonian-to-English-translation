import { useMemo } from "react";

interface WordDisplayProps {
  words: string[];
  revealActiveIndex: number | null;
  fadeStart: number;
  revealDelayMs: number;
  onWordRender?: (word: string, index: number) => void;
}

export default function WordDisplay({
  words,
  revealActiveIndex,
  fadeStart,
  revealDelayMs,
  onWordRender,
}: WordDisplayProps) {
  const wordsWithEffects = useMemo(() => {
    return words.map((word, idx) => {
      // Highlight logic
      let isHighlighted: boolean;
      if (revealActiveIndex !== null) {
        // During reveal: only the newest appeared word is emerald
        isHighlighted = idx === revealActiveIndex;
      } else {
        // Idle: the last two words remain emerald
        const lastTwoStart = Math.max(0, words.length - 2);
        isHighlighted = idx >= lastTwoStart;
      }

      const isFading = idx >= fadeStart;
      const delayMs = isFading ? (idx - fadeStart) * revealDelayMs : 0;

      return {
        word,
        idx,
        isHighlighted,
        isFading,
        delayMs,
      };
    });
  }, [words, revealActiveIndex, fadeStart, revealDelayMs]);

  return (
    <>
      {wordsWithEffects.map(
        ({ word, idx, isHighlighted, isFading, delayMs }) => {
          onWordRender?.(word, idx);

          return (
            <span
              key={idx}
              className={`${isHighlighted ? "text-emerald-400" : "text-white/90"} ${isFading ? "word-fade-in" : ""}`}
              style={isFading ? { animationDelay: `${delayMs}ms` } : undefined}
            >
              {/* Add leading space only for non-punctuation tokens and non-first tokens */}
              {idx > 0 && !/^[,.;:!?)}\]]/.test(word) ? " " : ""}
              {word}
            </span>
          );
        }
      )}
    </>
  );
}
