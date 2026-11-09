import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import "./globals.css";
import { SITE_NAME } from "@/lib/trips";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// The serif for trip names, stop titles and the stories. Mapped to
// Tailwind's font-serif in globals.css. A variable font, so one file covers
// the regular and semibold weights.
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
});

// Trip pages set their own title, which the template turns into
// "East Coast Trip · Cave Family Road Trips"
export const metadata = {
  title: { template: `%s · ${SITE_NAME}`, default: SITE_NAME },
  description: "Our family road trips, pinned on a map with photos and stories from every stop",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${newsreader.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
