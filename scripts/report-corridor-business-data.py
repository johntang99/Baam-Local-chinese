#!/usr/bin/env python3
"""
Corridor stats for Baam business data → Markdown on stdout.
Loads apps/web/.env.local with a safe line parser (handles special chars in values).
"""
from __future__ import annotations

import json
import os
import sys
import urllib.request
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENV_PATH = ROOT / "apps/web/.env.local"

REGION_SLUGS = ["sunset-park-ny", "elmhurst-ny", "manhattan-chinatown-ny"]
COMPARE_FLUSHING = "flushing-ny"


def load_env(path: Path) -> dict[str, str]:
    env = dict(os.environ)
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[7:].strip()
        if "=" not in line:
            continue
        k, _, v = line.partition("=")
        k, v = k.strip(), v.strip()
        if len(v) >= 2 and v[0] == v[-1] and v[0] in "\"'":
            v = v[1:-1]
        env[k] = v
    return env


def rest_get(url: str, headers: dict[str, str]) -> list:
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=120) as resp:
        return json.loads(resp.read().decode())


def fetch_all(base: str, path: str, headers: dict[str, str]) -> list:
    out: list = []
    offset = 0
    while True:
        sep = "&" if "?" in path else "?"
        batch = rest_get(f"{base}/rest/v1/{path}{sep}limit=1000&offset={offset}", headers)
        out.extend(batch)
        if len(batch) < 1000:
            break
        offset += 1000
    return out


def chunks(xs: list, n: int):
    for i in range(0, len(xs), n):
        yield xs[i : i + n]


def pct(num: int, den: int) -> float:
    return round(100.0 * num / den, 1) if den else 0.0


def main() -> None:
    env = load_env(ENV_PATH)
    base = (env.get("NEXT_PUBLIC_SUPABASE_URL") or env.get("SUPABASE_URL") or "").rstrip("/")
    key = env.get("SUPABASE_SERVICE_ROLE_KEY")
    if not base or not key:
        print("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY", file=sys.stderr)
        sys.exit(1)
    h = {"apikey": key, "Authorization": f"Bearer {key}"}

    regions = fetch_all(base, "regions?select=id,slug,name_en,name_zh", h)
    by_slug = {r["slug"]: r for r in regions}
    if any(s not in by_slug for s in REGION_SLUGS):
        raise SystemExit(f"Missing region slug(s): {[s for s in REGION_SLUGS if s not in by_slug]}")

    target_ids = [by_slug[s]["id"] for s in REGION_SLUGS]
    id_list = ",".join(target_ids)
    locs = fetch_all(
        base,
        f"business_locations?region_id=in.({id_list})&is_primary=eq.true&select=business_id,region_id,city,address_line1,zip_code,latitude,longitude,hours_json",
        h,
    )

    bid_to_region: dict[str, str] = {}
    loc_by_bid: dict[str, dict] = {}
    for loc in locs:
        bid = loc["business_id"]
        rid = loc["region_id"]
        slug = next(s for s, r in by_slug.items() if r["id"] == rid)
        bid_to_region[bid] = slug
        loc_by_bid[bid] = loc

    bids = list(bid_to_region.keys())

    biz_rows: list[dict] = []
    for batch in chunks(bids, 100):
        ids = ",".join(batch)
        biz_rows.extend(
            fetch_all(
                base,
                f"businesses?id=in.({ids})&select=id,display_name,display_name_zh,phone,website_url,google_place_id,avg_rating,review_count,short_desc_en,short_desc_zh,created_at,status,is_active",
                h,
            )
        )
    by_id = {b["id"]: b for b in biz_rows}

    cat_primary: dict[str, str] = {}
    cat_slug_counts: Counter[str] = Counter()
    for batch in chunks(bids, 100):
        ids = ",".join(batch)
        rows = fetch_all(
            base,
            f"business_categories?business_id=in.({ids})&select=business_id,is_primary,category:categories(slug,name_en)",
            h,
        )
        for row in rows:
            c = row.get("category")
            if not c:
                continue
            slug = c.get("slug") or "unknown"
            cat_slug_counts[slug] += 1
            if row.get("is_primary"):
                cat_primary[row["business_id"]] = slug

    google_samples: Counter[str] = Counter()
    for batch in chunks(bids, 100):
        ids = ",".join(batch)
        for r in fetch_all(
            base,
            f"reviews?business_id=in.({ids})&source=eq.google&select=business_id",
            h,
        ):
            google_samples[r["business_id"]] += 1

    def stats_for(subset: list[str]) -> dict:
        n = len(subset)
        if not n:
            return {
                "n": 0,
                "phone": 0.0,
                "address": 0.0,
                "city": 0.0,
                "zip": 0.0,
                "geo": 0.0,
                "website": 0.0,
                "google_id": 0.0,
                "name_zh": 0.0,
                "rating_pct": 0.0,
                "review_gt0": 0.0,
                "mean_review_count": 0.0,
                "median_review_count": 0,
                "mean_avg_rating": None,
                "desc_en": 0.0,
                "desc_zh": 0.0,
                "hours": 0.0,
                "primary_cat": 0.0,
                "db_google_reviews": 0.0,
            }

        def c(pred) -> int:
            return sum(1 for b in subset if pred(b))

        loc = lambda bid: loc_by_bid.get(bid) or {}
        biz = lambda bid: by_id.get(bid) or {}

        ratings = [
            float(biz(b)["avg_rating"])
            for b in subset
            if biz(b).get("avg_rating") is not None
        ]
        rc_vals = [int(biz(b).get("review_count") or 0) for b in subset]

        return {
            "n": n,
            "phone": pct(c(lambda b: bool(biz(b).get("phone") and str(biz(b)["phone"]).strip())), n),
            "address": pct(c(lambda b: bool(loc(b).get("address_line1") and str(loc(b)["address_line1"]).strip())), n),
            "city": pct(c(lambda b: bool(loc(b).get("city") and str(loc(b)["city"]).strip())), n),
            "zip": pct(c(lambda b: bool(loc(b).get("zip_code") and str(loc(b)["zip_code"]).strip())), n),
            "geo": pct(c(lambda b: loc(b).get("latitude") is not None and loc(b).get("longitude") is not None), n),
            "website": pct(c(lambda b: bool(biz(b).get("website_url") and str(biz(b)["website_url"]).strip())), n),
            "google_id": pct(c(lambda b: bool(biz(b).get("google_place_id"))), n),
            "name_zh": pct(c(lambda b: bool(biz(b).get("display_name_zh"))), n),
            "rating_pct": pct(c(lambda b: biz(b).get("avg_rating") is not None), n),
            "review_gt0": pct(c(lambda b: int(biz(b).get("review_count") or 0) > 0), n),
            "mean_review_count": round(sum(rc_vals) / n, 1),
            "median_review_count": sorted(rc_vals)[len(rc_vals) // 2],
            "mean_avg_rating": round(sum(ratings) / len(ratings), 2) if ratings else None,
            "desc_en": pct(c(lambda b: bool(biz(b).get("short_desc_en") and str(biz(b)["short_desc_en"]).strip())), n),
            "desc_zh": pct(c(lambda b: bool(biz(b).get("short_desc_zh") and str(biz(b)["short_desc_zh"]).strip())), n),
            "hours": pct(c(lambda b: bool(loc(b).get("hours_json"))), n),
            "primary_cat": pct(c(lambda b: b in cat_primary), n),
            "db_google_reviews": pct(c(lambda b: google_samples.get(b, 0) > 0), n),
        }

    def print_table(title: str, _unused=None) -> None:
        print(f"## {title}\n")
        print("\n### Coverage (% of listings)\n")
        print("| Region | N | Phone | Address | City | ZIP | Lat/Lng | Website | Google place id | Name (ZH) | Rating field | Reviews>0 | Hours JSON | Primary category | `reviews` rows (Google) |")
        print("|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|")
        for s in REGION_SLUGS:
            st = stats_for([b for b in bids if bid_to_region.get(b) == s])
            name = by_slug[s]["name_en"]
            print(
                f"| {name} | {st['n']} | {st['phone']}% | {st['address']}% | {st['city']}% | {st['zip']}% | {st['geo']}% | {st['website']}% | {st['google_id']}% | {st['name_zh']}% | {st['rating_pct']}% | {st['review_gt0']}% | {st['hours']}% | {st['primary_cat']}% | {st['db_google_reviews']}% |"
            )
        ca = stats_for(bids)
        print(
            f"| **All target corridors** | {ca['n']} | {ca['phone']}% | {ca['address']}% | {ca['city']}% | {ca['zip']}% | {ca['geo']}% | {ca['website']}% | {ca['google_id']}% | {ca['name_zh']}% | {ca['rating_pct']}% | {ca['review_gt0']}% | {ca['hours']}% | {ca['primary_cat']}% | {ca['db_google_reviews']}% |"
        )

        print("\n### Rating & review totals (from `businesses`, typically Google Places)\n")
        print("| Region | N | Mean `review_count` | Median `review_count` | Mean `avg_rating` |")
        print("|---|---:|---:|---:|---:|")
        for s in REGION_SLUGS:
            st = stats_for([b for b in bids if bid_to_region.get(b) == s])
            print(
                f"| {by_slug[s]['name_en']} | {st['n']} | {st['mean_review_count']} | {st['median_review_count']} | {st['mean_avg_rating'] or '—'} |"
            )
        print(
            f"| **Combined** | {ca['n']} | {ca['mean_review_count']} | {ca['median_review_count']} | {ca['mean_avg_rating'] or '—'} |"
        )

        print("\n### AI / editorial short descriptions\n")
        print("| Region | `short_desc_en` | `short_desc_zh` |")
        print("|---|---:|---:|")
        for s in REGION_SLUGS:
            st = stats_for([b for b in bids if bid_to_region.get(b) == s])
            print(f"| {by_slug[s]['name_en']} | {st['desc_en']}% | {st['desc_zh']}% |")
        print(f"| **Combined** | {ca['desc_en']}% | {ca['desc_zh']}% |")

    print("# Corridor business data report\n")
    print(
        "**Scope:** Listings with primary `business_locations` in "
        + ", ".join(f"`{s}`" for s in REGION_SLUGS)
        + ".\n"
    )
    print(
        "**Provenance:** Bulk of these rows came from **Google Places Text Search** (discovery). "
        "Unless you ran `backfill-business-details.ts` / `backfill-google-reviews.ts` / `assign-categories.ts` on them, expect strong NAP+rating from search, thinner websites/hours/descriptions, and **no** (or few) rows in `reviews`.\n"
    )

    print_table("Summary tables")

    # Top categories (combined)
    print("\n## Primary category distribution (top 25, combined corridors)\n")
    primary_counts: Counter[str] = Counter()
    for b in bids:
        p = cat_primary.get(b)
        if p:
            primary_counts[p] += 1
    if not primary_counts:
        print("_No primary categories assigned (run `assign-categories` if needed)._")
    else:
        print("| Rank | Category slug | Listings (primary) |")
        print("|---:|---|---:|")
        for i, (slug, cnt) in enumerate(primary_counts.most_common(25), 1):
            print(f"| {i} | `{slug}` | {cnt} |")

    # Any-category counts (includes secondary)
    print("\n## Category slug frequency (all `business_categories` links, combined)\n")
    print("| Rank | Category slug | Link count |")
    print("|---:|---|---:|")
    for i, (slug, cnt) in enumerate(cat_slug_counts.most_common(25), 1):
        print(f"| {i} | `{slug}` | {cnt} |")

    # Flushing snapshot
    if COMPARE_FLUSHING in by_slug:
        fid = by_slug[COMPARE_FLUSHING]["id"]
        fl = fetch_all(
            base,
            f"business_locations?region_id=eq.{fid}&is_primary=eq.true&select=business_id",
            h,
        )
        fb = [x["business_id"] for x in fl]
        # load biz + cats + samples for flushing only (reuse fetches pattern — minimal)
        fbiz = []
        for batch in chunks(fb, 100):
            ids = ",".join(batch)
            fbiz.extend(
                fetch_all(
                    base,
                    f"businesses?id=in.({ids})&select=id,avg_rating,review_count,short_desc_en,short_desc_zh,website_url,phone",
                    h,
                )
            )
        f_by = {b["id"]: b for b in fbiz}
        f_cat = 0
        for batch in chunks(fb, 100):
            ids = ",".join(batch)
            for row in fetch_all(
                base,
                f"business_categories?business_id=in.({ids})&select=is_primary",
                h,
            ):
                if row.get("is_primary"):
                    f_cat += 1
        f_gs = 0
        for batch in chunks(fb, 100):
            ids = ",".join(batch)
            gsb = {r["business_id"] for r in fetch_all(base, f"reviews?business_id=in.({ids})&source=eq.google&select=business_id", h)}
            f_gs += len(gsb)

        fn = len(fb)
        print("\n## Reference: Flushing (`flushing-ny`) snapshot\n")
        print(f"- Primary-location listings: **{fn}**")
        if fn:
            print(
                f"- With primary category: **{pct(f_cat, fn)}%** ({f_cat} listings)\n"
                f"- With any Google sample in `reviews`: **{pct(f_gs, fn)}%** ({f_gs} listings)\n"
                f"- `short_desc_en` / `short_desc_zh` non-empty: **{pct(sum(1 for b in fb if f_by.get(b, {}).get('short_desc_en')), fn)}%** / **{pct(sum(1 for b in fb if f_by.get(b, {}).get('short_desc_zh')), fn)}%**\n"
                f"- `website_url` non-empty: **{pct(sum(1 for b in fb if f_by.get(b, {}).get('website_url')), fn)}%**"
            )

    print("\n---\n_Generated by `scripts/report-corridor-business-data.py` against live Supabase._\n")


if __name__ == "__main__":
    main()
