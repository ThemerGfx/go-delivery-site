const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const {
    auditExtra,
} = require("./seo-check-extra");

function write(root, file, content) {
    const target =
        path.join(root, file);

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

function header(home = false) {
    const prefix = home ? "" : "/";

    return `
<header class="header-area-2">
    <div class="header-top-2">
        <a href="mailto:contact@go-delivery.fr">
            contact@go-delivery.fr
        </a>
    </div>

    <div class="menu-area menu-area-2">
        <nav>
            <a href="${prefix}#nosservices">
                Nos Services
            </a>

            <a href="${prefix}#footer">
                Contactez-nous
            </a>

            <a href="${prefix}#apropos">
                À propos
            </a>
        </nav>
    </div>
</header>
`;
}

function fixture() {
    const root =
        fs.mkdtempSync(
            path.join(
                os.tmpdir(),
                "go-delivery-extra-"
            )
        );

    write(
        root,
        "index.html",
        `
<!doctype html>
<html lang="fr">
<head>
    <link rel="stylesheet" href="assets/css/style.css">
</head>
<body>
    ${header(true)}
</body>
</html>
`
    );

    write(
        root,
        "contact.html",
        `
<!doctype html>
<html lang="fr">
<head>
    <link rel="stylesheet" href="assets/css/style.css">
</head>
<body>
    ${header(false)}
</body>
</html>
`
    );

    return root;
}

function audit(root) {
    const errors = [];
    const warnings = [];

    auditExtra(
        root,
        [
            "index.html",
            "contact.html",
        ],
        errors,
        warnings
    );

    return {
        errors,
        warnings,
    };
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
    let root;
    let result;

    /* VALID */
    root = fixture();

    result = audit(root);

    assert.strictEqual(
        result.errors.length,
        0,
        result.errors.join("\n")
    );

    remove(root);

    /* HEADER DIFFÉRENT */
    root = fixture();

    let contact =
        fs.readFileSync(
            path.join(root, "contact.html"),
            "utf8"
        );

    contact = contact.replace(
        "Nos Services",
        "Services différents"
    );

    fs.writeFileSync(
        path.join(root, "contact.html"),
        contact,
        "utf8"
    );

    result = audit(root);

    assert(
        result.errors.some(
            (error) =>
                error.includes(
                    "Header differs from index.html"
                )
        ),
        "Different header must be rejected."
    );

    remove(root);

    /* HREF="#" */
    root = fixture();

    let index =
        fs.readFileSync(
            path.join(root, "index.html"),
            "utf8"
        );

    index = index.replace(
        "</body>",
        '<a href="#">Placeholder</a></body>'
    );

    fs.writeFileSync(
        path.join(root, "index.html"),
        index,
        "utf8"
    );

    result = audit(root);

    assert(
        result.errors.some(
            (error) =>
                error.includes(
                    'Placeholder link href="#"'
                )
        ),
        'href="#" must be rejected.'
    );

    remove(root);

    /* GMAIL COMPOSE */
    root = fixture();

    index =
        fs.readFileSync(
            path.join(root, "index.html"),
            "utf8"
        );

    index = index.replace(
        "</body>",
        '<a href="https://mail.google.com/mail/?view=cm&fs=1&to=test@example.com">Mail</a></body>'
    );

    fs.writeFileSync(
        path.join(root, "index.html"),
        index,
        "utf8"
    );

    result = audit(root);

    assert(
        result.errors.some(
            (error) =>
                error.includes(
                    "Gmail compose link found"
                )
        ),
        "Gmail compose link must be rejected."
    );

    remove(root);

    /* CSS DUPLIQUÉ */
    root = fixture();

    index =
        fs.readFileSync(
            path.join(root, "index.html"),
            "utf8"
        );

    index = index.replace(
        "</head>",
        '<link rel="stylesheet" href="assets/css/style.css"></head>'
    );

    fs.writeFileSync(
        path.join(root, "index.html"),
        index,
        "utf8"
    );

    result = audit(root);

    assert(
        result.errors.some(
            (error) =>
                error.includes(
                    "Duplicate stylesheet"
                )
        ),
        "Duplicate stylesheet must be rejected."
    );

    remove(root);

    console.log(
        "SEO extra negative tests: OK"
    );

    console.log(
        "✓ Common header mismatch rejected"
    );

    console.log(
        '✓ Placeholder href="#" rejected'
    );

    console.log(
        "✓ Gmail compose link rejected"
    );

    console.log(
        "✓ Duplicate stylesheet rejected"
    );
}

run();
