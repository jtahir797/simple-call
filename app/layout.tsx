import type { Metadata, Viewport } from "next";
import "@fontsource-variable/roboto";
import "./globals.css";

export const metadata: Metadata = {
  title: "Simple Call | Multi-agent client call copilot",
  description:
    "Verified answers, client psychology and live risk capture during client calls, with minutes, RAID and recap email after the call. SSI Agent-A-Thon 2026.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#262626" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
