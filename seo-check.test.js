#!/usr/bin/env node

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  auditSite,
} = require("./seo-check");

function write(
  root,
  file,
  content
) {
  const target =
    path.join(
      root,
      file
    );

  fs.mkdirSync(
    path.dirname(target),
    {
      recursive: true,
    }
  );

  fs.writeFileSync(
    target,
    content,
    "utf8"
  );
}

function page({
  title,
  description,
  canonical,
  body = "",
}) {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${description}">
<link rel="canonical" href="${canonical}">
</head>
<body>
<h1>${title}</h1>
${body}
</body>
</html>`;
}

function fixture() {
  const root =
    fs.mkdtempSync(
      path.join(
        os.tmpdir(),
        "go-delivery-seo-"
      )
    );

  write(
    root,
    "index.html",
    page({
      title:
        "GO Delivery - Test accueil valide",

      description:
        "Description suffisamment longue pour tester correctement la page d'accueil de GO Delivery avec le contrôle SEO automatisé.",

      canonical:
        "https://go-delivery.fr/",

      body:
        '<a href="contact.html#formulaire">Contact</a>',
    })
  );

  write(
    root,
    "contact.html",
    page({
      title:
        "Demander un devis - GO Delivery Test",

      description:
        "Description suffisamment longue pour vérifier correctement la page de demande de devis avec le contrôle SEO GO Delivery.",

      canonical:
        "https://go-delivery.fr/contact.html",

      body:
        '<section id="formulaire"><p>Formulaire test</p></section>',
    })
  );

  write(
    root,
    "robots.txt",
    `User-agent: *
Allow: /
Sitemap: https://go-delivery.fr/sitemap.xml
`
  );

  write(
    root,
    "sitemap.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://go-delivery.fr/</loc>
  </url>
  <url>
    <loc>https://go-delivery.fr/contact.html</loc>
  </url>
</urlset>
`
  );

  return root;
}

function remove(root) {
  fs.rmSync(
    root,
    {
      recursive: true,
      force: true,
    }
  );
}

function run() {
  // VALID SITE
  let root =
    fixture();

  let result =
    auditSite(root);

  assert.strictEqual(
    result.errors.length,
    0,
    result.errors.join(
      "\n"
    )
  );

  remove(root);

  // WRONG CANONICAL DOMAIN
  root = fixture();

  let contact =
    fs.readFileSync(
      path.join(
        root,
        "contact.html"
      ),
      "utf8"
    );

  contact =
    contact.replace(
      "https://go-delivery.fr/contact.html",
      "https://example.com/contact.html"
    );

  fs.writeFileSync(
    path.join(
      root,
      "contact.html"
    ),
    contact,
    "utf8"
  );

  result =
    auditSite(root);

  assert(
    result.errors.some(
      (error) =>
        error.includes(
          "Canonical uses unexpected origin"
        ) ||
        error.includes(
          "Canonical incorrect"
        )
    ),
    "Wrong canonical must be rejected."
  );

  remove(root);

  // URL ONLY INSIDE XML COMMENT
  root =
    fixture();

  write(
    root,
    "sitemap.xml",
    `<?xml version="1.0" encoding="UTF-8"?>

<!-- https://go-delivery.fr/contact.html -->

<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://go-delivery.fr/</loc>
  </url>
</urlset>
`
  );

  result =
    auditSite(root);

  assert(
    result.errors.some(
      (error) =>
        error.includes(
          "Public page missing from sitemap: contact.html"
        )
    ),
    "URL in XML comment must not count as a sitemap entry."
  );

  remove(root);

  // BROKEN INTERNAL ANCHOR
  root =
    fixture();

  let index =
    fs.readFileSync(
      path.join(
        root,
        "index.html"
      ),
      "utf8"
    );

  index =
    index.replace(
      "contact.html#formulaire",
      "contact.html#missing-anchor"
    );

  fs.writeFileSync(
    path.join(
      root,
      "index.html"
    ),
    index,
    "utf8"
  );

  result =
    auditSite(root);

  assert(
    result.errors.some(
      (error) =>
        error.includes(
          "Broken internal anchor"
        )
    ),
    "Broken anchor must be rejected."
  );

  remove(root);

  // AUTOMATIC DISCOVERY OF NEW PAGE
  root =
    fixture();

  write(
    root,
    "nouveau-service.html",
    page({
      title:
        "Nouveau service GO Delivery - Test automatique",

      description:
        "Cette page permet de vérifier que les nouvelles pages HTML sont découvertes automatiquement sans modifier une liste manuelle.",

      canonical:
        "https://go-delivery.fr/nouveau-service.html",
    })
  );

  let sitemap =
    fs.readFileSync(
      path.join(
        root,
        "sitemap.xml"
      ),
      "utf8"
    );

  sitemap =
    sitemap.replace(
      "</urlset>",
      `  <url>
    <loc>https://go-delivery.fr/nouveau-service.html</loc>
  </url>
</urlset>`
    );

  fs.writeFileSync(
    path.join(
      root,
      "sitemap.xml"
    ),
    sitemap,
    "utf8"
  );

  result =
    auditSite(root);

  assert(
    result.pages.includes(
      "nouveau-service.html"
    ),
    "New public HTML pages must be discovered automatically."
  );

  assert.strictEqual(
    result.errors.length,
    0,
    result.errors.join(
      "\n"
    )
  );

  remove(root);

  console.log("");
  console.log(
    "SEO negative tests: OK"
  );
  console.log(
    "✓ Valid site accepted"
  );
  console.log(
    "✓ Wrong-domain canonical rejected"
  );
  console.log(
    "✓ Sitemap comment trick rejected"
  );
  console.log(
    "✓ Broken anchor rejected"
  );
  console.log(
    "✓ New HTML page discovered automatically"
  );
  console.log("");
}

try {
  run();
} catch (error) {
  console.error("");
  console.error(
    "SEO negative tests: FAILED"
  );
  console.error(
    error.message ||
      error
  );
  console.error("");

  process.exit(1);
}