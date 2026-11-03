#!/usr/bin/env node
// Self-check for themes/*.json against the shape Zed expects (schema v0.2.0) plus a
// regression check against Zed's built-in One Dark: every syntax key that theme styles
// must still be styled here, so no capture quietly loses its color.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const base = JSON.parse(readFileSync(join(root, "scripts/zed-one-dark-base.json"), "utf8"));
const captureName = /^[a-z0-9_]+(\.[a-z0-9_]+)*$/;
const hex = /^#[0-9a-f]{6}([0-9a-f]{2})?$/i;
const fontStyles = ["normal", "italic", "oblique"];
const weights = [100, 200, 300, 400, 500, 600, 700, 800, 900];

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

if (errors.length) {
  console.error("\n" + errors.join("\n"));
  process.exit(1);
}
console.log("ok");
