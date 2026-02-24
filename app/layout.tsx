import type { Metadata } from "next";
import { Outfit, DM_Sans } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Apple Music to Spotify Sync",
  description:
    "Seamlessly sync your Apple Music playlists to Spotify. Paste a link, connect your account, and sync your tracks.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${outfit.variable} ${dmSans.variable} antialiased bg-background text-foreground`}
      >
        {children}
      </body>
    </html>
  );
}
