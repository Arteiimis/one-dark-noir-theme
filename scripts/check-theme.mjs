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

const errors = [];
const family = JSON.parse(readFileSync(join(root, "themes/one-dark-pro-next.json"), "utf8"));
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

// --- contrast variants --------------------------------------------------------
const pick = (suffix) => family.themes.find((theme) => theme.name.endsWith(suffix));
const normal = pick("Next");
const soft = pick("Soft");
const high = pick("High Contrast");

if (!normal || !soft || !high) errors.push("missing a contrast variant (Next / Soft / High Contrast)");
else {
  const bg = normal.style["editor.background"];
  for (const key of Object.keys(normal.style.syntax)) {
    const colors = [soft, normal, high].map((theme) => theme.style.syntax[key]?.color);
    if (colors.some((color) => color === undefined)) {
      errors.push(`${key}: missing from a variant`);
      continue;
    }
    if (FROZEN.test(key)) {
      if (new Set(colors).size !== 1) errors.push(`${key}: comments must not change (${colors.join(" ")})`);
      continue;
    }
    const [softRatio, normalRatio, highRatio] = colors.map((color) => contrast(color, bg));
    if (softRatio > normalRatio + 0.001 || normalRatio > highRatio + 0.001)
      errors.push(`${key}: contrast not ordered soft/normal/high (${softRatio.toFixed(2)} ${normalRatio.toFixed(2)} ${highRatio.toFixed(2)})`);
  }
  for (const theme of [soft, normal, high]) {
    const ratios = Object.entries(theme.style.syntax)
      .filter(([key]) => !FROZEN.test(key))
      .map(([, value]) => contrast(value.color, bg));
    console.log(`${theme.name}: min contrast ${Math.min(...ratios).toFixed(2)}:1, median ${ratios.sort((a, b) => a - b)[ratios.length >> 1].toFixed(2)}:1`);
  }
}

if (errors.length) {
  console.error("\n" + errors.slice(0, 20).join("\n"));
  process.exit(1);
}
console.log("ok");
