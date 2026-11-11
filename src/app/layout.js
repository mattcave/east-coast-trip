import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import "./globals.css";
import { SITE_NAME, SITE_DESCRIPTION, SITE_URL, BASE_OPEN_GRAPH } from "@/lib/trips";

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
// The preview image comes from opengraph-image.js beside this file (and
// per trip from (map)/trips/[id]/opengraph-image.js).
export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: { template: `%s · ${SITE_NAME}`, default: SITE_NAME },
  description: SITE_DESCRIPTION,
  openGraph: { ...BASE_OPEN_GRAPH, title: SITE_NAME, description: SITE_DESCRIPTION, url: "/" },
  // X and others read the Open Graph image; this asks for the large layout
  twitter: { card: "summary_large_image" },
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
