(() => {
  "use strict";

  const TRACK_ID = "google-reviews-list";

  function getTrack() {
    return document.getElementById(TRACK_ID);
  }

  function getCards() {
    const track = getTrack();

    if (!track) {
      return [];
    }

    return Array.from(track.querySelectorAll(".google-review-card"));
  }

  function getVisibleCount() {
    if (window.innerWidth <= 767.98) {
      return 1;
    }

    if (window.innerWidth <= 991.98) {
      return 2;
    }

    return 3;
  }

  function prepareLocalPreview() {
    const hostname = window.location.hostname;

    const isLocal = hostname === "localhost" || hostname === "127.0.0.1";

    if (!isLocal) {
      return;
    }

    const track = getTrack();

    if (!track) {
      return;
    }

    const realCards = Array.from(
      track.querySelectorAll(".google-review-card:not([data-dev-clone])"),
    );

    if (realCards.length === 0 || getCards().length >= 10) {
      return;
    }

    let index = 0;

    while (getCards().length < 10) {
      const source = realCards[index % realCards.length];

      const clone = source.cloneNode(true);

      clone.setAttribute("data-dev-clone", "true");

      clone.setAttribute("aria-hidden", "true");

      track.appendChild(clone);

      index++;
    }
  }

  function getStep() {
    const track = getTrack();
    const cards = getCards();

    if (!track || !cards.length) {
      return 0;
    }

    const style = window.getComputedStyle(track);

    const gap = parseFloat(style.columnGap || style.gap) || 0;

    return cards[0].getBoundingClientRect().width + gap;
  }

  function getCurrentIndex() {
    const track = getTrack();
    const step = getStep();

    if (!track || !step) {
      return 0;
    }

    return Math.round(track.scrollLeft / step);
  }

  function goToIndex(index, behavior = "smooth") {
    const track = getTrack();
    const cards = getCards();
    const step = getStep();

    if (!track || !cards.length || !step) {
      return;
    }

    const maxIndex = Math.max(0, cards.length - getVisibleCount());

    let target = index;

    if (target > maxIndex) {
      target = 0;
    }

    if (target < 0) {
      target = maxIndex;
    }

    track.scrollTo({
      left: target * step,

      behavior,
    });
  }

  function goNext() {
    goToIndex(getCurrentIndex() + 1);
  }

  function goPrev() {
    goToIndex(getCurrentIndex() - 1);
  }

  function buildDots() {
    const container = document.querySelector(".google-reviews-mobile-hint");

    if (!container) {
      return;
    }

    container.innerHTML = "";

    getCards().forEach((_, index) => {
      const dot = document.createElement("span");

      if (index === 0) {
        dot.classList.add("is-active");
      }

      container.appendChild(dot);
    });
  }

  function updateDots() {
    const dots = document.querySelectorAll(".google-reviews-mobile-hint span");

    if (!dots.length) {
      return;
    }

    const current = getCurrentIndex();

    dots.forEach((dot, index) => {
      dot.classList.toggle("is-active", index === current);
    });
  }

  function updateControls() {
    const arrows = document.querySelectorAll(".google-reviews-arrow");

    if (!arrows.length) {
      return;
    }

    const hasOverflow = getCards().length > getVisibleCount();

    arrows.forEach((arrow) => {
      arrow.classList.toggle("is-hidden", !hasOverflow);
    });
  }

  function bindButtons() {
    const prev = document.querySelector(".google-reviews-prev");

    const next = document.querySelector(".google-reviews-next");

    if (prev) {
      prev.addEventListener("click", goPrev);
    }

    if (next) {
      next.addEventListener("click", goNext);
    }
  }

  function bindTrack() {
    const track = getTrack();

    if (!track) {
      return;
    }

    track.addEventListener("scroll", updateDots, {
      passive: true,
    });
  }

  function refresh() {
    window.requestAnimationFrame(() => {
      updateControls();
      buildDots();
      updateDots();
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    prepareLocalPreview();

    bindButtons();
    bindTrack();

    refresh();

    /*
     * On démarre volontairement
     * sur une carte intérieure
     * afin de laisser apparaître
     * un aperçu à gauche et à droite.
     */
    window.requestAnimationFrame(() => {
      if (getCards().length > getVisibleCount()) {
        goToIndex(1, "auto");
      }
    });
  });

  window.addEventListener("resize", () => {
    window.clearTimeout(window.__gdReviewsResize);

    window.__gdReviewsResize = window.setTimeout(refresh, 180);
  });

  document.addEventListener("gd:reviews-updated", refresh);
})();
