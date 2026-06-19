# SEO_PROMPT.md — Production-grade SEO for **XORR Finance**

> **Paste this whole file into Google Antigravity (or any coding agent) as the task.**
> Brand at the top of everything: **XORR Finance** — *"Buy Now, Pay Never."*

---

## 0. Context (read first, do not skip)

**XORR Finance** is a private consumer-finance protocol on the **Sui** blockchain:
- **BNPL** ("Buy Now, Pay Never") — checkout with on-chain credit; collateral is deployed to earn yield that auto-repays the loan.
- **Lend / Borrow** — supply USDC to earn; borrow over- and under-collateralized.
- **Private TEE Credit** — a credit score computed inside a confidential **AWS Nitro TEE (enclave)** and attested on-chain; the user's financial data never leaves the enclave.

**Stack & deployment (do not change these):**
- **Next.js (App Router)** + TypeScript + Tailwind CSS, deployed on **Vercel**.
- Primary app domain: **`https://app.xorr.finance`** (this repo, `xorr-core`).
- Marketing/landing domain: **`https://xorr.finance`** • Docs: **`https://docs.xorr.finance`** • Merchants: **`https://merchants.xorr.finance`** • Shop: **`https://shop.xorr.finance`**.
- The app is wallet-gated: the home page (`app/page.tsx`) renders a **crawlable marketing hero** when no wallet is connected (great — this is the SEO surface). Inner terminals render only after a Sui wallet connects.

**The dark, terminal/mono aesthetic and the green accent (`--primary`, `#a6f24a`) are part of the brand — keep them.** SEO work must not restyle or break the UI, the wallet gate, or any on-chain logic.

---

## 1. Objective

Ship **production-grade, technical + on-page SEO** for `xorr-core` (app.xorr.finance) using **only native Next.js App Router primitives** (Metadata API, `sitemap.ts`, `robots.ts`, `manifest.ts`, `next/og`). No third-party SEO plugins. Output must be:
1. **Crawlable & indexable** (correct robots, sitemap, canonicals, no accidental `noindex`).
2. **Rich in SERP & social** (per-route titles/descriptions, Open Graph, Twitter cards, dynamic OG images, JSON-LD structured data).
3. **Fast & accessible** (Core Web Vitals green, semantic HTML, a11y).
4. **Brand-forward** — **"XORR Finance" appears in the title of every page** and in structured data.

---

## 2. Brand, positioning & target keywords

**Brand string (use verbatim):** `XORR Finance`
**Tagline:** `Buy Now, Pay Never.`
**One-liner:** `Private consumer credit on Sui — BNPL, lending, and a credit score that never leaves a confidential TEE.`

**Title strategy — brand leads or anchors every title:**
- Home (default): `XORR Finance — Buy Now, Pay Never · Private Credit on Sui`
- Template for inner pages: `%s | XORR Finance` (e.g. `Faucet | XORR Finance`).

**Keyword clusters (weave naturally into titles, descriptions, H1/H2, JSON-LD, FAQ — never keyword-stuff):**
- **Primary / brand:** XORR, XORR Finance, Buy Now Pay Never, private credit on Sui.
- **Secondary:** on-chain BNPL, BNPL crypto, Sui lending and borrowing, TEE credit score, confidential DeFi, decentralized credit score, under-collateralized loans DeFi, yield-backed loans, pay-later crypto.
- **Long-tail:** "buy now pay later on Sui", "borrow against your reputation crypto", "private credit score DeFi", "confidential lending Sui testnet", "earn yield on USDC Sui".

---

## 3. Deliverables (do all of these)

### 3.1 Root metadata + title template — `app/layout.tsx`
Replace the current `metadata` export with a complete, typed `Metadata` object:
```ts
import type { Metadata } from "next";

const SITE = "https://app.xorr.finance";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: "XORR Finance — Buy Now, Pay Never · Private Credit on Sui",
    template: "%s | XORR Finance",
  },
  description:
    "XORR Finance is private consumer credit on Sui: Buy Now Pay Never (BNPL), lend/borrow USDC, and borrow against a credit score computed inside a confidential TEE. Your financial data never leaves the enclave.",
  applicationName: "XORR Finance",
  keywords: [
    "XORR", "XORR Finance", "Buy Now Pay Never", "BNPL", "on-chain BNPL",
    "Sui", "Sui lending", "Sui borrowing", "private credit", "TEE credit score",
    "confidential DeFi", "decentralized credit score", "under-collateralized loans",
    "yield-backed loans", "USDC", "pay later crypto",
  ],
  authors: [{ name: "XORR Finance", url: SITE }],
  creator: "XORR Finance",
  publisher: "XORR Finance",
  category: "finance",
  alternates: { canonical: "/" },
  robots: {
    index: true, follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
  },
  openGraph: {
    type: "website",
    siteName: "XORR Finance",
    url: SITE,
    title: "XORR Finance — Buy Now, Pay Never · Private Credit on Sui",
    description:
      "BNPL, lend/borrow, and a private TEE credit score on Sui. Checkout with credit, repay from yield.",
    locale: "en_US",
    // images resolved automatically from opengraph-image.tsx (3.3)
  },
  twitter: {
    card: "summary_large_image",
    title: "XORR Finance — Buy Now, Pay Never",
    description: "Private consumer credit on Sui: BNPL, lend/borrow, and a TEE-computed credit score.",
    creator: "@xorrfinance", // confirm the real handle before shipping; remove if none
    site: "@xorrfinance",
  },
  icons: {
    icon: [{ url: "/favicon.ico" }, { url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/apple-icon.png" }],
  },
  manifest: "/manifest.webmanifest",
};
```
Also: keep `<html lang="en">`; ensure the existing `viewport` export stays (move `themeColor` into a `viewport` export if you add it — Next 14+ requires `themeColor`/`colorScheme` in `viewport`, NOT `metadata`).

### 3.2 Per-route metadata
For **every** static route, add a route-level `export const metadata` (use `generateMetadata` only for dynamic routes like `app/pay/[hash]`, which should be `robots: { index: false }` since it's a transactional page). Suggested copy:
| Route | Title (before ` | XORR Finance`) | Description focus |
|---|---|---|
| `app/bnpl/page.tsx` | `Buy Now, Pay Never` | on-chain BNPL checkout, repay from yield |
| `app/lend-borrow/page.tsx` | `Lend & Borrow` | supply USDC to earn; over/under-collateralized borrowing |
| `app/credit/page.tsx` | `Private TEE Credit Score` | score computed in a confidential enclave, attested on-chain |
| `app/faucet/page.tsx` | `Testnet USDC Faucet` | mint test USDC to try XORR on Sui testnet |
| `app/pools/page.tsx` | `Liquidity Pools` | pool TVL, utilization, yields |
| `app/positions/page.tsx` | `Your Positions` | (also `robots: { index: false }` — user-specific) |
| `app/transactions/page.tsx` | `Activity` | (`robots: { index: false }`) |

> `"use client"` pages can't export `metadata`. If a page is a client component, either (a) add a small server `layout.tsx` in that route folder that exports the `metadata`, or (b) split the page into a server `page.tsx` that sets metadata and renders a `client` child. Prefer (a) — least churn.

### 3.3 Dynamic Open Graph images — `app/opengraph-image.tsx` (+ per-route variants)
Use `next/og` `ImageResponse` (1200×630) to render a branded card: XORR wordmark, tagline "Buy Now, Pay Never.", dark background, green accent. Add `app/twitter-image.tsx` (can re-export the same). Add route-level `opengraph-image.tsx` for `/bnpl`, `/lend-borrow`, `/credit` with their own headline. Keep fonts/sizes legible at small sizes.

### 3.4 `app/robots.ts`
```ts
import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/pay/", "/positions", "/transactions"] }],
    sitemap: "https://app.xorr.finance/sitemap.xml",
    host: "https://app.xorr.finance",
  };
}
```

### 3.5 `app/sitemap.ts`
List the public, indexable routes (`/`, `/bnpl`, `/lend-borrow`, `/credit`, `/faucet`, `/pools`) with `changeFrequency` + `priority` (home = 1.0). Use a static `lastModified` (a build-time constant) — do **not** call `new Date()` at module top if it breaks determinism; a fixed ISO string is fine.

### 3.6 Structured data (JSON-LD) — inject via `<script type="application/ld+json">`
Add a server component `components/seo/json-ld.tsx` that renders the JSON safely (`dangerouslySetInnerHTML` with `JSON.stringify`). Include in `layout.tsx`:
- **Organization** — name "XORR Finance", url, logo, sameAs (X/Twitter, GitHub, Discord — fill real URLs or omit).
- **WebSite** — with `potentialAction` `SearchAction` only if site search exists (else omit).
- **FinancialService** / **Product** — describe BNPL + lending offerings.
On `/credit` (or home), add a **FAQPage** with 4–6 real Q&As ("What is Buy Now, Pay Never?", "How does the TEE credit score work?", "Is my financial data private?", "What is XORR Finance built on?"). Add **BreadcrumbList** on inner pages.

### 3.7 PWA manifest + icons — `app/manifest.ts`
```ts
import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "XORR Finance",
    short_name: "XORR",
    description: "Private consumer credit on Sui — BNPL, lend/borrow, and a confidential TEE credit score.",
    start_url: "/",
    display: "standalone",
    background_color: "#05080f",
    theme_color: "#a6f24a",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
```
Generate the icon set (`favicon.ico`, `icon.svg`, `apple-icon.png`, `icon-192/512`, maskable) from the existing XORR logo (`/public/logo-image.png`). Add `viewport.themeColor = "#a6f24a"`.

### 3.8 Canonicals
`metadataBase` (3.1) + per-route `alternates.canonical` (relative path). Ensure no duplicate-content via trailing slashes — set `trailingSlash: false` (Next default) and keep it.

### 3.9 Core Web Vitals / performance
- Use `next/font` (the repo already uses Geist) — ensure `display: "swap"`; drop the manual Google Fonts `<link>` in `layout.tsx` head if it duplicates `next/font` (avoid double font loading / render-blocking).
- All `<img>` → `next/image` with explicit `width`/`height` (prevent CLS); logo gets `priority`.
- Lazy-load below-the-fold and wallet-only chunks; keep the hero LCP element (the H1) server-rendered and unblocked.
- Audit bundle: dynamic-`import()` heavy client-only libs (charts, dapp-kit modals) so they don't bloat the initial route.
- Target Lighthouse: **Performance ≥ 90, SEO = 100, Best Practices ≥ 95, Accessibility ≥ 95** on `/` (mobile).

### 3.10 Accessibility & semantic HTML
- Exactly one `<h1>` per page (the hero headline on home). Logical `h2/h3` order.
- All interactive elements keyboard-reachable with visible focus; `aria-label` on icon-only buttons (e.g. the connect/disconnect, copy).
- Color-contrast AA for text on the dark bg (watch the faint `text-foreground/30` labels — bump where it fails).
- `alt` text on every image; decorative SVGs `aria-hidden`.

### 3.11 Headers — `next.config`
Add SEO/trust headers (these are CSP-light and safe): `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: SAMEORIGIN` (or a frame-ancestors CSP). **Do not** remove the existing `/api/*` CORS headers.

### 3.12 Verification & analytics
- Add Google Search Console + Bing verification via `metadata.verification` (`google`, `other: { "msvalidate.01": "…" }`) — leave placeholders the owner fills.
- Vercel Analytics is already wired (`@vercel/analytics`). Optionally add Vercel Speed Insights. Do **not** add invasive third-party trackers.
- After deploy: submit `sitemap.xml` in GSC; validate with Rich Results Test + the Facebook/X card debuggers.

### 3.13 Content & copy (on-page)
- The wallet-gated hero is the indexable surface — make its copy keyword-rich but human: clear H1 (`Buy Now, Pay Never.`), a descriptive paragraph (already present), and a short FAQ/"How it works" section **below the fold that renders without a wallet** (3 steps + the FAQ that feeds 3.6).
- Add descriptive internal links (anchor text like "private TEE credit", "lend & borrow on Sui") between hero sections — helps crawl + topical relevance.

---

## 4. Acceptance criteria / QA checklist

- [ ] `view-source:https://app.xorr.finance` shows a unique `<title>` leading/anchored with **XORR Finance**, a meta description, canonical, OG + Twitter tags, and JSON-LD.
- [ ] Every public route has a unique title + description; `/pay/*`, `/positions`, `/transactions` are `noindex`.
- [ ] `/robots.txt`, `/sitemap.xml`, `/manifest.webmanifest`, `/opengraph-image` all return 200 with correct content-types.
- [ ] Google **Rich Results Test** passes for Organization + FAQPage; **no** structured-data errors.
- [ ] X/Twitter Card Validator + Facebook Sharing Debugger render the branded OG image and copy.
- [ ] Lighthouse (mobile, `/`): SEO **100**, Performance ≥ 90, A11y ≥ 95, no console errors.
- [ ] `next build` is clean (no type errors, no metadata/viewport warnings). All previously-passing pages still build.
- [ ] Wallet gate, on-chain calls, toasts, and the dark/green design are **unchanged**.

---

## 5. Constraints / out of scope

- **Do not** touch `lib/*` transaction builders, Move/contract logic, the wallet provider, or `.env`.
- **Do not** introduce `noindex` on public pages, block CSS/JS in robots, or add a paywall/interstitial in front of the hero.
- **Do not** restyle the brand or change the green accent / mono type system.
- **Do not** invent social handles or verification tokens — leave clearly-marked placeholders for the owner.
- Keep everything framework-native (Next.js App Router); no `next-seo` or other plugins.

**When done,** output a short report: files added/changed, the Lighthouse scores, and any placeholders the owner must fill (handles, GSC token, sameAs URLs).
