"use client";

import { ReactNode, useCallback, useEffect, useRef, useState } from "react";

type ResizableSplitProps = {
  left: ReactNode;
  right: ReactNode;
  initialLeftFraction?: number; // 0..1
  minLeftPx?: number;
  minRightPx?: number;
  gutterWidth?: number; // px
  className?: string;
  viewMode?: "left" | "split" | "right";
  onViewModeChange?: (mode: "left" | "split" | "right") => void;
};

export default function ResizableSplit({
  left,
  right,
  initialLeftFraction = 0.5,
  minLeftPx = 260,
  minRightPx = 260,
  gutterWidth = 10,
  className = "",
  viewMode: externalViewMode,
  onViewModeChange,
}: ResizableSplitProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [leftFraction, setLeftFraction] = useState(() => {
    if (initialLeftFraction < 0.05) return 0.05;
    if (initialLeftFraction > 0.95) return 0.95;
    return initialLeftFraction;
  });
  const isDraggingRef = useRef(false);
  const [internalViewMode, setInternalViewMode] = useState<
    "left" | "split" | "right"
  >("split");
  const lastSplitFractionRef = useRef(leftFraction);

  // Use external view mode if provided, otherwise use internal state
  const viewMode = externalViewMode ?? internalViewMode;
  const _setViewMode = onViewModeChange ?? setInternalViewMode;

  const onDrag = useCallback(
    (clientX: number) => {
      const container = containerRef.current;
      if (!container) return;
      const bounds = container.getBoundingClientRect();
      const total = bounds.width;
      const rawLeft = clientX - bounds.left;
      const clampedLeft = Math.max(
        minLeftPx,
        Math.min(total - minRightPx, rawLeft)
      );
      const frac = total > 0 ? clampedLeft / total : 0.5;
      setLeftFraction(Math.max(0.05, Math.min(0.95, frac)));
    },
    [minLeftPx, minRightPx]
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      onDrag(e.clientX);
    };
    const handleMouseUp = () => {
      isDraggingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    const handleTouchMove = (e: TouchEvent) => {
      if (!isDraggingRef.current) return;
      if (e.touches[0]) onDrag(e.touches[0].clientX);
    };
    const handleTouchEnd = () => {
      isDraggingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [onDrag]);

  const startDrag = useCallback(
    (clientX?: number) => {
      isDraggingRef.current = true;
      if (typeof clientX === "number") onDrag(clientX);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [onDrag]
  );

  const prevModeRef = useRef(viewMode);
  useEffect(() => {
    const prev = prevModeRef.current;
    if (prev !== viewMode) {
      if (prev === "split" && viewMode !== "split") {
        lastSplitFractionRef.current = leftFraction;
      } else if (prev !== "split" && viewMode === "split") {
        const next = lastSplitFractionRef.current;
        setLeftFraction(Math.max(0.05, Math.min(0.95, next)));
      }
      prevModeRef.current = viewMode;
    }
  }, [viewMode, leftFraction]);

  const isSplit = viewMode === "split";
  const showLeft = viewMode !== "right";
  const showRight = viewMode !== "left";

  const leftStyle = isSplit
    ? ({ flexBasis: `${leftFraction * 100}%` } as const)
    : ({} as const);
  const gutterStyle = { width: `${gutterWidth}px` } as const;

  return (
    <div
      ref={containerRef}
      className={`relative flex flex-col md:flex-row w-full h-full ${className}`}
    >
      {/* On mobile, only show one panel at a time */}
      {showLeft && (
        <div
          className={`relative flex h-full ${isSplit ? "md:block" : "flex-1"} ${isSplit && showRight ? "hidden md:flex" : ""}`}
          style={leftStyle}
        >
          <div className="flex-1 min-w-0 h-full overflow-hidden">{left}</div>
        </div>
      )}

      {/* Gutter / Handle - only in split mode on md+ horizontal layout */}
      {isSplit && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize panels"
          className="hidden md:block relative select-none"
          style={gutterStyle}
          onMouseDown={(e) => startDrag(e.clientX)}
          onTouchStart={(e) => startDrag(e.touches[0]?.clientX)}
        >
          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-white/10" />
          <div className="absolute inset-y-0 left-0 right-0 cursor-col-resize hover:bg-white/5 active:bg-white/10" />
          <div className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 h-8 w-1.5 rounded-full bg-white/30 cursor-col-resize" />
        </div>
      )}

      {/* On mobile, only show one panel at a time */}
      {showRight && (
        <div
          className={`flex-1 min-w-0 flex h-full ${isSplit && showLeft ? "hidden md:flex" : ""}`}
        >
          <div className="flex-1 min-w-0 h-full overflow-hidden">{right}</div>
        </div>
      )}
    </div>
  );
}
