#!/usr/bin/env node
/**
 * Lightweight, dependency-free SEO/QA checks for the static GO Delivery site.
 * Run with: node seo-check.js
 * Exits with code 1 if any CRITICAL/HIGH issue is found (useful for CI).
 */
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const PAGES = ["index.html", "contact.html", "cgv.html"];

let errors = [];
let warnings = [];

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), "utf8");
}

function matchAll(re, str) {
  return [...str.matchAll(re)];
}

const seenTitles = new Map();
const seenDescriptions = new Map();

for (const page of PAGES) {
  const html = read(page);

  // Title
  const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
  if (!titleMatch || !titleMatch[1].trim()) {
    errors.push(`[${page}] Missing <title>.`);
  } else {
    const title = titleMatch[1].trim();
    if (seenTitles.has(title)) {
      errors.push(`[${page}] Duplicate <title> with [${seenTitles.get(title)}]: "${title}"`);
    }
    seenTitles.set(title, page);
  }

  // Meta description
  const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i);
  if (!descMatch || !descMatch[1].trim()) {
    errors.push(`[${page}] Missing meta description.`);
  } else {
    const desc = descMatch[1].trim();
    if (seenDescriptions.has(desc)) {
      errors.push(`[${page}] Duplicate meta description with [${seenDescriptions.get(desc)}].`);
    }
    seenDescriptions.set(desc, page);
  }

  // Canonical
  const canonicalMatches = matchAll(/<link\s+rel=["']canonical["']\s+href=["']([^"']*)["']/gi, html);
  if (canonicalMatches.length === 0) {
    errors.push(`[${page}] Missing canonical link.`);
  } else if (canonicalMatches.length > 1) {
    errors.push(`[${page}] Multiple conflicting canonical tags found (${canonicalMatches.length}).`);
  }

  // H1 count
  const h1Matches = matchAll(/<h1[\s>]/gi, html);
  if (h1Matches.length === 0) {
    errors.push(`[${page}] No <h1> found.`);
  } else if (h1Matches.length > 1) {
    warnings.push(`[${page}] ${h1Matches.length} <h1> elements found (expected exactly 1).`);
  }

  // lang attribute
  const langMatch = html.match(/<html[^>]*\blang=["']([^"']*)["']/i);
  if (!langMatch) {
    warnings.push(`[${page}] Missing lang attribute on <html>.`);
  } else if (langMatch[1].toLowerCase() !== "fr") {
    warnings.push(`[${page}] <html lang="${langMatch[1]}"> but page content is French.`);
  }

  // viewport
  if (!/<meta\s+name=["']viewport["']/i.test(html)) {
    errors.push(`[${page}] Missing viewport meta tag.`);
  }

  // Images missing alt attribute entirely (alt="" is fine for decorative images)
  const imgTags = matchAll(/<img\b[^>]*>/gi, html);
  for (const [tag] of imgTags) {
    if (!/\balt\s*=/i.test(tag)) {
      warnings.push(`[${page}] <img> missing alt attribute: ${tag.slice(0, 80)}`);
    }
  }

  // Internal links / asset references must resolve to a file that exists
  const refs = matchAll(/\b(?:href|src)=["']([^"'#][^"']*)["']/gi, html);
  for (const [, ref] of refs) {
    if (/^https?:\/\//i.test(ref) || ref.startsWith("mailto:") || ref.startsWith("tel:") || ref.startsWith("//")) continue;
    const cleanRef = ref.split("?")[0].split("#")[0];
    if (!cleanRef || cleanRef === "/") continue;
    const resolved = path.join(ROOT, cleanRef.replace(/^\//, ""));
    if (!fs.existsSync(resolved)) {
      errors.push(`[${page}] Broken reference (file not found): ${ref}`);
    }
  }

  // JSON-LD must be valid JSON
  const ldBlocks = matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi, html);
  for (const [, json] of ldBlocks) {
    try {
      JSON.parse(json);
    } catch (e) {
      errors.push(`[${page}] Invalid JSON-LD: ${e.message}`);
    }
  }
}

// robots.txt / sitemap.xml presence
if (!fs.existsSync(path.join(ROOT, "robots.txt"))) {
  errors.push("Missing robots.txt at site root.");
}
if (!fs.existsSync(path.join(ROOT, "sitemap.xml"))) {
  errors.push("Missing sitemap.xml at site root.");
} else {
  const sitemap = read("sitemap.xml");
  for (const page of PAGES) {
    const urlPath = page === "index.html" ? "" : page;
    if (!sitemap.includes(`https://go-delivery.fr/${urlPath}`)) {
      warnings.push(`[sitemap.xml] Page not listed: ${page}`);
    }
  }
}

console.log(`\nSEO/QA check — ${PAGES.length} pages scanned\n`);

if (errors.length) {
  console.log(`ERRORS (${errors.length}):`);
  errors.forEach((e) => console.log("  ✗ " + e));
}
if (warnings.length) {
  console.log(`\nWARNINGS (${warnings.length}):`);
  warnings.forEach((w) => console.log("  ! " + w));
}
if (!errors.length && !warnings.length) {
  console.log("No issues found.");
}

console.log("");
process.exit(errors.length ? 1 : 0);
