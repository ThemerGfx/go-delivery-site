#!/usr/bin/env node

/**
 * GO Delivery — SEO / QA checker
 * Usage: node seo-check.js
 * No external dependency required.
 */

const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const SITE_ORIGIN = "https://go-delivery.fr";
const EXCLUDED_DIRS = new Set([".git", "node_modules", "assets"]);

function toPosix(value) {
  return value.split(path.sep).join("/");
}

function walkHtmlFiles(dir, relative = "") {
  const pages = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    const rel = path.join(relative, entry.name);

    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRS.has(entry.name)) {
        pages.push(...walkHtmlFiles(absolute, rel));
      }
      continue;
    }

    if (entry.isFile() && entry.name.toLowerCase().endsWith(".html")) {
      pages.push(toPosix(rel));
    }
  }

  return pages.sort();
}

function read(root, file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function stripHtmlComments(html) {
  return html.replace(/<!--[\s\S]*?-->/g, "");
}

function decodeBasicEntities(value) {
  return String(value)
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function getAttribute(tag, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const re = new RegExp(
    `\\b${escaped}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
    "i"
  );

  const match = tag.match(re);

  return match
    ? decodeBasicEntities(match[1] ?? match[2] ?? match[3] ?? "")
    : null;
}

function openingTags(html, tagName) {
  const re = new RegExp(`<${tagName}\\b[^>]*>`, "gi");

  return [...html.matchAll(re)].map((match) => match[0]);
}

function elementsText(html, tagName) {
  const re = new RegExp(
    `<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`,
    "gi"
  );

  return [...html.matchAll(re)].map((match) =>
    match[1]
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function metaContent(html, name) {
  for (const tag of openingTags(html, "meta")) {
    const attrName = getAttribute(tag, "name");

    if (attrName && attrName.toLowerCase() === name.toLowerCase()) {
      return (getAttribute(tag, "content") || "").trim();
    }
  }

  return null;
}

function canonicalValues(html) {
  const values = [];

  for (const tag of openingTags(html, "link")) {
    const rel = (getAttribute(tag, "rel") || "")
      .toLowerCase()
      .split(/\s+/);

    if (rel.includes("canonical")) {
      values.push((getAttribute(tag, "href") || "").trim());
    }
  }

  return values;
}

function expectedCanonical(page) {
  const normalized = toPosix(page);

  if (normalized === "index.html") {
    return `${SITE_ORIGIN}/`;
  }

  if (normalized.endsWith("/index.html")) {
    return `${SITE_ORIGIN}/${normalized.slice(
      0,
      -"index.html".length
    )}`;
  }

  return `${SITE_ORIGIN}/${normalized}`;
}

function normalizeUrl(value) {
  try {
    const url = new URL(value);

    url.hash = "";

    return url.toString();
  } catch {
    return null;
  }
}

function pageForPath(root, pathname) {
  let clean;

  try {
    clean = decodeURIComponent(pathname);
  } catch {
    clean = pathname;
  }

  clean = clean.replace(/^\/+/, "");

  if (!clean) {
    return "index.html";
  }

  if (clean.endsWith("/")) {
    return toPosix(`${clean}index.html`);
  }

  const direct = toPosix(clean);

  if (fs.existsSync(path.join(root, direct))) {
    return direct;
  }

  if (!path.extname(clean)) {
    const htmlCandidate = toPosix(`${clean}.html`);

    if (fs.existsSync(path.join(root, htmlCandidate))) {
      return htmlCandidate;
    }

    const indexCandidate = toPosix(
      path.join(clean, "index.html")
    );

    if (fs.existsSync(path.join(root, indexCandidate))) {
      return indexCandidate;
    }
  }

  return direct;
}

function collectIds(html) {
  const ids = new Set();

  const re =
    /\bid\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/gi;

  for (const match of html.matchAll(re)) {
    ids.add(
      decodeBasicEntities(
        match[1] ?? match[2] ?? match[3] ?? ""
      )
    );
  }

  return ids;
}

function collectLocalReferences(html) {
  const refs = [];

  const tagRe =
    /<(a|link|script|img|source|iframe)\b[^>]*>/gi;

  for (const match of html.matchAll(tagRe)) {
    const tag = match[0];
    const tagName = match[1].toLowerCase();

    const attr = ["a", "link"].includes(tagName)
      ? "href"
      : "src";

    const value = getAttribute(tag, attr);

    if (value) {
      refs.push({
        tagName,
        attr,
        value: value.trim(),
      });
    }
  }

  return refs;
}

function flattenJsonLd(value) {
  const results = [];

  if (Array.isArray(value)) {
    for (const item of value) {
      results.push(...flattenJsonLd(item));
    }

    return results;
  }

  if (!value || typeof value !== "object") {
    return results;
  }

  results.push(value);

  if (Array.isArray(value["@graph"])) {
    for (const item of value["@graph"]) {
      results.push(...flattenJsonLd(item));
    }
  }

  return results;
}

function jsonLdBlocks(html) {
  const blocks = [];

  const re =
    /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  for (const match of html.matchAll(re)) {
    blocks.push(match[1].trim());
  }

  return blocks;
}

function sitemapUrls(root, errors) {
  const sitemapPath = path.join(root, "sitemap.xml");

  if (!fs.existsSync(sitemapPath)) {
    errors.push("[sitemap.xml] Missing sitemap.xml.");

    return [];
  }

  const xml = fs
    .readFileSync(sitemapPath, "utf8")
    .replace(/<!--[\s\S]*?-->/g, "");

  if (!/<urlset\b/i.test(xml) || !/<\/urlset>/i.test(xml)) {
    errors.push(
      "[sitemap.xml] Invalid sitemap: missing <urlset> root."
    );

    return [];
  }

  const urls = [];

  const re = /<loc\b[^>]*>([\s\S]*?)<\/loc>/gi;

  for (const match of xml.matchAll(re)) {
    const loc = decodeBasicEntities(match[1]).trim();

    if (loc) {
      urls.push(loc);
    }
  }

  if (!urls.length) {
    errors.push("[sitemap.xml] No <loc> URLs found.");
  }

  return urls;
}

function auditSite(root = ROOT) {
  const errors = [];
  const warnings = [];

  const pages = walkHtmlFiles(root);

  if (!pages.length) {
    errors.push("No public HTML pages found.");
  }

  const titleOwners = new Map();
  const descriptionOwners = new Map();
  const canonicalOwners = new Map();

  const pageHtml = new Map();
  const movingCompanies = [];

  for (const page of pages) {
    const html = stripHtmlComments(read(root, page));

    pageHtml.set(page, html);

    // TITLE
    const titles = elementsText(html, "title");

    if (titles.length !== 1 || !titles[0]) {
      errors.push(
        `[${page}] Expected exactly one non-empty <title>; found ${titles.length}.`
      );
    } else {
      const title = titles[0];

      if (titleOwners.has(title)) {
        errors.push(
          `[${page}] Duplicate title with [${titleOwners.get(
            title
          )}]: "${title}"`
        );
      }

      titleOwners.set(title, page);

      if (title.length < 20) {
        warnings.push(
          `[${page}] Title is short (${title.length} characters).`
        );
      }

      if (title.length > 65) {
        warnings.push(
          `[${page}] Title is long (${title.length} characters).`
        );
      }
    }

    // META DESCRIPTION
    const description = metaContent(
      html,
      "description"
    );

    if (!description) {
      errors.push(
        `[${page}] Missing meta description.`
      );
    } else {
      if (descriptionOwners.has(description)) {
        errors.push(
          `[${page}] Duplicate meta description with [${descriptionOwners.get(
            description
          )}].`
        );
      }

      descriptionOwners.set(
        description,
        page
      );

      if (description.length < 70) {
        warnings.push(
          `[${page}] Meta description is short (${description.length} characters).`
        );
      }

      if (description.length > 170) {
        warnings.push(
          `[${page}] Meta description is long (${description.length} characters).`
        );
      }
    }

    // CANONICAL
    const canonicals = canonicalValues(html);

    if (canonicals.length !== 1) {
      errors.push(
        `[${page}] Expected exactly one canonical URL; found ${canonicals.length}.`
      );
    } else {
      const canonical = canonicals[0];

      const normalized =
        normalizeUrl(canonical);

      const expected = normalizeUrl(
        expectedCanonical(page)
      );

      if (!normalized) {
        errors.push(
          `[${page}] Invalid canonical URL: ${canonical}`
        );
      } else {
        const parsed =
          new URL(normalized);

        if (
          parsed.origin !== SITE_ORIGIN
        ) {
          errors.push(
            `[${page}] Canonical uses unexpected origin: ${canonical}`
          );
        }

        if (
          normalized !== expected
        ) {
          errors.push(
            `[${page}] Canonical incorrect. Expected ${expectedCanonical(
              page
            )} but found ${canonical}`
          );
        }

        if (
          canonicalOwners.has(
            normalized
          )
        ) {
          errors.push(
            `[${page}] Canonical duplicates [${canonicalOwners.get(
              normalized
            )}].`
          );
        }

        canonicalOwners.set(
          normalized,
          page
        );
      }
    }

    // LANG
    const htmlTag =
      openingTags(html, "html")[0] ||
      "";

    const lang = (
      getAttribute(
        htmlTag,
        "lang"
      ) || ""
    ).toLowerCase();

    if (!lang) {
      errors.push(
        `[${page}] Missing lang attribute on <html>.`
      );
    } else if (
      lang !== "fr" &&
      !lang.startsWith("fr-")
    ) {
      warnings.push(
        `[${page}] French page declares lang="${lang}".`
      );
    }

    // VIEWPORT
    if (!metaContent(html, "viewport")) {
      errors.push(
        `[${page}] Missing viewport meta tag.`
      );
    }

    // ROBOTS META
    const robots = (
      metaContent(html, "robots") ||
      ""
    ).toLowerCase();

    if (
      robots.includes("noindex")
    ) {
      errors.push(
        `[${page}] Public page contains meta robots noindex.`
      );
    }

    // H1
    const h1Count =
      openingTags(
        html,
        "h1"
      ).length;

    if (h1Count !== 1) {
      errors.push(
        `[${page}] Expected exactly one H1; found ${h1Count}.`
      );
    }

    // IMAGE ALT
    for (const imgTag of openingTags(
      html,
      "img"
    )) {
      if (
        getAttribute(
          imgTag,
          "alt"
        ) === null
      ) {
        warnings.push(
          `[${page}] Image missing alt attribute: ${
            getAttribute(
              imgTag,
              "src"
            ) || "unknown source"
          }`
        );
      }
    }

    // INTERNAL LINKS / ASSETS
    const baseUrl =
      expectedCanonical(page);

    for (const ref of collectLocalReferences(
      html
    )) {
      const value = ref.value;

      if (
        !value ||
        /^(mailto:|tel:|javascript:|data:)/i.test(
          value
        )
      ) {
        continue;
      }

      let resolved;

      try {
        resolved = new URL(
          value,
          baseUrl
        );
      } catch {
        warnings.push(
          `[${page}] Invalid ${ref.attr}: ${value}`
        );

        continue;
      }

      if (
        ![
          "go-delivery.fr",
          "www.go-delivery.fr",
        ].includes(
          resolved.hostname
        )
      ) {
        continue;
      }

      const targetPage =
        pageForPath(
          root,
          resolved.pathname
        );

      const targetPath =
        path.join(
          root,
          targetPage
        );

      if (
        !fs.existsSync(
          targetPath
        )
      ) {
        errors.push(
          `[${page}] Broken internal ${ref.attr}: ${value} -> ${targetPage}`
        );

        continue;
      }

      // INTERNAL ANCHORS
      if (
        ref.attr === "href" &&
        resolved.hash &&
        targetPage
          .toLowerCase()
          .endsWith(".html")
      ) {
        const anchor =
          decodeURIComponent(
            resolved.hash.slice(1)
          );

        if (anchor) {
          const targetHtml =
            pageHtml.has(
              targetPage
            )
              ? pageHtml.get(
                  targetPage
                )
              : stripHtmlComments(
                  read(
                    root,
                    targetPage
                  )
                );

          if (
            !collectIds(
              targetHtml
            ).has(anchor)
          ) {
            errors.push(
              `[${page}] Broken internal anchor: ${value} — #${anchor} not found in ${targetPage}.`
            );
          }
        }
      }
    }

    // JSON-LD
    for (const block of jsonLdBlocks(
      html
    )) {
      if (!block) {
        warnings.push(
          `[${page}] Empty JSON-LD block.`
        );

        continue;
      }

      try {
        const parsed =
          JSON.parse(block);

        for (const entity of flattenJsonLd(
          parsed
        )) {
          const types =
            Array.isArray(
              entity["@type"]
            )
              ? entity["@type"]
              : [
                  entity[
                    "@type"
                  ],
                ];

          if (
            types.includes(
              "MovingCompany"
            )
          ) {
            movingCompanies.push(
              {
                page,
                id:
                  entity[
                    "@id"
                  ] ||
                  null,
                name:
                  entity.name ||
                  null,
                url:
                  entity.url ||
                  null,
              }
            );
          }
        }
      } catch (error) {
        errors.push(
          `[${page}] Invalid JSON-LD: ${error.message}`
        );
      }
    }
  }

  // CONSISTENCY OF MOVINGCOMPANY ENTITY
  if (
    movingCompanies.length >
    1
  ) {
    const reference =
      movingCompanies[0];

    for (const business of movingCompanies.slice(
      1
    )) {
      if (
        reference.id &&
        business.id &&
        reference.id !==
          business.id
      ) {
        errors.push(
          `[${business.page}] MovingCompany @id contradicts other pages.`
        );
      }

      if (
        reference.name &&
        business.name &&
        reference.name !==
          business.name
      ) {
        errors.push(
          `[${business.page}] MovingCompany name contradicts other pages.`
        );
      }

      if (
        reference.url &&
        business.url &&
        normalizeUrl(
          reference.url
        ) !==
          normalizeUrl(
            business.url
          )
      ) {
        errors.push(
          `[${business.page}] MovingCompany URL contradicts other pages.`
        );
      }
    }
  }

  // SITEMAP
  const listedUrls =
    sitemapUrls(
      root,
      errors
    );

  const normalizedUrls =
    listedUrls
      .map(normalizeUrl)
      .filter(Boolean);

  const sitemapSet =
    new Set(
      normalizedUrls
    );

  if (
    sitemapSet.size !==
    normalizedUrls.length
  ) {
    errors.push(
      "[sitemap.xml] Duplicate URLs found."
    );
  }

  for (const page of pages) {
    const expected =
      normalizeUrl(
        expectedCanonical(
          page
        )
      );

    if (
      !sitemapSet.has(
        expected
      )
    ) {
      errors.push(
        `[sitemap.xml] Public page missing from sitemap: ${page} (${expectedCanonical(
          page
        )})`
      );
    }
  }

  for (const rawUrl of listedUrls) {
    const normalized =
      normalizeUrl(rawUrl);

    if (!normalized) {
      errors.push(
        `[sitemap.xml] Invalid URL: ${rawUrl}`
      );

      continue;
    }

    const parsed =
      new URL(normalized);

    if (
      parsed.origin !==
      SITE_ORIGIN
    ) {
      errors.push(
        `[sitemap.xml] URL uses unexpected origin: ${rawUrl}`
      );

      continue;
    }

    const file =
      pageForPath(
        root,
        parsed.pathname
      );

    if (
      !fs.existsSync(
        path.join(
          root,
          file
        )
      )
    ) {
      errors.push(
        `[sitemap.xml] URL points to a missing page: ${rawUrl}`
      );
    }
  }

  // ROBOTS.TXT
  const robotsPath =
    path.join(
      root,
      "robots.txt"
    );

  if (
    !fs.existsSync(
      robotsPath
    )
  ) {
    errors.push(
      "[robots.txt] Missing robots.txt."
    );
  } else {
    const robots =
      fs.readFileSync(
        robotsPath,
        "utf8"
      );

    if (
      /^\s*Disallow:\s*\/\s*$/im.test(
        robots
      )
    ) {
      errors.push(
        "[robots.txt] Entire website is blocked by Disallow: /."
      );
    }

    if (
      !/^\s*Sitemap:\s*https:\/\/go-delivery\.fr\/sitemap\.xml\s*$/im.test(
        robots
      )
    ) {
      warnings.push(
        "[robots.txt] Missing expected sitemap declaration."
      );
    }
  }

  return {
    pages,
    errors,
    warnings,
  };
}

function printResults(
  result
) {
  console.log(
    `\nGO Delivery SEO/QA check — ${result.pages.length} pages scanned\n`
  );

  if (
    result.errors.length
  ) {
    console.log(
      `ERRORS (${result.errors.length}):`
    );

    result.errors.forEach(
      (error) =>
        console.log(
          `  ✗ ${error}`
        )
    );
  }

  if (
    result.warnings.length
  ) {
    console.log(
      `\nWARNINGS (${result.warnings.length}):`
    );

    result.warnings.forEach(
      (warning) =>
        console.log(
          `  ! ${warning}`
        )
    );
  }

  if (
    !result.errors.length &&
    !result.warnings.length
  ) {
    console.log(
      "No issues found."
    );
  } else if (
    !result.errors.length
  ) {
    console.log(
      "\nNo blocking SEO errors found."
    );
  }

  console.log("");
}

if (
  require.main ===
  module
) {
  const result =
    auditSite(ROOT);

  printResults(result);

  process.exit(
    result.errors.length
      ? 1
      : 0
  );
}

module.exports = {
  auditSite,
  expectedCanonical,
  normalizeUrl,
};