import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Meet",
  description: "Private 1-on-1 WebRTC video rooms",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
