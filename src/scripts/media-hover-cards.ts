const WALL_SELECTOR = "[data-media-wall]";
const CARD_SELECTOR = "[data-media-card]";
const POPOVER_SELECTOR = ".media-hover-card";
const COMPACT_QUERY = "(max-width: 720px), (hover: none)";

interface MediaDetail {
  title: string;
  author?: string;
  publisher?: string;
  publishedAt?: string;
  pages?: string;
  isbn?: string;
  rating?: number;
  remark?: string;
  summary?: string;
}

type MediaDetails = Record<string, MediaDetail>;
type MediaWall = HTMLElement & {
  dataset: DOMStringMap & {
    hoverReady?: string;
    mediaDetailsUrl?: string;
  };
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function textElement<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text: string) {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = text;
  return element;
}

function renderDetail(detail: MediaDetail) {
  const content = document.createElement("div");
  content.className = "media-hover-content";

  const heading = document.createElement("div");
  heading.className = "media-hover-heading";
  heading.append(textElement("h2", "", detail.title));

  const rating = Math.min(5, Math.max(0, Math.round(detail.rating ?? 0)));
  if (rating > 0) {
    const score = document.createElement("div");
    score.className = "media-hover-score";
    score.setAttribute("aria-label", `评分 ${rating} / 5`);
    const stars = textElement("span", "", "★".repeat(rating));
    stars.setAttribute("aria-hidden", "true");
    score.append(stars, textElement("small", "", `${rating}/5`));
    heading.append(score);
  }
  content.append(heading);

  if (detail.author) content.append(textElement("p", "media-hover-byline", detail.author));

  const facts = [
    detail.publisher,
    detail.publishedAt,
    detail.pages ? `${detail.pages} 页` : ""
  ].filter(Boolean) as string[];
  if (facts.length > 0) {
    const factLine = document.createElement("p");
    factLine.className = "media-hover-facts";
    facts.forEach((fact) => factLine.append(textElement("span", "", fact)));
    content.append(factLine);
  }

  if (detail.isbn) content.append(textElement("p", "media-hover-code", `ISBN ${detail.isbn}`));

  if (detail.remark) {
    const note = document.createElement("blockquote");
    note.className = "media-hover-note";
    note.append(textElement("strong", "", "读后记"), textElement("span", "", detail.remark));
    content.append(note);
  }

  if (detail.summary) content.append(textElement("p", "media-hover-summary", detail.summary));
  if (!detail.remark && !detail.summary) {
    content.append(textElement("p", "media-hover-empty", "暂无简介"));
  }

  return content;
}

function setupWall(wall: MediaWall) {
  if (wall.dataset.hoverReady === "true") return;

  const popover = wall.querySelector<HTMLElement>(POPOVER_SELECTOR);
  const cards = wall.querySelectorAll<HTMLElement>(CARD_SELECTOR);
  const detailsUrl = wall.dataset.mediaDetailsUrl;
  if (!popover || cards.length === 0 || !detailsUrl) return;

  wall.dataset.hoverReady = "true";
  document.body.append(popover);

  let activeCard: HTMLElement | null = null;
  let requestedCard: HTMLElement | null = null;
  let showTimer = 0;
  let hideTimer = 0;
  let detailsPromise: Promise<MediaDetails> | null = null;

  const loadDetails = () => {
    detailsPromise ??= fetch(detailsUrl, { credentials: "same-origin" })
      .then((response) => response.ok ? response.json() as Promise<MediaDetails> : {})
      .catch(() => ({}));
    return detailsPromise;
  };

  const clearTimers = () => {
    window.clearTimeout(showTimer);
    window.clearTimeout(hideTimer);
  };

  const positionPopover = () => {
    if (!activeCard || popover.hidden) return;

    const viewportMargin = 16;
    const gap = 14;
    const cardRect = activeCard.getBoundingClientRect();
    const popoverRect = popover.getBoundingClientRect();

    let side: "left" | "right" = "right";
    let left = cardRect.right + gap;
    if (left + popoverRect.width > window.innerWidth - viewportMargin) {
      side = "left";
      left = cardRect.left - gap - popoverRect.width;
    }

    left = clamp(left, viewportMargin, window.innerWidth - viewportMargin - popoverRect.width);
    const idealTop = cardRect.top + cardRect.height / 2 - popoverRect.height / 2;
    const top = clamp(
      idealTop,
      viewportMargin,
      Math.max(viewportMargin, window.innerHeight - viewportMargin - popoverRect.height)
    );
    const arrowTop = clamp(
      cardRect.top + cardRect.height / 2 - top,
      24,
      Math.max(24, popoverRect.height - 24)
    );

    popover.dataset.side = side;
    popover.style.left = `${Math.round(left)}px`;
    popover.style.top = `${Math.round(top)}px`;
    popover.style.setProperty("--media-hover-arrow-top", `${Math.round(arrowTop)}px`);
  };

  const showPopover = (card: HTMLElement, immediately = false) => {
    if (window.matchMedia(COMPACT_QUERY).matches) return;
    clearTimers();
    requestedCard = card;

    const render = async () => {
      const details = await loadDetails();
      if (requestedCard !== card) return;

      const detail = details[card.dataset.mediaKey ?? ""];
      if (!detail) return;

      activeCard = card;
      popover.replaceChildren(renderDetail(detail));
      popover.hidden = false;
      popover.setAttribute("aria-hidden", "false");
      popover.classList.remove("is-visible");
      positionPopover();
      requestAnimationFrame(() => {
        if (activeCard === card) popover.classList.add("is-visible");
      });
    };

    showTimer = window.setTimeout(() => void render(), immediately ? 0 : 120);
  };

  const hidePopover = (immediately = false) => {
    window.clearTimeout(showTimer);
    window.clearTimeout(hideTimer);
    requestedCard = null;
    activeCard = null;
    popover.classList.remove("is-visible");
    popover.setAttribute("aria-hidden", "true");

    hideTimer = window.setTimeout(() => {
      if (!activeCard) {
        popover.hidden = true;
        popover.replaceChildren();
      }
    }, immediately ? 0 : 100);
  };

  cards.forEach((card) => {
    card.addEventListener("mouseenter", () => showPopover(card));
    card.addEventListener("mouseleave", () => hidePopover());
    card.addEventListener("focusin", () => showPopover(card, true));
    card.addEventListener("focusout", (event) => {
      if (event.relatedTarget instanceof Node && card.contains(event.relatedTarget)) return;
      hidePopover();
    });
  });

  window.addEventListener("scroll", positionPopover, { passive: true });
  window.addEventListener("resize", () => {
    if (window.matchMedia(COMPACT_QUERY).matches) {
      hidePopover(true);
      return;
    }
    positionPopover();
  });
}

export function setupMediaHoverCards() {
  document.querySelectorAll<MediaWall>(WALL_SELECTOR).forEach(setupWall);
}
