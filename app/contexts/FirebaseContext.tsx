"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";

interface FirebaseContextType {
  firebaseEnabled: boolean;
  captionName: string;
  captionURL: string;
  setFirebaseEnabled: (enabled: boolean) => void;
  generateCaptionName: () => string;
}

const FirebaseContext = createContext<FirebaseContextType | undefined>(
  undefined
);

export function FirebaseProvider({ children }: { children: ReactNode }) {
  const [firebaseEnabled, setFirebaseEnabledState] = useState(false);
  const [captionName, setCaptionName] = useState<string>("");
  const [captionURL, setCaptionURL] = useState<string>("");

  const generateCaptionName = useCallback(() => {
    const uniqueId = `caption-${Date.now()}-${Math.floor(
      Math.random() * 10000
    )}`;
    return uniqueId;
  }, []);

  const setFirebaseEnabled = useCallback(
    (enabled: boolean) => {
      setFirebaseEnabledState(enabled);
      if (enabled) {
        if (!captionName) {
          const name = generateCaptionName();
          setCaptionName(name);
          const url =
            typeof window !== "undefined"
              ? `${window.location.origin}/${name}`
              : "";
          setCaptionURL(url);
          // Update Firebase settings for backward compatibility
          if (window.setFirebaseSettings) {
            window.setFirebaseSettings(enabled, name);
          }
        }
      } else {
        setCaptionName("");
        setCaptionURL("");
        // Update Firebase settings for backward compatibility
        if (window.setFirebaseSettings) {
          window.setFirebaseSettings(enabled, "");
        }
      }
    },
    [captionName, generateCaptionName]
  );

  return (
    <FirebaseContext.Provider
      value={{
        firebaseEnabled,
        captionName,
        captionURL,
        setFirebaseEnabled,
        generateCaptionName,
      }}
    >
      {children}
    </FirebaseContext.Provider>
  );
}

export function useFirebase() {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error("useFirebase must be used within a FirebaseProvider");
  }
  return context;
}

// Declare global window.setFirebaseSettings for backward compatibility
declare global {
  interface Window {
    setFirebaseSettings?: (enabled: boolean, captionName: string) => void;
  }
}
