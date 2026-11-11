import { ImageResponse } from "next/og";
import sharp from "sharp";
import { SITE_NAME } from "./trips";
import { SHARE_CARD_SIZE, SHARE_CARD_CONTENT_TYPE, loadShareCardFonts } from "./shareCard";

const ACCENT = "#1f6f6b";

// The motorhome mark from icon.svg, in white for the dark photo overlay.
// Inlined as a data URI because Satori draws <img> more reliably than
// inline <svg> with strokes.
const MARK = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 18H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h18a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-4l3 4h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1"/><path d="M9 18h6"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/><rect x="5" y="7" width="5" height="4" rx="1"/></svg>`
)}`;

// Long trip names step down a size so they stay on two lines at most
function titleSize(title) {
  if (title.length > 40) return 60;
  if (title.length > 24) return 72;
  return 84;
}

// A 1200x630 card: the cover photo full-bleed under a dark gradient, with
// the site mark, the title in the site's serif, and one line of facts.
// Without a photo it's drawn on the accent colour instead.
//
// ImageResponse only makes PNGs, and a photo card comes out around 1.5MB:
// too big for some apps (WhatsApp skips preview images much over ~300KB).
// So the PNG is re-encoded as a JPEG of about a tenth of the size. Reading
// the whole PNG first also means a drawing error fails the request cleanly
// instead of partway through streaming it.
export async function renderShareCard(card) {
  // Without the fonts the card still draws, in Satori's built-in font
  const fonts = await loadShareCardFonts().catch(() => undefined);
  const png = Buffer.from(await drawCard({ ...card, fonts }).arrayBuffer());
  const jpeg = await sharp(png).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  return new Response(new Uint8Array(jpeg), {
    headers: {
      "Content-Type": SHARE_CARD_CONTENT_TYPE,
      // Apps cache previews on their side anyway; this just stops a burst of
      // crawler requests from redrawing the card each time
      "Cache-Control": "public, max-age=3600",
    },
  });
}

function drawCard({ title, subtitle, photo, fonts }) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          backgroundColor: ACCENT,
          fontFamily: "Geist",
        }}
      >
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- rendered to PNG by Satori, not a page
          <img src={photo} width={SHARE_CARD_SIZE.width} height={SHARE_CARD_SIZE.height} style={{ position: "absolute", top: 0, left: 0 }} />
        )}
        <div
          style={{
            // Edges spelled out: Satori ignores `inset`
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            display: "flex",
            flexDirection: "column",
            // Text at the bottom, under the gradient, when there's a photo;
            // centred on the plain accent card when there isn't
            justifyContent: photo ? "flex-end" : "center",
            padding: "56px 64px",
            color: "#ffffff",
            // Strong at the bottom where the text sits, and clear from just
            // above it, so faces in the middle of the photo aren't dimmed.
            // Left out entirely without a photo: Satori throws on
            // backgroundImage "none".
            ...(photo && {
              backgroundImage: "linear-gradient(to top, rgba(12,20,22,0.9) 0%, rgba(12,20,22,0.6) 30%, rgba(12,20,22,0) 58%)",
            }),
          }}
        >
          {/* The site label, unless the title already is the site name */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 26, fontWeight: 600, opacity: 0.92 }}>
            {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- see above */}
            <img src={MARK} width={34} height={34} />
            {title === SITE_NAME ? null : SITE_NAME}
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 18,
              fontFamily: "Newsreader",
              fontWeight: 600,
              fontSize: titleSize(title),
              lineHeight: 1.05,
              letterSpacing: "-0.01em",
            }}
          >
            {title}
          </div>
          {subtitle && (
            <div style={{ display: "flex", marginTop: 20, fontSize: 32, opacity: 0.9 }}>{subtitle}</div>
          )}
        </div>
      </div>
    ),
    { ...SHARE_CARD_SIZE, fonts }
  );
}
