import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import PWASetup from "@/components/ui/PWASetup";

const display = localFont({
  src: "../public/fonts/BricolageGrotesque.ttf",
  variable: "--font-display",
  display: "swap",
});
const body = localFont({
  src: "../public/fonts/InstrumentSans.ttf",
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Adventure Quest",
  description: "Turn events into shared, collectible memories.",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Adventure Quest" },
};

export const viewport: Viewport = {
  themeColor: "#14291F",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>
        <PWASetup />
        {children}
      </body>
    </html>
  );
}
