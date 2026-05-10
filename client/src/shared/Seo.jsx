import { useEffect } from "react";
import { buildAppUrl } from "../config/runtime.js";

function setMetaAttribute(selector, createAttributes, value) {
  if (!value) return;

  let tag = document.head.querySelector(selector);
  if (!tag) {
    tag = document.createElement("meta");
    Object.entries(createAttributes).forEach(([name, attrValue]) => {
      tag.setAttribute(name, attrValue);
    });
    document.head.appendChild(tag);
  }

  tag.setAttribute("content", value);
}

function setCanonical(canonicalUrl) {
  if (!canonicalUrl) return;

  let tag = document.head.querySelector("link[rel='canonical']");
  if (!tag) {
    tag = document.createElement("link");
    tag.setAttribute("rel", "canonical");
    document.head.appendChild(tag);
  }

  tag.setAttribute("href", canonicalUrl);
}

export default function Seo({
  title,
  description,
  pathname,
  robots = "index, follow",
  type = "website",
}) {
  useEffect(() => {
    const pageTitle = title ? `${title} | Campus404` : "Campus404";
    const canonicalUrl = buildAppUrl(pathname || window.location.pathname);

    document.title = pageTitle;
    setCanonical(canonicalUrl);
    setMetaAttribute("meta[name='description']", { name: "description" }, description);
    setMetaAttribute("meta[name='robots']", { name: "robots" }, robots);
    setMetaAttribute("meta[property='og:title']", { property: "og:title" }, pageTitle);
    setMetaAttribute("meta[property='og:description']", { property: "og:description" }, description);
    setMetaAttribute("meta[property='og:type']", { property: "og:type" }, type);
    setMetaAttribute("meta[property='og:url']", { property: "og:url" }, canonicalUrl);
    setMetaAttribute("meta[name='twitter:card']", { name: "twitter:card" }, "summary");
    setMetaAttribute("meta[name='twitter:title']", { name: "twitter:title" }, pageTitle);
    setMetaAttribute("meta[name='twitter:description']", { name: "twitter:description" }, description);
  }, [description, pathname, robots, title, type]);

  return null;
}
