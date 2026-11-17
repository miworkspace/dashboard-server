import sanitizeHtml from "sanitize-html";

// Allow-list that matches what the dashboard's CKEditor can produce.
// Anything else (script, on* handlers, javascript: URLs, unknown iframes,
// base64 images, ...) is removed before the content is saved.

const EMBED_HOSTS = [
  "www.youtube.com",
  "youtube.com",
  "www.youtube-nocookie.com",
  "player.vimeo.com",
  "www.dailymotion.com",
  "open.spotify.com",
];

// CSS value patterns. "url(" is never allowed so styles cannot load resources.
const SAFE_VALUE = [/^(?!.*url\s*\()[\w\s.,%#()/-]+$/i];
const LENGTH = [/^-?\d+(\.\d+)?(px|em|rem|%|pt|vw|vh)?$/];
const COLOR = [
  /^#[0-9a-f]{3,8}$/i,
  /^(rgb|rgba|hsl|hsla)\([\d\s.,%deg]+\)$/i,
  /^[a-z]+$/i,
];

const TABLE_STYLES = {
  width: LENGTH,
  height: LENGTH,
  float: [/^(left|right|none)$/],
  border: SAFE_VALUE,
  "border-color": COLOR,
  "border-style": [/^[a-z\s]+$/],
  "border-width": SAFE_VALUE,
  "background-color": COLOR,
  padding: SAFE_VALUE,
  "text-align": [/^(left|right|center|justify)$/],
  "vertical-align": [/^(top|middle|bottom|baseline)$/],
};

const OPTIONS = {
  allowedTags: [
    "p", "br", "h2", "h3", "h4",
    "strong", "b", "em", "i", "u", "s", "del", "sub", "sup", "code", "mark", "span",
    "a", "blockquote", "pre", "hr",
    "ul", "ol", "li", "label", "input",
    "figure", "figcaption", "img",
    "table", "caption", "colgroup", "col", "thead", "tbody", "tfoot", "tr", "th", "td",
    "div", "iframe", "oembed",
  ],

  allowedAttributes: {
    "*": ["class", "style"],
    a: ["href", "target", "rel"],
    img: ["src", "alt", "width", "height", "srcset", "sizes", "loading"],
    ol: ["start", "reversed"],
    th: ["colspan", "rowspan", "scope"],
    td: ["colspan", "rowspan"],
    col: ["span"],
    input: ["type", "checked", "disabled"],
    div: ["data-oembed-url"],
    oembed: ["url"],
    iframe: ["src", "allow", "allowfullscreen", "frameborder", "title", "loading"],
  },

  allowedStyles: {
    "*": {
      "text-align": [/^(left|right|center|justify|start|end)$/],
      "margin-left": LENGTH,
      color: COLOR,
      "background-color": COLOR,
      "font-size": LENGTH,
      width: LENGTH,
      height: LENGTH,
      "aspect-ratio": [/^[\d.\s/]+$/],
      "list-style-type": [/^[a-z-]+$/],
    },
    figure: TABLE_STYLES,
    table: TABLE_STYLES,
    td: TABLE_STYLES,
    th: TABLE_STYLES,
    // Responsive wrapper CKEditor puts around embedded videos
    div: {
      position: [/^relative$/],
      "padding-bottom": LENGTH,
      height: LENGTH,
    },
    iframe: {
      position: [/^absolute$/],
      top: LENGTH,
      left: LENGTH,
      width: LENGTH,
      height: LENGTH,
    },
  },

  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesByTag: { img: ["https", "http"], iframe: ["https"] },
  allowProtocolRelative: false,
  allowedIframeHostnames: EMBED_HOSTS,
  allowIframeRelativeUrls: false,

  // Drop images/embeds whose src was removed as unsafe
  exclusiveFilter: (frame) =>
    (frame.tag === "img" || frame.tag === "iframe") && !frame.attribs.src,

  transformTags: {
    // Links opened in a new tab must not get access to window.opener
    a: (tagName, attribs) => {
      if (attribs.target !== "_blank") {
        const { target, ...rest } = attribs;
        return { tagName, attribs: rest };
      }
      return { tagName, attribs: { ...attribs, rel: "noopener noreferrer" } };
    },
    // Only read-only checkboxes (to-do lists)
    input: (tagName, attribs) => ({
      tagName,
      attribs: {
        type: "checkbox",
        disabled: "disabled",
        ...(attribs.checked !== undefined ? { checked: "checked" } : {}),
      },
    }),
  },
};

export function sanitizeBlogContent(html = "") {
  if (typeof html !== "string") return "";
  return sanitizeHtml(html, OPTIONS).trim();
}

// True when the content has real text, an image or an embed
export function hasMeaningfulContent(html = "") {
  if (/<(img|iframe|oembed)\b/i.test(html)) return true;
  return Boolean(sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;/g, "")
    .trim());
}
