import type { Metadata } from "next";
import "./globals.css";

export async function generateMetadata({
  searchParams = {},
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
} = {}): Promise<Metadata> {
  // Clean up the label parameter by removing any URL parameters that might have been incorrectly appended
  const rawLabel = searchParams?.label?.toString() || "";
  const label = rawLabel.split("?")[0]; // Take only the part before any additional '?'

  const title = label
    ? `${label} | Ship Tracker`
    : "Ship Tracker | GitHub Leaderboard";

  return {
    title,
    description: "See who is really shipping.",
  };
}

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
