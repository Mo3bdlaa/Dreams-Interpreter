#!/usr/bin/env python3
"""
Build the RAG corpus from three classical dream dictionaries, each entry
carrying a PER-SYMBOL source link (not a letter-index page).

Sources (all public-domain heritage text):
  1. ابن سيرين  — thedreams.co letter pages; every symbol is an <h3 id="…">,
                  so we cite `…/harf-albaa/#تفسير-بيت-في-الأحلام`.
  2. ابن شاهين  — thedreams.co, one page per symbol, so the page URL is exact.
  3. النابلسي   — «تعطير الأنام» on shamela.ws; symbols appear as "(رمز)" lines,
                  cited down to the book page they sit on.

The same symbol may appear in several books — that is the point: the
interpreter gets more than one classical view and cites each separately.

Usage:  python3 scripts/build-corpus.py [--limit N]
"""
import argparse
import html
import json
import re
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

UA = {"User-Agent": "Mozilla/5.0 (compatible; DreamsBot/1.0)"}
ROOT = Path(__file__).resolve().parents[1]

SIRIN_BASE = "https://www.thedreams.co/ibn-sirin/dictionary-of-letters/"
SIRIN_SLUGS = [
    "harf-alalf", "harf-albaa", "harf-alta", "harf-althaea", "harf-aljeem",
    "harf-al-h", "harf-alkhaa", "harf-aldal", "harf-th", "harf-alraa",
    "harf-alzaa", "harf-alseine", "harf-alshin", "harf-alsad", "harf-althad",
    "harf-al-taa", "harf-altha", "harf-alaeen", "harf-algain", "harf-alfaa",
    "harf-alqaaf", "harf-alkaf", "harf-allaam", "harf-almeem", "harf-alnoon",
    "harf-alha", "harf-alwow", "harf-alyaa",
]
SITEMAP = "https://www.thedreams.co/sitemap.xml"
NABULSI_BOOK = "https://shamela.ws/book/1217"
NABULSI_PAGES = 378


def fetch(url: str, tries: int = 3) -> str:
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=45) as r:
                return r.read().decode("utf-8", "replace")
        except Exception:
            if attempt == tries - 1:
                return ""
            time.sleep(1.5 * (attempt + 1))
    return ""


def strip_tags(s: str) -> str:
    s = re.sub(r"<script.*?</script>|<style.*?</style>", " ", s, flags=re.S)
    s = re.sub(r"<[^>]+>", " ", s)
    s = html.unescape(s).replace("#", " ")
    return re.sub(r"\s+", " ", s).strip()


def clean_symbol(raw: str) -> str:
    t = strip_tags(raw).replace("ﷺ", " ").replace("ﷻ", " ")
    t = re.sub(r"^(?:تفسير|رؤية|رؤيا|معنى|حلم)\s+", "", t)
    t = re.sub(r"\s+(?:في|عند)\s+(?:ال[أا]حلام|المنام(?:ات)?|الحلم)\b.*$", "", t)
    t = re.sub(r"\s+وغيره\b.*$", "", t)
    t = re.sub(r"^(?:تفسير|رؤية|رؤيا|معنى|حلم)\s+", "", t)
    return re.sub(r"\s+", " ", t).strip(" -—:،")


def trim(text: str, limit: int = 900) -> str:
    text = text.strip()
    if len(text) <= limit:
        return text
    cut = text[:limit]
    end = max(cut.rfind(". "), cut.rfind("."), cut.rfind("؟"), cut.rfind("!"))
    return (cut[: end + 1] if end > limit * 0.5 else cut).strip()


# --------------------------------------------------------------------------
# 1) ابن سيرين — letter pages, per-symbol <h3 id> anchors
# --------------------------------------------------------------------------
def scrape_sirin() -> list[dict]:
    out = []
    for slug in SIRIN_SLUGS:
        url = SIRIN_BASE + slug + "/"
        page = fetch(url)
        if not page:
            print(f"  ! sirin {slug}: failed", file=sys.stderr)
            continue
        parts = re.split(r"(<h3[^>]*>.*?</h3>)", page, flags=re.S)
        added = 0
        for i in range(1, len(parts), 2):
            h3 = parts[i]
            body = parts[i + 1] if i + 1 < len(parts) else ""
            symbol = clean_symbol(h3)
            anchor = re.search(r'<h3[^>]*id="([^"]+)"', h3)
            chunks = re.findall(r"<(?:li|p)[^>]*>(.*?)</(?:li|p)>", body, flags=re.S)
            text = trim(re.sub(r"\s+", " ", " ".join(strip_tags(c) for c in chunks)))
            if symbol and len(symbol) <= 45 and len(text) >= 25:
                out.append({
                    "symbol": symbol,
                    "source": "تفسير الأحلام لابن سيرين",
                    "url": url + ("#" + anchor.group(1) if anchor else ""),
                    "text": text,
                })
                added += 1
        print(f"  sirin {slug}: +{added}")
        time.sleep(0.4)
    return out


# --------------------------------------------------------------------------
# 2) ابن شاهين — one page per symbol
# --------------------------------------------------------------------------
def shaheen_urls() -> list[str]:
    sm = fetch(SITEMAP)
    urls = re.findall(r"<loc>(https://www\.thedreams\.co/ibn-shaheen/\d+/)</loc>", sm)
    return sorted(set(urls))


def scrape_shaheen_page(url: str):
    page = fetch(url)
    if not page:
        return None
    h1 = re.search(r"<h1[^>]*>(.*?)</h1>", page, flags=re.S)
    body = re.search(r'<div class="post-content"[^>]*>(.*?)</div>\s*<footer', page, flags=re.S)
    if not h1 or not body:
        return None
    symbol = clean_symbol(h1.group(1))
    text = trim(strip_tags(body.group(1)))
    # Pages open by repeating the heading ("رؤيا الصليب والصليب يؤول…"); drop it.
    text = re.sub(
        r"^(?:رؤيا|رؤية|تفسير)?\s*" + re.escape(symbol) + r"\s*", "", text
    ).strip(" -—:،")
    if not symbol or len(symbol) > 45 or len(text) < 25:
        return None
    return {
        "symbol": symbol,
        "source": "الإشارات في علم العبارات لابن شاهين",
        "url": url,
        "text": text,
    }


def scrape_shaheen(limit: int | None) -> list[dict]:
    urls = shaheen_urls()
    if limit:
        urls = urls[:limit]
    print(f"  shaheen: {len(urls)} pages")
    out = []
    with ThreadPoolExecutor(max_workers=6) as pool:
        for i, entry in enumerate(pool.map(scrape_shaheen_page, urls), 1):
            if entry:
                out.append(entry)
            if i % 200 == 0:
                print(f"    …{i}/{len(urls)} (kept {len(out)})")
    print(f"  shaheen: +{len(out)}")
    return out


# --------------------------------------------------------------------------
# 3) النابلسي — «تعطير الأنام» on shamela, "(رمز)" headed entries
# --------------------------------------------------------------------------
# Parenthesised lines that continue the previous symbol rather than open a new
# one ("(ومن رأى)", "(وقيل)"، "(قال)"…).
CONT = re.compile(r"^(?:و?قيل|و?من\s|و?قال|و?رأى|أو\s|ومن\b|وقد\b|تفسير\b)")


def scrape_nabulsi_page(n: int):
    page = fetch(f"{NABULSI_BOOK}/{n}")
    if not page:
        return []
    b = re.search(r'<div class="nass[^"]*"[^>]*>(.*?)</div>\s*(?:<div|<script|</div)', page, flags=re.S)
    if not b:
        return []
    txt = re.sub(r"<[^>]+>", "\n", b.group(1))
    lines = [re.sub(r"\s+", " ", html.unescape(l)).strip()
             for l in txt.split("\n")]
    lines = [l for l in lines if l and l != "-"]

    out = []
    i = 0
    while i < len(lines):
        m = re.fullmatch(r"\((.{1,40}?)\)", lines[i])
        if m:
            sym = m.group(1).strip()
            # Skip continuation markers and non-symbol asides.
            if not CONT.match(sym) and len(sym) >= 2:
                body = []
                j = i + 1
                while j < len(lines) and not re.fullmatch(r"\(.{1,40}?\)", lines[j]):
                    body.append(lines[j])
                    j += 1
                text = trim(" ".join(body))
                if len(text) >= 25:
                    out.append({
                        "symbol": clean_symbol(sym),
                        "source": "تعطير الأنام في تعبير المنام للنابلسي",
                        "url": f"{NABULSI_BOOK}/{n}",
                        "text": text,
                    })
                i = j
                continue
        i += 1
    return out


def scrape_nabulsi(limit: int | None) -> list[dict]:
    pages = range(1, (limit or NABULSI_PAGES) + 1)
    out = []
    with ThreadPoolExecutor(max_workers=6) as pool:
        for i, entries in enumerate(pool.map(scrape_nabulsi_page, pages), 1):
            out.extend(entries)
            if i % 100 == 0:
                print(f"    …{i} pages (kept {len(out)})")
    print(f"  nabulsi: +{len(out)}")
    return out


# --------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=None,
                    help="cap pages per source (smoke test)")
    ap.add_argument("--only", choices=["sirin", "shaheen", "nabulsi"], default=None)
    args = ap.parse_args()

    corpus: list[dict] = []
    if args.only in (None, "sirin"):
        print("ابن سيرين …")
        corpus += scrape_sirin()
    if args.only in (None, "shaheen"):
        print("ابن شاهين …")
        corpus += scrape_shaheen(args.limit)
    if args.only in (None, "nabulsi"):
        print("النابلسي …")
        corpus += scrape_nabulsi(args.limit)

    # Merge the curated symbol dictionary for gaps the books' pages miss.
    curated_path = ROOT / "src/data/dream-symbols.json"
    if args.only is None and curated_path.exists():
        have = {(e["source"], e["symbol"]) for e in corpus}
        curated = json.loads(curated_path.read_text(encoding="utf-8"))
        src = "قاموس تفسير الأحلام (منتخب)"
        added = 0
        for c in curated:
            key = (src, c["key"].strip())
            if key in have:
                continue
            have.add(key)
            corpus.append({
                "symbol": c["key"].strip(),
                "source": src,
                "url": SIRIN_BASE,
                "text": c["interpretation"],
            })
            added += 1
        print(f"  curated: +{added}")

    # De-duplicate per (source, symbol) — the SAME symbol from a DIFFERENT book
    # is kept on purpose, so the interpreter can weigh more than one view.
    seen = set()
    final = []
    for e in corpus:
        key = (e["source"], e["symbol"])
        if not e["symbol"] or key in seen:
            continue
        seen.add(key)
        e["id"] = f"kb-{len(final) + 1}"
        final.append({k: e[k] for k in ("id", "symbol", "source", "url", "text")})

    out = ROOT / "src/data/knowledge-base.json"
    out.write_text(json.dumps(final, ensure_ascii=False, indent=1), encoding="utf-8")

    by_src: dict[str, int] = {}
    deep = 0
    for e in final:
        by_src[e["source"]] = by_src.get(e["source"], 0) + 1
        if "#" in e["url"] or re.search(r"/\d+/?$", e["url"]):
            deep += 1
    print(f"\nWrote {len(final)} entries to {out}")
    for s, n in sorted(by_src.items(), key=lambda kv: -kv[1]):
        print(f"  {n:5d}  {s}")
    print(f"  per-symbol (deep) links: {deep}/{len(final)}")
    print(f"  distinct urls: {len({e['url'] for e in final})}")


if __name__ == "__main__":
    main()
