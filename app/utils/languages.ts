// Language configuration for source and target languages
export const LANGUAGES = {
  et: {
    code: "et",
    label: "Estonian",
  },
  en: {
    code: "en",
    label: "English",
  },
  ua: {
    code: "ua",
    label: "Ukrainian",
  },
  ru: {
    code: "ru",
    label: "Russian",
  },
} as const;

export type LanguageCode = keyof typeof LANGUAGES;

// Languages that can be used as source languages
export const SOURCE_LANGUAGES: LanguageCode[] = ["et", "en"];

// Generate dynamic system prompt based on source and target languages
export function generateSystemPrompt(
  sourceLang: LanguageCode,
  targetLang: LanguageCode
): string {
  const sourceLabel = LANGUAGES[sourceLang].label;
  const targetLabel = LANGUAGES[targetLang].label;

  return `You are a professional ${sourceLabel}-to-${targetLabel} simultaneous interpreter. Translate the following conversations into ${targetLabel}`;
}

// Generate placeholder text for target language
export function generatePlaceholder(targetLang: LanguageCode): string {
  const targetLabel = LANGUAGES[targetLang].label;
  return `${targetLabel} translation will appear here…`;
}
