const fs = require("fs");
const path = require("path");

function read(root, file) {
    return fs.readFileSync(path.join(root, file), "utf8");
}

function getAttribute(tag, name) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const re = new RegExp(
        `\\b${escaped}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
        "i"
    );

    const match = tag.match(re);

    return match
        ? (match[1] ?? match[2] ?? match[3] ?? "").trim()
        : null;
}

function openingTags(html, tagName) {
    const re = new RegExp(`<${tagName}\\b[^>]*>`, "gi");

    return [...html.matchAll(re)].map(
        (match) => match[0]
    );
}

function extractHeader(html) {
    const match = html.match(
        /<header\b[\s\S]*?<\/header>/i
    );

    return match ? match[0] : null;
}

function normalizeHeader(header) {
    if (!header) {
        return null;
    }

    return header
        .replace(
            /href=["']\/?#nosservices["']/gi,
            'href="#nosservices"'
        )
        .replace(
            /href=["']\/?#footer["']/gi,
            'href="#footer"'
        )
        .replace(
            /href=["']\/?#apropos["']/gi,
            'href="#apropos"'
        )
        .replace(/>\s+</g, "><")
        .replace(/\s+/g, " ")
        .trim();
}

function auditExtra(root, pages, errors, warnings) {
    const pageHtml = new Map();

    for (const page of pages) {
        pageHtml.set(
            page,
            read(root, page)
        );
    }

    /* -----------------------------------------------------
       HEADER COMMUN
       ----------------------------------------------------- */

    const indexHtml = pageHtml.get("index.html");

    if (indexHtml) {
        const referenceHeader =
            extractHeader(indexHtml);

        /*
         * Les fixtures historiques du checker n'ont pas
         * forcément de header.
         *
         * On active donc ce contrôle uniquement lorsque
         * index.html possède réellement un header.
         */
        if (referenceHeader) {
            const normalizedReference =
                normalizeHeader(referenceHeader);

            for (const page of pages) {
                if (page === "index.html") {
                    continue;
                }

                const html = pageHtml.get(page);
                const header = extractHeader(html);

                if (!header) {
                    errors.push(
                        `[${page}] Missing common site header.`
                    );
                    continue;
                }

                const normalized =
                    normalizeHeader(header);

                if (normalized !== normalizedReference) {
                    errors.push(
                        `[${page}] Header differs from index.html.`
                    );
                }
            }
        }
    }

    /* -----------------------------------------------------
       LIENS PLACEHOLDERS / GMAIL
       ----------------------------------------------------- */

    for (const page of pages) {
        const html = pageHtml.get(page);

        for (const tag of openingTags(html, "a")) {
            const href =
                getAttribute(tag, "href");

            if (!href) {
                continue;
            }

            if (href === "#") {
                errors.push(
                    `[${page}] Placeholder link href="#" found.`
                );
            }

            if (
                /mail\.google\.com\/mail\/\?view=cm/i.test(
                    href
                )
            ) {
                errors.push(
                    `[${page}] Gmail compose link found; use mailto: instead.`
                );
            }
        }

        /* -------------------------------------------------
           CSS DUPLIQUÉS
           ------------------------------------------------- */

        const stylesheets = [];

        for (const tag of openingTags(html, "link")) {
            const rel = (
                getAttribute(tag, "rel") || ""
            )
                .toLowerCase()
                .split(/\s+/);

            if (!rel.includes("stylesheet")) {
                continue;
            }

            const href =
                getAttribute(tag, "href");

            if (href) {
                stylesheets.push(href);
            }
        }

        const counts = new Map();

        for (const href of stylesheets) {
            counts.set(
                href,
                (counts.get(href) || 0) + 1
            );
        }

        for (const [href, count] of counts) {
            if (count > 1) {
                errors.push(
                    `[${page}] Duplicate stylesheet: ${href} appears ${count} times.`
                );
            }
        }
    }

    return {
        errors,
        warnings,
    };
}

module.exports = {
    auditExtra,
};
