(() => {
    "use strict";

    const SECTION_SELECTOR =
        ".google-reviews-section";

    const LIST_ID =
        "google-reviews-list";

    const RATING_ID =
        "google-rating-value";

    const COUNT_ID =
        "google-rating-count";

    const MAX_REVIEWS =
        10;


    function getSection() {
        return document.querySelector(
            SECTION_SELECTOR
        );
    }


    function getList() {
        return document.getElementById(
            LIST_ID
        );
    }


    function getConfig() {
        const section = getSection();

        if (!section) {
            return {
                live: false,
                endpoint: "",
            };
        }

        return {
            live:
                section.dataset
                    .reviewsLive === "true",

            endpoint:
                section.dataset
                    .reviewsEndpoint
                || "",
        };
    }


    function getInitials(name) {
        if (!name) {
            return "G";
        }

        return name
            .trim()
            .split(/\\s+/)
            .slice(0, 2)
            .map(
                part =>
                    part.charAt(0)
                        .toUpperCase()
            )
            .join("");
    }


    function ratingToNumber(value) {
        if (
            typeof value === "number"
        ) {
            return Math.max(
                0,
                Math.min(
                    5,
                    Math.round(value)
                )
            );
        }

        const map = {
            ONE: 1,
            TWO: 2,
            THREE: 3,
            FOUR: 4,
            FIVE: 5,
        };

        return map[value] || 5;
    }


    function createStars(rating) {
        const wrapper =
            document.createElement(
                "div"
            );

        const score =
            ratingToNumber(rating);

        wrapper.className =
            "google-review-stars";

        wrapper.setAttribute(
            "aria-label",
            score +
                " étoile" +
                (score > 1 ? "s" : "") +
                " sur 5"
        );

        wrapper.textContent =
            "★".repeat(score)
            + "☆".repeat(
                Math.max(
                    0,
                    5 - score
                )
            );

        return wrapper;
    }


    function formatDate(value) {
        if (!value) {
            return "";
        }

        const date =
            new Date(value);

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {
            return "";
        }

        try {
            return new Intl.DateTimeFormat(
                "fr-FR",
                {
                    month: "long",
                    year: "numeric",
                }
            ).format(date);
        } catch {
            return "";
        }
    }


    function createAvatar(review) {
        const avatar =
            document.createElement(
                "div"
            );

        avatar.className =
            "google-review-avatar";

        const photo =
            review.authorPhoto
            || review.profilePhotoUrl
            || review.author_photo
            || "";

        const name =
            review.author
            || review.displayName
            || review.author_name
            || "Client Google";

        if (photo) {
            const img =
                document.createElement(
                    "img"
                );

            img.src = photo;

            img.alt =
                "Photo de profil de "
                + name;

            img.loading =
                "lazy";

            img.referrerPolicy =
                "no-referrer";

            img.addEventListener(
                "error",
                () => {
                    avatar.textContent =
                        getInitials(
                            name
                        );

                    img.remove();
                },
                {
                    once: true,
                }
            );

            avatar.appendChild(
                img
            );
        } else {
            avatar.textContent =
                getInitials(
                    name
                );
        }

        return avatar;
    }


    function createCard(review) {
        const article =
            document.createElement(
                "article"
            );

        article.className =
            "google-review-card";


        /* TOP */

        const top =
            document.createElement(
                "div"
            );

        top.className =
            "google-review-top";

        top.appendChild(
            createAvatar(review)
        );


        /* AUTHOR */

        const author =
            document.createElement(
                "div"
            );

        author.className =
            "google-review-author";

        const strong =
            document.createElement(
                "strong"
            );

        strong.textContent =
            review.author
            || review.displayName
            || review.author_name
            || "Client Google";

        const sourceLabel =
            document.createElement(
                "span"
            );

        sourceLabel.textContent =
            "Avis Google";

        author.appendChild(
            strong
        );

        author.appendChild(
            sourceLabel
        );

        top.appendChild(
            author
        );


        /* GOOGLE SOURCE */

        const source =
            document.createElement(
                "span"
            );

        source.className =
            "google-review-source";

        source.setAttribute(
            "aria-label",
            "Google"
        );

        source.textContent =
            "G";

        top.appendChild(
            source
        );

        article.appendChild(
            top
        );


        /* STARS */

        article.appendChild(
            createStars(
                review.rating
                || review.starRating
                || 5
            )
        );


        /* TEXT */

        const text =
            document.createElement(
                "p"
            );

        text.className =
            "google-review-text";

        text.textContent =
            review.text
            || review.comment
            || "";

        article.appendChild(
            text
        );


        /* FOOTER */

        const footer =
            document.createElement(
                "div"
            );

        footer.className =
            "google-review-footer";

        const date =
            document.createElement(
                "span"
            );

        const dateText =
            review.relativeTime
            || review.relative_time
            || formatDate(
                review.publishTime
                || review.createTime
                || review.publish_time
            );

        date.textContent =
            dateText || "Google";

        footer.appendChild(
            date
        );


        const reviewUrl =
            review.url
            || review.authorUri
            || review.author_uri
            || "";

        if (reviewUrl) {
            const link =
                document.createElement(
                    "a"
                );

            link.href =
                reviewUrl;

            link.target =
                "_blank";

            link.rel =
                "noopener noreferrer";

            link.textContent =
                "Voir l'avis";

            footer.appendChild(
                link
            );
        } else {
            const google =
                document.createElement(
                    "span"
                );

            google.textContent =
                "Google";

            footer.appendChild(
                google
            );
        }

        article.appendChild(
            footer
        );

        return article;
    }


    function normalizeReviews(payload) {
        if (!payload) {
            return [];
        }

        const reviews =
            Array.isArray(
                payload.reviews
            )
                ? payload.reviews
                : [];

        return reviews
            .filter(Boolean)
            .slice(
                0,
                MAX_REVIEWS
            );
    }


    function updateSummary(payload) {
        const rating =
            document.getElementById(
                RATING_ID
            );

        const count =
            document.getElementById(
                COUNT_ID
            );

        const average =
            payload.rating
            ?? payload.averageRating
            ?? null;

        const total =
            payload.review_count
            ?? payload.totalReviewCount
            ?? null;

        if (
            rating
            && average !== null
        ) {
            rating.textContent =
                Number(average)
                    .toFixed(1)
                    .replace(
                        ".",
                        ","
                    );
        }

        if (
            count
            && total !== null
        ) {
            count.textContent =
                total
                + " avis Google";
        }
    }


    function render(payload) {
        const list =
            getList();

        if (!list) {
            return false;
        }

        const reviews =
            normalizeReviews(
                payload
            );

        /*
         * Important :
         * si l'API ne renvoie rien,
         * on garde les avis fallback
         * présents dans index.html.
         */
        if (!reviews.length) {
            return false;
        }

        const fragment =
            document
                .createDocumentFragment();

        reviews.forEach(
            review => {
                fragment.appendChild(
                    createCard(
                        review
                    )
                );
            }
        );

        list.replaceChildren(
            fragment
        );

        updateSummary(
            payload
        );

        document.dispatchEvent(
            new CustomEvent(
                "gd:reviews-updated",
                {
                    detail: {
                        count:
                            reviews.length,
                    },
                }
            )
        );

        return true;
    }


    async function fetchReviews() {
        const config =
            getConfig();

        /*
         * Tant que Google n'a pas validé
         * notre Business Profile API,
         * data-reviews-live reste false.
         *
         * Donc :
         * zéro requête serveur
         * zéro requête Google
         * zéro coût.
         */
        if (
            !config.live
            || !config.endpoint
        ) {
            return;
        }

        try {
            const response =
                await fetch(
                    config.endpoint,
                    {
                        method: "GET",

                        headers: {
                            Accept:
                                "application/json",
                        },

                        cache:
                            "no-store",
                    }
                );

            if (!response.ok) {
                throw new Error(
                    "HTTP "
                    + response.status
                );
            }

            const payload =
                await response.json();

            if (
                !payload
                || payload.success === false
            ) {
                throw new Error(
                    "Réponse API invalide"
                );
            }

            render(
                payload
            );

        } catch (error) {

            /*
             * Pas d'erreur visible pour
             * l'utilisateur.
             *
             * Les avis statiques restent
             * affichés automatiquement.
             */
            console.warn(
                "GO Delivery reviews fallback actif.",
                error
            );
        }
    }


    /*
     * API frontend disponible également
     * pour nos tests futurs.
     */
    window.GDReviews = {
        render,
        fetchReviews,
    };


    document.addEventListener(
        "DOMContentLoaded",
        fetchReviews
    );

})();
