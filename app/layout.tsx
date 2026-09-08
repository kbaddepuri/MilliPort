import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MilliPort — Portfolio Growth Engine",
  description: "Data-driven portfolio intelligence for the $30K mission and beyond.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
