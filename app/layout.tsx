import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Estonian to English Translator | Real-time Speech Translation",
    template: "%s | Estonian to English Translator",
  },
  description:
    "Professional real-time Estonian to English translation with speech recognition. Instant voice-to-text translation for conversations, meetings, and learning. Powered by advanced AI technology.",
  keywords: [
    "Estonian to English",
    "translation",
    "speech recognition",
    "real-time translation",
    "voice translator",
    "Estonian language",
    "English translation",
    "AI translator",
    "speech to text",
    "simultaneous interpretation",
    "language learning",
    "Estonia",
  ],
  authors: [{ name: "Estonian to English Translator" }],
  creator: "Estonian to English Translator",
  publisher: "Estonian to English Translator",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL("https://est2eng.vercel.app"),
  alternates: {
    canonical: "/",
    languages: {
      "en-US": "/en",
      "et-EE": "/et",
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://estonian-to-english-translation.vercel.app",
    siteName: "Estonian to English Translator",
    title: "Estonian to English Translator | Real-time Speech Translation",
    description:
      "Professional real-time Estonian to English translation with speech recognition. Instant voice-to-text translation for conversations, meetings, and learning.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Estonian to English Translator - Real-time Speech Translation",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Estonian to English Translator | Real-time Speech Translation",
    description:
      "Professional real-time Estonian to English translation with speech recognition. Instant voice-to-text translation for conversations, meetings, and learning.",
    images: ["/og-image.png"],
    creator: "@estonian_translator",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: "your-google-verification-code",
    yandex: "your-yandex-verification-code",
  },
  category: "technology",
  classification: "Translation Tool",
  other: {
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "default",
    "apple-mobile-web-app-title": "Estonian Translator",
    "application-name": "Estonian to English Translator",
    "msapplication-TileColor": "#000000",
    "theme-color": "#000000",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <Analytics />
      </body>
    </html>
  );
}
