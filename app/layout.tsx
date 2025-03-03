import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ship Tracker | GitHub Leaderboard",
  description: "See who is really shipping.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-serif antialiased">{children}</body>
    </html>
  );
}
