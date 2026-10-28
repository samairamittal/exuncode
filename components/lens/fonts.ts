import { JetBrains_Mono, Silkscreen } from "next/font/google";

// Monospace for every Lens readout (lens1 sets the page in mono); Silkscreen only for the
// pixel titles ("Scan", the case file title).
export const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-lens-mono" });
export const pixel = Silkscreen({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-lens-pixel" });
