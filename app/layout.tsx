import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: "Dee's Scentry — Luxury Perfumes",
  description: "Shop authentic curated luxury perfumes from Dee's Scentry in Ghana."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
