import { useEffect, useRef } from "react";
import { db } from "../../firebaseConfig";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { useFirebase } from "../contexts/FirebaseContext";

const MAX_TEXT_SIZE = 1000000; // 1,000,000 bytes for safety

/**
 * Cleans text by removing extra whitespace and normalizing
 */
function cleanText(text: string): string {
  if (!text) return "";
  return text
    .replace(/\s+/g, " ")
    .replace(/\s+([.,!?;:])/g, "$1")
    .replace(/([.,!?;:])(?!\s|$)/g, "$1 ")
    .trim();
}

/**
 * Checks text size and returns empty string if limit exceeded
 */
function checkAndClearText(text: string): string {
  const blob = new Blob([text], { type: "text/plain" });
  const textSize = blob.size;
  if (textSize >= MAX_TEXT_SIZE) {
    console.warn(
      "Text size limit reached. Clearing text to prevent exceeding Firebase's limit."
    );
    return "";
  }
  return text;
}

/**
 * Hook to send captions to Firebase when translation updates
 * Only sends when new content is detected (similar to getNewCaptionText logic)
 */
export function useFirebaseCaptions(translation: string) {
  const { firebaseEnabled, captionName } = useFirebase();
  const lastSentTextRef = useRef<string>("");

  useEffect(() => {
    if (!firebaseEnabled || !captionName || !translation) {
      return;
    }

    // Clean the translation text
    const cleanedText = cleanText(translation);
    if (!cleanedText) {
      return;
    }

    // Check if text has changed (avoid sending duplicates)
    if (cleanedText === lastSentTextRef.current) {
      return;
    }

    // Check if there's new content compared to what we last sent
    // Similar to getNewCaptionText - only send if there's new text
    const hasNewContent =
      !lastSentTextRef.current ||
      cleanedText.length > lastSentTextRef.current.length ||
      !cleanedText.startsWith(lastSentTextRef.current);

    if (!hasNewContent) {
      return;
    }

    // Check text size
    const textToSend = checkAndClearText(cleanedText);
    if (!textToSend) {
      lastSentTextRef.current = "";
      return;
    }

    // Send to Firebase
    const sendCaption = async () => {
      try {
        await setDoc(
          doc(db, "captions", captionName),
          {
            text: textToSend,
            timestamp: serverTimestamp(),
          },
          { merge: true }
        );
        lastSentTextRef.current = cleanedText;
        console.log(`Caption sent to Firebase for ${captionName}`);
      } catch (error) {
        console.error("Failed to send caption to Firebase:", error);
      }
    };

    void sendCaption();
  }, [translation, firebaseEnabled, captionName]);
}
