import { useEffect, useRef, useCallback, useState } from "react";

interface UseAutoScrollOptions {
  /**
   * The content that triggers autoscroll when changed
   */
  content: string | number;
  /**
   * Threshold in pixels from bottom to consider "at bottom"
   * Default: 50
   */
  threshold?: number;
  /**
   * Whether autoscroll is enabled
   * Default: true
   */
  enabled?: boolean;
}

/**
 * A robust autoscroll hook that automatically scrolls to bottom when content changes,
 * but allows users to scroll up and read without interruption.
 *
 * @returns Object containing scrollRef, isScrolledUp state, and scrollToBottom function
 */
export function useAutoScroll<T extends HTMLElement>({
  content,
  threshold = 50,
  enabled = true,
}: UseAutoScrollOptions) {
  const scrollRef = useRef<T | null>(null);
  const isUserScrollingRef = useRef(false);
  const userScrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const shouldAutoScrollRef = useRef(true);
  const [isScrolledUp, setIsScrolledUp] = useState(false);

  /**
   * Check if the element is scrolled near the bottom
   */
  const isNearBottom = useCallback(
    (element: HTMLElement): boolean => {
      const { scrollTop, scrollHeight, clientHeight } = element;
      return scrollHeight - scrollTop - clientHeight < threshold;
    },
    [threshold]
  );

  /**
   * Scroll to bottom smoothly
   */
  const scrollToBottom = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;

    element.scrollTo({
      top: element.scrollHeight,
      behavior: "smooth",
    });
  }, []);

  /**
   * Handle scroll events to detect user interaction
   */
  const handleScroll = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;

    // Clear existing timeout
    if (userScrollTimeoutRef.current) {
      clearTimeout(userScrollTimeoutRef.current);
    }

    // Mark as user scrolling
    isUserScrollingRef.current = true;

    // Check if user scrolled back to bottom
    const nearBottom = isNearBottom(element);
    if (nearBottom) {
      shouldAutoScrollRef.current = true;
      setIsScrolledUp(false);
    } else {
      shouldAutoScrollRef.current = false;
      setIsScrolledUp(true);
    }

    // Debounce: consider user done scrolling after 150ms of no scroll events
    userScrollTimeoutRef.current = setTimeout(() => {
      isUserScrollingRef.current = false;
    }, 150);
  }, [isNearBottom]);

  /**
   * Effect to handle autoscrolling when content changes
   */
  useEffect(() => {
    if (!enabled) return;

    const element = scrollRef.current;
    if (!element) return;

    // Only autoscroll if:
    // 1. User is not actively scrolling
    // 2. User is near the bottom (or explicitly wants to autoscroll)
    if (!isUserScrollingRef.current && shouldAutoScrollRef.current) {
      scrollToBottom();
    }
  }, [content, enabled, scrollToBottom]);

  /**
   * Set up scroll event listener
   */
  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    element.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      element.removeEventListener("scroll", handleScroll);
      if (userScrollTimeoutRef.current) {
        clearTimeout(userScrollTimeoutRef.current);
      }
    };
  }, [handleScroll]);

  /**
   * Initialize: assume we want to autoscroll at start
   */
  useEffect(() => {
    shouldAutoScrollRef.current = true;
  }, []);

  return {
    scrollRef,
    isScrolledUp,
    scrollToBottom,
  };
}
