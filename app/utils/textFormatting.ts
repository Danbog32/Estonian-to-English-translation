/**
 * Formats text to ensure proper spacing and punctuation
 * @param text - The text to format
 * @returns Formatted text with normalized spacing
 */
export function formatText(text: string): string {
  if (!text) return text;

  return (
    text
      // Remove extra spaces around punctuation
      .replace(/\s+([.,!?;:])/g, "$1")
      // Ensure space after punctuation (except at end of string)
      .replace(/([.,!?;:])(?!\s|$)/g, "$1 ")
      // Normalize multiple spaces to single space
      .replace(/\s+/g, " ")
      // Trim leading/trailing whitespace
      .trim()
  );
}

/**
 * Formats text for display with proper sentence spacing
 * @param text - The text to format
 * @returns Formatted text with proper sentence spacing
 */
export function formatTextForDisplay(text: string): string {
  if (!text) return text;

  return (
    text
      // Remove extra spaces around punctuation
      .replace(/\s+([.,!?;:])/g, "$1")
      // Ensure space after punctuation (except at end of string)
      .replace(/([.,!?;:])(?!\s|$)/g, "$1 ")
      // Normalize multiple spaces to single space
      .replace(/\s+/g, " ")
      // Ensure proper sentence spacing (space after period/question/exclamation)
      .replace(/([.!?])\s*([A-Z])/g, "$1 $2")
      // Trim leading/trailing whitespace
      .trim()
  );
}
