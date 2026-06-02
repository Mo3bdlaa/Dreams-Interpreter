#!/usr/bin/env python3
"""
Scrape Ibn-Sirin dream-symbol interpretations from thedreams.co letter
dictionary and store them as a RAG-ready corpus at src/data/knowledge-base.json.

The classical interpretations (Ibn Sirin / Nabulsi) are public-domain heritage
text. We keep the corpus local so retrieval works offline without any external
calls at request time.

Usage:  python3 scripts/scrape-ibnsirin.py
"""
import json
import re
import html
import time
import urllib.request
from pathlib import Path

BASE = "https://www.thedreams.co/ibn-sirin/dictionary-of-letters/"
SLUGS = [
    "harf-alalf", "harf-albaa", "harf-alta", "harf-althaea", "harf-aljeem",
    "harf-al-h", "harf-alkhaa", "harf-aldal", "harf-th", "harf-alraa",
    "harf-alzaa", "harf-alseine", "harf-alshin", "harf-alsad", "harf-althad",
    "harf-al-taa", "harf-altha", "harf-alaeen", "harf-algain", "harf-alfaa",
    "harf-alqaaf", "harf-alkaf", "harf-allaam", "harf-almeem", "harf-alnoon",
    "harf-alha", "harf-alwow", "harf-alyaa",
]

HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; DreamsBot/1.0)"}


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=40) as r:
        return r.read().decode("utf-8", "replace")


def strip_tags(s: str) -> str:
    s = re.sub(r"<script.*?</script>", " ", s, flags=re.S)
    s = re.sub(r"<style.*?</style>", " ", s, flags=re.S)
    s = re.sub(r"<[^>]+>", " ", s)
    s = html.unescape(s)
    s = s.replace("#", " ")
    return re.sub(r"\s+", " ", s).strip()


def clean_symbol(h3_text: str) -> str:
    t = strip_tags(h3_text)
    t = t.replace("ﷺ", " ").replace("ﷻ", " ")  # honorific ligatures
    t = re.sub(r"^(?:تفسير|رؤية|معنى)\s+", "", t)
    # Drop "في الأحلام/المنام/الحلم …" and anything after it (not just at end).
    t = re.sub(r"\s+(?:في|عند)\s+(?:ال[أا]حلام|المنام(?:ات)?|الحلم)\b.*$", "", t)
    t = re.sub(r"\s+وغيره\b.*$", "", t)
    t = re.sub(r"^(?:تفسير|رؤية|معنى)\s+", "", t)
    return re.sub(r"\s+", " ", t).strip()


def trim_to_sentence(text: str, limit: int = 900) -> str:
    """Cut overly long text at a sentence boundary instead of mid-word."""
    if len(text) <= limit:
        return text.strip()
    cut = text[:limit]
    end = max(cut.rfind(". "), cut.rfind("."), cut.rfind("؟"), cut.rfind("!"))
    if end > limit * 0.5:
        cut = cut[: end + 1]
    return cut.strip()


def parse_page(htmltext: str, url: str):
    # Split into sections that each start at an <h3>.
    parts = re.split(r"(<h3[^>]*>.*?</h3>)", htmltext, flags=re.S)
    entries = []
    i = 1
    while i < len(parts):
        h3 = parts[i]
        body = parts[i + 1] if i + 1 < len(parts) else ""
        symbol = clean_symbol(h3)
        # Interpretation text lives in <li> (bulleted) and/or <p> elements
        # within the section (between this <h3> and the next).
        chunks = re.findall(r"<(?:li|p)[^>]*>(.*?)</(?:li|p)>", body, flags=re.S)
        text = " ".join(strip_tags(c) for c in chunks)
        text = re.sub(r"\s+", " ", text).strip()
        text = trim_to_sentence(text)
        if symbol and len(symbol) <= 45 and len(text) >= 25:
            entries.append((symbol, text, url))
        i += 2
    return entries


def main():
    seen = set()
    corpus = []
    for slug in SLUGS:
        url = BASE + slug + "/"
        try:
            page = fetch(url)
        except Exception as e:  # noqa
            print(f"  ! failed {slug}: {e}")
            continue
        entries = parse_page(page, url)
        added = 0
        for symbol, text, src_url in entries:
            key = symbol.strip()
            if key in seen:
                continue
            seen.add(key)
            corpus.append(
                {
                    "id": f"ibnsirin-{len(corpus)+1}",
                    "symbol": key,
                    "source": "تفسير الأحلام لابن سيرين",
                    "url": src_url,
                    "text": text,
                }
            )
            added += 1
        print(f"  {slug}: +{added} (total {len(corpus)})")
        time.sleep(0.6)

    out = Path(__file__).resolve().parents[1] / "src/data/knowledge-base.json"
    out.write_text(
        json.dumps(corpus, ensure_ascii=False, indent=1), encoding="utf-8"
    )
    print(f"\nWrote {len(corpus)} entries to {out}")


if __name__ == "__main__":
    main()
