"use client";

import { HeroUIProvider } from "@heroui/system";
import { FirebaseProvider } from "./contexts/FirebaseContext";
import { TurnstileProvider } from "./contexts/TurnstileContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <HeroUIProvider>
      <TurnstileProvider>
        <FirebaseProvider>{children}</FirebaseProvider>
      </TurnstileProvider>
    </HeroUIProvider>
  );
}
