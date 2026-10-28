import type { Metadata } from "next";
import { HandsFree } from "@/components/handsfree/HandsFree";
import { Nav } from "@/components/layout/Nav";
import { PageTransition } from "@/components/layout/PageTransition";
import { StoreHydrator } from "@/components/layout/StoreHydrator";
import "./globals.css";

export const metadata: Metadata = {
  title: "EXUN Investigator Portal",
  description: "Case 10E24X10 — Extradigital Exceptions and Unknowns Network",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        <StoreHydrator />
        <PageTransition>
          <Nav />
          <main>{children}</main>
          <HandsFree />
        </PageTransition>
      </body>
    </html>
  );
}
