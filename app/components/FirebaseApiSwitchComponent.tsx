// components/FirebaseApiSwitchComponent.tsx

"use client";

import React, { useState } from "react";
import QRCode from "react-qr-code";
import { useFirebase } from "../contexts/FirebaseContext";

declare global {
  interface Window {
    setFirebaseSettings?: (enabled: boolean, captionName: string) => void;
  }
}

// Simple QR Code Icon Component
function QRCodeIcon({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="3" y="3" width="5" height="5" />
      <rect x="16" y="3" width="5" height="5" />
      <rect x="3" y="16" width="5" height="5" />
      <path d="M21 16h-3a2 2 0 0 0-2 2v3" />
      <path d="M21 21v.01" />
      <path d="M12 7v3a2 2 0 0 1-2 2H7" />
      <path d="M3 12h.01" />
      <path d="M12 3h.01" />
      <path d="M12 16v.01" />
      <path d="M16 12h.01" />
      <path d="M21 12v.01" />
      <path d="M12 21v-3a2 2 0 0 1 2-2h3" />
    </svg>
  );
}

// Simple Switch Component
function Switch({
  isSelected,
  onChange,
  classNames,
  children,
  style,
}: {
  isSelected: boolean;
  onChange: (e: { target: { checked: boolean } }) => void;
  classNames?: {
    base?: string;
    wrapper?: string;
    thumb?: string;
  };
  children?: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <label
      className={`inline-flex flex-row-reverse w-full max-w-md bg-gray-900 hover:bg-gray-800 hover:border-dashed items-center justify-between cursor-pointer rounded-lg gap-2 p-4 border-2 border-gray-900 data-[selected=true]:border-white data-[selected=true]:bg-gray-700 ${
        isSelected ? "border-white bg-gray-700" : ""
      } ${classNames?.base || ""}`}
      style={style}
    >
      <input
        type="checkbox"
        checked={isSelected}
        onChange={(e) => onChange({ target: { checked: e.target.checked } })}
        className="sr-only"
      />
      <div
        className={`relative inline-flex h-4 w-10 items-center rounded-full transition-colors ${
          isSelected ? "bg-blue-600" : "bg-gray-600"
        } ${classNames?.wrapper || ""}`}
      >
        <span
          className={`inline-block h-6 w-6 transform rounded-full bg-white border-2 shadow-lg transition-transform absolute ${
            isSelected
              ? "translate-x-4 border-white"
              : "translate-x-0 border-gray-400"
          } ${classNames?.thumb || ""}`}
        />
      </div>
      {children}
    </label>
  );
}

export default function FirebaseApiSwitchComponent() {
  const [showQRCode, setShowQRCode] = useState(false);
  const [copyMessage, setCopyMessage] = useState("");
  const [showTooltip, setShowTooltip] = useState(false);
  const [language] = useState<"en" | "et">("en");
  const { firebaseEnabled, captionURL, setFirebaseEnabled } = useFirebase();

  const translations = {
    en: {
      castCaptions: "Cast captions to multiple people",
      captionsWillBeSent:
        "Captions will be sent to multiple people who have the link.",
      yourLiveCaptions: "Your live captions are available at:",
      hideQRCode: "Hide QR Code",
      showQRCode: "Show QR Code",
      linkCopied: "Link copied to clipboard!",
      failedToCopy: "Failed to copy link",
      clickToCopy: "Click to copy the link",
    },
    et: {
      castCaptions: "Saada subtiitrid mitmele inimesele",
      captionsWillBeSent:
        "Subtiitrid saadetakse mitmele inimesele, kellel on link.",
      yourLiveCaptions: "Teie otse subtiitrid on saadaval aadressil:",
      hideQRCode: "Peida QR-kood",
      showQRCode: "Näita QR-koodi",
      linkCopied: "Link kopeeritud lõikelauale!",
      failedToCopy: "Lingi kopeerimine ebaõnnestus",
      clickToCopy: "Klõpsake lingi kopeerimiseks",
    },
  };

  const t =
    translations[language as keyof typeof translations] || translations.en;

  // Function to handle QR code click
  const handleQRCodeClick = () => {
    if (navigator.clipboard && window.isSecureContext) {
      // Use navigator.clipboard API
      navigator.clipboard.writeText(captionURL).then(
        () => {
          setCopyMessage(t.linkCopied);
          setTimeout(() => setCopyMessage(""), 2000);
        },
        () => {
          setCopyMessage(t.failedToCopy);
          setTimeout(() => setCopyMessage(""), 2000);
        }
      );
    } else {
      // Fallback method using a temporary textarea
      const textArea = document.createElement("textarea");
      textArea.value = captionURL;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      textArea.style.top = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand("copy");
        setCopyMessage(t.linkCopied);
      } catch {
        setCopyMessage(t.failedToCopy);
      } finally {
        textArea.remove();
        setTimeout(() => setCopyMessage(""), 2000);
      }
    }
  };

  // Functions to handle tooltip visibility for non-touch devices
  const handleQRCodeMouseEnter = () => {
    setShowTooltip(true);
  };

  const handleQRCodeMouseLeave = () => {
    setShowTooltip(false);
  };

  return (
    <div className="flex flex-col gap-2">
      <Switch
        style={{ touchAction: "pan-y" }}
        isSelected={firebaseEnabled}
        onChange={(e) => setFirebaseEnabled(e.target.checked)}
        classNames={{
          base: "inline-flex flex-row-reverse w-full max-w-md bg-gray-900 hover:bg-gray-800 hover:border-dashed items-center justify-between cursor-pointer rounded-lg gap-2 p-4 border-2 border-gray-900",
          wrapper: "p-0 h-4 overflow-visible",
          thumb: "w-6 h-6 border-2 shadow-lg",
        }}
      >
        <div className="flex flex-col gap-1">
          <p className="text-medium text-white">{t.castCaptions}</p>
          <p className="text-tiny text-white">{t.captionsWillBeSent}</p>
        </div>
      </Switch>
      {captionURL && (
        <div className="flex flex-col mt-1 gap-2 bg-gray-900 rounded-lg p-3">
          <p className="text-white">{t.yourLiveCaptions}</p>
          <a
            href={captionURL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 break-all"
          >
            {captionURL}
          </a>
          <div className="mt-2">
            <button
              onClick={() => setShowQRCode(!showQRCode)}
              className="text-white hover:text-blue-500 flex items-center"
            >
              <QRCodeIcon className="mr-2" />
              {showQRCode ? t.hideQRCode : t.showQRCode}
            </button>
          </div>
          {showQRCode && (
            <div
              className="mt-2 flex flex-col items-center bg-white p-2 rounded cursor-pointer relative"
              style={{ touchAction: "pan-y" }}
              onClick={handleQRCodeClick}
              onMouseEnter={handleQRCodeMouseEnter}
              onMouseLeave={handleQRCodeMouseLeave}
            >
              {showTooltip && (
                <div className="absolute bottom-full mb-2 text-sm bg-black text-white py-1 px-2 rounded-md hidden md:block">
                  {copyMessage ? t.linkCopied : t.clickToCopy}
                </div>
              )}
              <QRCode value={captionURL} size={180} />
              {copyMessage && (
                <div className="absolute bottom-full mb-2 bg-black text-green-500 py-1 px-2 rounded-md text-sm">
                  {copyMessage}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
