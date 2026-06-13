/* eslint-disable @next/next/no-img-element */
import { ImageResponse } from "next/og";
import { source } from "@/lib/source";
import { NextRequest } from "next/server";
import { notFound } from "next/navigation";
import { ogLanguageBlacklist } from "@/lib/i18n";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ lang: string; slug?: string[] }> },
) {
  const { lang, slug = [] } = await params;

  if (ogLanguageBlacklist.includes(lang)) {
    return notFound();
  }

  const page = source.getPage(slug, lang);
  if (!page) return notFound();

  const origin = new URL(request.url).origin;
  const [logoSrc, fonts] = await Promise.all([
    loadLogoDataUri(origin),
    loadFonts(origin),
  ]);

  return new ImageResponse(
    <div
      style={{
        background:
          "linear-gradient(135deg, #0b0a0f 0%, #15141c 50%, #111016 100%)",
        color: "#e4e4e7",
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "96px",
        fontFamily: "Manrope, sans-serif",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 6,
          background: "#783cb5",
          display: "flex",
        }}
      />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "28px",
        }}
      >
        <span
          style={{
            fontSize: 64,
            fontWeight: 800,
            color: "#ffffff",
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
          }}
        >
          {page.data.title}
        </span>
        <div
          style={{
            height: 2,
            width: 280,
            background: "#783cb5",
            display: "flex",
          }}
        />
        {page.data.description && (
          <span
            style={{
              fontSize: 32,
              fontWeight: 400,
              color: "#8b8d98",
              lineHeight: 1.35,
              marginTop: 8,
            }}
          >
            {page.data.description}
          </span>
        )}
      </div>

      <div
        style={{
          display: "flex",
          gap: "20px",
          alignItems: "center",
          fontSize: 36,
          fontWeight: 700,
        }}
      >
        {logoSrc ? (
          <img
            src={logoSrc}
            width={64}
            height={64}
            alt="Divine Skins"
            style={{ borderRadius: 12 }}
          />
        ) : (
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 14,
              background: "linear-gradient(135deg, #c084fc 0%, #783cb5 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: 9,
                background: "#ecb96a",
              }}
            />
          </div>
        )}
        <span style={{ color: "#ffffff", letterSpacing: "-0.01em" }}>
          Divine Skins Wiki
        </span>
      </div>
    </div>,
    {
      // Supply Manrope (the brand hero font) explicitly. The card's CSS asks
      // for `fontFamily: "Manrope"`, but satori only uses fonts handed to it,
      // so without this the title renders in next/og's bundled fallback font.
      // `undefined` (no font loaded) falls back to that default. See loadFonts.
      ...(fonts ? { fonts } : {}),
      // Worker responses aren't edge-cached by Cloudflare, but social crawlers
      // and browsers honor this, so repeat shares don't re-render the image.
      headers: {
        "Cache-Control":
          "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
      },
    },
  );
}

/**
 * Reads a file from public/ at runtime. On Cloudflare Workers the Worker bundle
 * has no filesystem access to public/ — static assets are served from the edge,
 * not from the module's working directory — so a plain readFile throws there.
 * Fetch the asset over HTTP from our own origin first (works in every runtime),
 * and keep the filesystem read as a fallback for local tooling that renders
 * without a live origin. `publicPath` is the asset's URL path (e.g.
 * "/icon-192.png"); the filesystem fallback resolves it under public/.
 */
async function loadPublicAsset(
  origin: string,
  publicPath: string,
): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(new URL(publicPath, origin));
    if (res.ok) return await res.arrayBuffer();
  } catch {
    // Fall through to the filesystem read below.
  }
  try {
    const buf = await readFile(
      join(process.cwd(), "public", ...publicPath.split("/").filter(Boolean)),
    );
    // Return the exact bytes as an ArrayBuffer (avoid handing satori a view
    // over Node's shared pooled buffer).
    return buf.buffer.slice(
      buf.byteOffset,
      buf.byteOffset + buf.byteLength,
    ) as ArrayBuffer;
  } catch {
    return null;
  }
}

let cachedLogo: string | null | undefined;

async function loadLogoDataUri(origin: string): Promise<string | null> {
  if (cachedLogo !== undefined) return cachedLogo;
  // Must be a PNG, not the WebP brand logo: the @vercel/og build that next/og
  // bundles has no WebP dimension parser, so embedding a WebP throws
  // "u2 is not iterable" and aborts the whole image. icon-192.png is the same
  // mark and is plenty sharp for the 64px render. (This is why the logo was
  // never the issue in prod — the failed readFile meant no <img> rendered at
  // all, so the parser was never reached.)
  const buf = await loadPublicAsset(origin, "/icon-192.png");
  cachedLogo = buf
    ? `data:image/png;base64,${Buffer.from(buf).toString("base64")}`
    : null;
  return cachedLogo;
}

// Weights the card actually uses: 400 (description), 700 (footer), 800 (title).
const FONT_WEIGHTS = [400, 700, 800] as const;

type OgFont = {
  name: string;
  data: ArrayBuffer;
  weight: (typeof FONT_WEIGHTS)[number];
  style: "normal";
};

// `null` once resolved-but-empty, so we cache the "no fonts" outcome too.
let cachedFonts: OgFont[] | null | undefined;

async function loadFonts(origin: string): Promise<OgFont[] | undefined> {
  if (cachedFonts !== undefined) return cachedFonts ?? undefined;
  const loaded = await Promise.all(
    FONT_WEIGHTS.map(async (weight) => {
      const data = await loadPublicAsset(origin, `/fonts/Manrope-${weight}.ttf`);
      return data
        ? { name: "Manrope", data, weight, style: "normal" as const }
        : null;
    }),
  );
  const fonts = loaded.filter((font): font is OgFont => font !== null);
  // If nothing loaded, return undefined rather than an empty array: an empty
  // `fonts` array leaves satori with no typeface and throws, whereas omitting
  // the option lets next/og fall back to its bundled default font (today's
  // behavior). So the worst case is exactly what production renders now.
  cachedFonts = fonts.length > 0 ? fonts : null;
  return cachedFonts ?? undefined;
}

export function generateStaticParams() {
  return source.generateParams();
}
