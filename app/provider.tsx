"use client";

import { HeroUIProvider } from "@heroui/system";
import { FirebaseProvider } from "./contexts/FirebaseContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <HeroUIProvider>
      <FirebaseProvider>{children}</FirebaseProvider>
    </HeroUIProvider>
  );
}
