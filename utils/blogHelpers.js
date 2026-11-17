// Helpers that turn a raw request body (JSON or multipart/form-data)
// into clean, validated Blog fields.

import {
  sanitizeBlogContent,
  hasMeaningfulContent,
} from "./sanitizeBlogContent.js";

export const BLOG_STATUSES = ["draft", "published"];

export function cleanText(value, maxLength) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

// Keeps Unicode letters, marks and numbers so Bangla slugs work too.
export function normalizeSlug(value) {
  if (typeof value !== "string") return "";

  return value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s-]/gu, "")
    .replace(/[\s-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 200);
}

// Multipart forms send arrays as JSON strings.
function parseArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string" || !value.trim()) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Fallback: "tag one, tag two"
    return value.split(",");
  }
}

export function cleanTags(value) {
  const tags = parseArray(value)
    .filter((tag) => typeof tag === "string")
    .map((tag) => tag.trim().slice(0, 40))
    .filter(Boolean);

  return [...new Set(tags)].slice(0, 20);
}

export function cleanFaqs(value) {
  return parseArray(value)
    .map((faq) => ({
      question: cleanText(faq?.question, 200),
      answer: cleanText(faq?.answer, 1000),
    }))
    .filter((faq) => faq.question && faq.answer)
    .slice(0, 10);
}

// Builds the update/create object. With partial=true only the fields
// present in the body are validated and returned (used by PUT).
export function buildBlogData(body = {}, { partial = false } = {}) {
  const data = {};
  const has = (key) => body[key] !== undefined;
  const include = (key) => !partial || has(key);

  if (include("title")) {
    data.title = cleanText(body.title, 200);
    if (!data.title) return { error: "Title is required." };
  }

  if (include("slug")) {
    data.slug = normalizeSlug(body.slug);
    if (!data.slug) return { error: "A valid slug is required." };
  }

  if (include("content")) {
    // Strip anything the editor cannot produce (XSS protection)
    data.content = sanitizeBlogContent(body.content);
    if (!hasMeaningfulContent(data.content)) {
      return { error: "Content is required." };
    }
  }

  if (include("category")) data.category = cleanText(body.category, 60);
  if (include("tags")) data.tags = cleanTags(body.tags);
  if (include("excerpt")) data.excerpt = cleanText(body.excerpt, 300);
  if (include("seoTitle")) data.seoTitle = cleanText(body.seoTitle, 70);
  if (include("seoDescription")) {
    data.seoDescription = cleanText(body.seoDescription, 170);
  }
  if (include("focusKeyword")) {
    data.focusKeyword = cleanText(body.focusKeyword, 80);
  }
  if (include("faqs")) data.faqs = cleanFaqs(body.faqs);

  if (include("status")) {
    data.status = body.status ?? "draft";
    if (!BLOG_STATUSES.includes(data.status)) {
      return { error: "Status must be either draft or published." };
    }
  }

  return { data };
}
