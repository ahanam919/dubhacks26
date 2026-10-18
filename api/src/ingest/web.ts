// Polite page fetching and HTML -> text. No extra dependencies.
const UA = process.env.INGEST_USER_AGENT ?? "LocalSwapBot/0.1";
const DELAY_MS = Number(process.env.INGEST_DELAY_MS ?? 3000);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let last = 0;
async function politeWait() {
  const wait = last + DELAY_MS - Date.now();
  if (wait > 0) await sleep(wait);
  last = Date.now();
}

export type Page = { url: string; html: string; text: string };

// Returns null for anything that is not a normal HTML page (PDFs, images, errors).
export async function fetchPage(url: string): Promise<Page | null> {
  await politeWait();
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,text/plain" },
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    if (!/text\/html|text\/plain/i.test(type)) return null;
    const html = (await res.text()).slice(0, 2_000_000);
    return { url: res.url || url, html, text: htmlToText(html) };
  } catch {
    return null;
  }
}

const ENT: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'" };

export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg|head)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|li|tr|h[1-6]|section|article|ul|ol|table)>|<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#?\w+);/g, (m, e) => ENT[e] ?? m)
    .replace(/[ \t ]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

const ORDERING_HOSTS = /toasttab\.com|square\.site|squareup\.com|clover\.com|olo\.com|chownow\.com|order\.online/i;
export const isOrderingHost = (url: string) => ORDERING_HOSTS.test(url);

// Links on the homepage that probably lead to a drink menu or an ordering page.
export function findMenuLinks(html: string, baseUrl: string, max = 3): string[] {
  const found: string[] = [];
  for (const m of html.matchAll(/<a\b[^>]*?href\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const label = htmlToText(m[2]).toLowerCase();
    const href = m[1];
    if (!/menu|drinks|order|beverage|coffee|tea/i.test(href + " " + label)) continue;
    if (/\.(pdf|jpe?g|png|webp|gif)(\?|$)/i.test(href)) continue; // PDFs and images are not handled yet
    if (/^(mailto|tel|javascript):/i.test(href)) continue;
    try {
      const abs = new URL(href, baseUrl);
      const sameSite = abs.hostname.replace(/^www\./, "") === new URL(baseUrl).hostname.replace(/^www\./, "");
      if (!sameSite && !isOrderingHost(abs.href)) continue;
      const u = abs.href;
      if (!found.includes(u) && u !== baseUrl) found.push(u);
    } catch { /* bad href */ }
  }
  // Pages whose URL says "menu" first.
  found.sort((a, b) => Number(/menu/i.test(b)) - Number(/menu/i.test(a)));
  return found.slice(0, max);
}