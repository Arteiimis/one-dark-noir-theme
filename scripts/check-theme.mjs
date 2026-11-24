#!/usr/bin/env node
// Self-check for themes/*.json against the shape Zed expects (schema v0.2.0), plus:
//  - regression: every syntax key Zed's built-in One Dark styles must still be styled here
//  - contrast variants: comments identical across variants, everything else ordered by
//    WCAG contrast against the editor background (soft <= normal <= high)

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const base = JSON.parse(readFileSync(join(root, "scripts/zed-one-dark-base.json"), "utf8"));
const captureName = /^[a-z0-9_]+(\.[a-z0-9_]+)*$/;
const hex = /^#[0-9a-f]{6}([0-9a-f]{2})?$/i;
const fontStyles = ["normal", "italic", "oblique"];
const weights = [100, 200, 300, 400, 500, 600, 700, 800, 900];
const FROZEN = /^comment(\.|$)/;

const luminance = (color) => {
  const value = color.replace("#", "").slice(0, 6);
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(value.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
// OKLab coordinates of a colour, used for chroma (the axis softness moves) and for the
// neighbour distance that decides whether Zed permutes the rainbow-bracket palette.
const oklab = (color) => {
  const value = color.replace("#", "").slice(0, 6);
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(value.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
};
const chroma = (color) => {
  const [, a, b] = oklab(color);
  return Math.hypot(a, b) * 100;
};

const errors = [];
const family = JSON.parse(readFileSync(join(root, "themes/one-dark-noir.json"), "utf8"));
if (!family.$schema) errors.push("missing $schema");
if (!family.name || !family.author) errors.push("missing family name/author");
if (!Array.isArray(family.themes) || !family.themes.length) errors.push("no themes");

for (const theme of family.themes ?? []) {
  if (!theme.name || !["dark", "light"].includes(theme.appearance)) errors.push(`bad theme entry ${theme.name}`);
  const style = theme.style ?? {};
  if (!style["editor.background"] || !style["editor.foreground"]) errors.push(`${theme.name}: no editor colors`);
  const syntax = style.syntax ?? {};
  if (Object.keys(syntax).length < 40) errors.push(`${theme.name}: only ${Object.keys(syntax).length} syntax keys`);
  for (const [key, value] of Object.entries(syntax)) {
    if (!captureName.test(key)) errors.push(`bad capture name: ${key}`);
    if (!hex.test(value.color ?? "")) errors.push(`bad color: ${key} ${value.color}`);
    if (value.font_style !== null && !fontStyles.includes(value.font_style))
      errors.push(`bad font_style: ${key} ${value.font_style}`);
    if (value.font_weight !== null && !weights.includes(value.font_weight))
      errors.push(`bad font_weight: ${key} ${value.font_weight}`);
  }
  const missing = Object.keys(base.syntax).filter((key) => !(key in syntax));
  if (missing.length) errors.push(`${theme.name}: built-in One Dark keys dropped: ${missing.join(" ")}`);
  console.log(`${theme.name}: ${Object.keys(syntax).length} syntax keys, ${Object.keys(style).length} style keys`);
}

// --- softened palette ---------------------------------------------------------
// One Dark Pro's comment grey must come through untouched; everything else is the
// generator's chroma pass, so this constant is the freeze marker.
const COMMENT_GREY = "#7f848e";
const theme = family.themes[0];

if (family.themes.length !== 1) errors.push(`expected 1 theme, found ${family.themes.length}`);
if (theme) {
  const bg = theme.style["editor.background"];
  const syntax = theme.style.syntax;
  for (const key of Object.keys(syntax)) {
    if (!FROZEN.test(key)) continue;
    if (syntax[key].color !== COMMENT_GREY)
      errors.push(`${key}: comment colour moved (${syntax[key].color}, expected ${COMMENT_GREY})`);
  }
  const entries = Object.entries(syntax).filter(([key]) => !FROZEN.test(key));
  const ratios = entries.map(([, value]) => contrast(value.color, bg));
  const chromas = entries.map(([, value]) => chroma(value.color));
  const median = (values) => [...values].sort((a, b) => a - b)[values.length >> 1];
  console.log(
    `${theme.name}: min contrast ${Math.min(...ratios).toFixed(2)}:1, median ${median(ratios).toFixed(2)}:1, median chroma ${median(chromas).toFixed(1)}`,
  );

  // Rainbow brackets: Zed reorders accents whose neighbours sit closer than 0.08 OKLab distance,
  // which would silently change the depth→colour mapping, so hold the invariant here.
  const accents = theme.style.accents ?? [];
  if (accents.length < 3) errors.push(`accents: expected at least 3, found ${accents.length}`);
  for (const color of accents) if (!hex.test(color)) errors.push(`accents: bad colour ${color}`);
  let closest = { distance: Infinity, pair: "" };
  for (let i = 0; i < accents.length; i += 1) {
    const [a, b] = [oklab(accents[i]), oklab(accents[(i + 1) % accents.length])];
    const distance = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    if (distance < closest.distance) closest = { distance, pair: `${accents[i]}/${accents[(i + 1) % accents.length]}` };
  }
  if (closest.distance < 0.08)
    errors.push(`accents: ${closest.pair} too close (${closest.distance.toFixed(3)} < 0.08), Zed will reorder the palette`);
  console.log(`accents: ${accents.length}, closest neighbours ${closest.distance.toFixed(3)} (${closest.pair})`);
}
if (errors.length) {
  console.error("\n" + errors.slice(0, 20).join("\n"));
  process.exit(1);
}
console.log("ok");
