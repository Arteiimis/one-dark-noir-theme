#!/usr/bin/env node
// Regenerates themes/<id>.json from a VSCode theme's `tokenColors`.
//
//   node scripts/gen-theme.mjs [path/to/vscode-theme.json]
//
// Default input: the One Dark Pro "Mix" variant as installed by the VSCode extension.
// UI colors are taken unchanged from scripts/zed-one-dark-base.json (Zed's built-in One Dark),
// only `style.syntax` is generated. VSCode `colors` / `semanticTokenColors` are not portable:
// a Zed theme can only style tree-sitter capture names.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src =
  process.argv[2] ??
  join(
    process.env.USERPROFILE ?? process.env.HOME ?? "",
    ".vscode/extensions/zhuangtongfa.material-theme-3.20.3/themes/OneDark-Pro-mix.json",
  );

// Zed capture name -> TextMate scope stacks to look up, most specific first.
// A stack's last element is the token scope; earlier elements are ancestor scopes.
// Zed resolves `a.b` captures by longest dotted-prefix theme key, so every key the
// bundled grammar queries emit (or can emit) needs an entry here.
const SCOPES = {
  attribute: ["entity.other.attribute-name"],
  boolean: ["constant.language.boolean", "constant.language"],
  comment: ["comment"],
  "comment.doc": ["comment.block.documentation", "comment.documentation"],
  "comment.unused": ["comment.unused"],
  constant: ["variable.other.constant", "constant"],
  "constant.builtin": ["support.constant", "constant.language", "constant"],
  constructor: ["entity.name.function.constructor", "support.class", "entity.name.type"],
  "diff.delta": ["markup.changed"],
  "diff.minus": ["markup.deleted"],
  "diff.plus": ["markup.inserted"],
  embedded: ["meta.embedded", "string.quoted.docstring"],
  emphasis: ["markup.italic"],
  "emphasis.markup": ["markup.italic"],
  "emphasis.strong": ["markup.bold"],
  "emphasis.strong.markup": ["markup.bold"],
  enum: ["entity.name.type.enum", "variable.other.enummember"],
  function: ["entity.name.function", "support.function", "meta.function-call"],
  "function.builtin": ["support.function.builtin", "support.function", "entity.name.function"],
  "function.call": ["meta.function-call", "entity.name.function", "support.function"],
  "function.decorator": ["entity.name.function.decorator", "meta.decorator", "entity.name.function"],
  "function.definition": ["entity.name.function", "entity.name.function.definition"],
  "function.method": ["entity.name.function.member", "meta.method-call", "entity.name.function"],
  "function.method.call": ["meta.method-call", "entity.name.function.member", "entity.name.function"],
  "function.macro": ["entity.name.function.macro", "support.function", "entity.name.function"],
  "function.special": ["support.function.magic", "support.function", "entity.name.function"],
  hint: ["comment"],
  keyword: ["keyword"],
  "keyword.control": ["keyword.control"],
  "keyword.declaration": ["storage.type", "keyword.other"],
  "keyword.definition": ["storage.type", "keyword.other"],
  "keyword.directive": ["keyword.other.directive", "keyword.control"],
  "keyword.function": ["storage.type.function", "keyword"],
  "keyword.import": ["keyword.control.import", "keyword.other.import", "keyword.control"],
  "keyword.operator": ["keyword.operator.word", "keyword.operator.wordlike", "keyword.operator"],
  "keyword.preproc": ["meta.preprocessor", "keyword.control.import", "keyword.other"],
  label: ["entity.name.label"],
  lifetime: ["entity.name.type.lifetime", "storage.modifier.lifetime"],
  "link_text.markup": ["string.other.link.title.markdown", "string.other.link.title"],
  "link_uri.markup": ["markup.underline.link.markdown", "markup.underline.link"],
  link_text: ["string.other.link.title.markdown", "string.other.link.title"],
  link_uri: ["markup.underline.link.markdown", "markup.underline.link"],
  "markup.heading": ["entity.name.section.markdown", "markup.heading", "entity.name.section"],
  module: ["entity.name.namespace", "entity.name.module"],
  namespace: ["entity.name.namespace", "entity.name.scope-resolution"],
  number: ["constant.numeric"],
  "number.quantifier.regex": ["keyword.operator.quantifier.regexp", "keyword.operator"],
  operator: ["keyword.operator.arithmetic", "keyword.operator.assignment", "keyword.operator"],
  "operator.regex": ["keyword.operator.regexp", "keyword.operator"],
  predictive: ["comment"],
  preproc: ["meta.preprocessor", "keyword.control.import"],
  primary: ["meta.embedded", "text.html.basic"],
  property: ["variable.other.property", "variable.other.member", "meta.object-literal.key", "support.type.property-name"],
  "property.json_key": ["support.type.property-name.json", "support.type.property-name", "meta.object-literal.key"],
  "property.name": ["meta.object-literal.key", "variable.other.property"],
  punctuation: ["punctuation"],
  "punctuation.bracket": ["punctuation.section", "punctuation.definition", "punctuation"],
  "punctuation.bracket.jsx": ["punctuation.section.embedded", "punctuation.section"],
  "punctuation.bracket.regex": ["punctuation.definition.group.regexp", "punctuation.section"],
  "punctuation.delimiter": ["punctuation.separator", "punctuation"],
  "punctuation.list_marker.markup": ["punctuation.definition.list.markdown", "punctuation.definition.list.begin.markdown"],
  "punctuation.list_marker": ["punctuation.definition.list.markdown", "punctuation.definition.list.begin.markdown"],
  "punctuation.markup": ["punctuation.definition.heading.markdown", "punctuation.definition.markdown"],
  "punctuation.special": ["punctuation.special", "punctuation.definition.template-expression.begin"],
  selector: ["entity.other.attribute-name.class.css", "entity.name.tag.css"],
  "selector.class": ["entity.other.attribute-name.class.css", "entity.other.attribute-name.class"],
  "selector.id": ["entity.other.attribute-name.id.css", "entity.other.attribute-name.id"],
  "selector.pseudo": ["entity.other.attribute-name.pseudo-class.css", "entity.other.attribute-name.pseudo"],
  string: ["string"],
  "string.doc": ["string.quoted.docstring", "comment.block.documentation"],
  "string.escape": ["constant.character.escape"],
  "string.escape.regex": ["constant.character.escape", "string.regexp"],
  "string.regex": ["string.regexp"],
  "string.regexp": ["string.regexp"],
  "string.special": ["string.other", "string"],
  "string.special.path": ["string.other", "string"],
  "string.special.symbol": ["constant.other.symbol", "string.other", "string"],
  "strikethrough.markup": ["markup.strikethrough"],
  tag: ["entity.name.tag"],
  "tag.component.jsx": ["support.class.component", "entity.name.tag"],
  "tag.doctype": ["meta.tag.sgml.doctype", "entity.name.tag.doctype"],
  "text.literal.markup": ["markup.inline.raw.markdown", "markup.raw"],
  "text.literal": ["markup.inline.raw.markdown", "markup.raw"],
  title: ["entity.name.section.markdown", "markup.heading", "entity.name.section"],
  "title.markup": ["entity.name.section.markdown", "markup.heading", "entity.name.section"],
  type: ["entity.name.type", "support.type", "storage.type"],
  "type.builtin": ["support.type.primitive", "storage.type", "entity.name.type"],
  "type.class": ["entity.name.type.class", "entity.name.class"],
  "type.class.definition": ["entity.name.type.class.definition", "entity.name.type.class", "entity.name.class"],
  "type.class.inheritance": ["entity.other.inherited-class", "entity.name.type.class"],
  "type.definition": ["entity.name.type", "storage.type"],
  "type.interface": ["entity.name.type.interface", "entity.name.type"],
  "type.name": ["entity.name.type", "support.type"],
  "type.qualifier": ["storage.modifier", "storage.type"],
  "type.unit": ["keyword.other.unit", "constant.numeric"],
  variable: ["variable"],
  "variable.builtin": ["support.variable", "variable.language"],
  "variable.other.member": ["variable.other.member", "variable.other.property"],
  "variable.parameter": ["variable.parameter"],
  "variable.special": ["variable.language"],
  variant: ["variable.other.enummember", "constant.other.enum"],
};

const vscode = JSON.parse(readFileSync(src, "utf8"));
const base = JSON.parse(readFileSync(join(root, "scripts/zed-one-dark-base.json"), "utf8"));

// Colors the VSCode theme only states in `semanticTokenColors` (its LSP semantic layer).
// The nearest capture uses them, because a Zed theme cannot ship semantic token rules.
const SEMANTIC_HINTS = new Map([
  ["variant", "#56b6c2"], // semanticTokenColors.enumMember
  ["function.macro", "#d19a66"], // semanticTokenColors.macro
]);

// --- VSCode tokenColors -> flat rule list -------------------------------------
// Each tokenColor entry is { scope: "a, b c", settings: { foreground, fontStyle } }.
// VSCode picks the most specific selector per scope; equal specificity -> later rule wins.
const rules = [];
(vscode.tokenColors ?? []).forEach((entry, index) => {
  const scopes = Array.isArray(entry.scope) ? entry.scope : String(entry.scope ?? "").split(",");
  for (const raw of scopes) {
    const parts = raw.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) continue;
    rules.push({ parts, index, settings: entry.settings ?? {} });
  }
});

const matches = (part, scope) => scope === part || scope.startsWith(part + ".");

// Returns the merged settings for one scope stack, applying matches from least to most specific.
function resolve(stack) {
  const hits = [];
  for (const rule of rules) {
    const depth = rule.parts.length;
    if (depth > stack.length) continue;
    const offset = stack.length - depth;
    const ok = rule.parts.every((part, i) => matches(part, stack[offset + i]));
    if (!ok) continue;
    const segments = rule.parts[depth - 1].split(".").length;
    hits.push({ depth: depth * 100, segments, index: rule.index, settings: rule.settings, parts: rule.parts });
  }
  hits.sort((a, b) => a.depth + a.segments - (b.depth + b.segments) || a.index - b.index);

  const style = {};
  let winner = null;
  let specificity = 0;
  for (const { settings, parts, depth, segments } of hits) {
    if (settings.foreground !== undefined) {
      style.color = settings.foreground;
      winner = parts.join(" ");
      specificity = depth + segments;
    }
    if (settings.fontStyle !== undefined) {
      const styles = String(settings.fontStyle).split(/\s+/).filter(Boolean);
      style.font_style = styles.includes("italic") || styles.includes("oblique") ? "italic" : null;
      style.font_weight = styles.includes("bold") ? 700 : null;
    }
  }
  return { style, winner, specificity, ruleIndexes: hits.map((hit) => hit.index) };
}

// --- generate syntax styles --------------------------------------------------
const hex = /^#[0-9a-f]{6}([0-9a-f]{2})?$/i;
const syntax = {};
const usedRules = new Set();
const fallbacks = [];
const textColor = vscode.colors?.["editor.foreground"] ?? base["editor.foreground"];
// captures Zed invented that have no TextMate counterpart at all
const ZED_ONLY = new Set(["hint", "predictive", "primary"]);

for (const key of Object.keys(SCOPES).sort()) {
  let style = null;
  let best = 0;
  for (const candidate of SCOPES[key]) {
    const hit = resolve(candidate.split(/\s+/));
    // A bare `variable` rule also colours `variable.other.member`; prefer the candidate
    // whose winning rule is the most specific, so `meta.object-literal.key` beats `variable`.
    if (hit.style.color && hit.specificity > best) {
      best = hit.specificity;
      style = hit.style;
      for (const index of hit.ruleIndexes) usedRules.add(index);
      if (process.env.VERBOSE) console.log(`  ${key.padEnd(28)} <- ${hit.winner}`);
    }
  }
  if (!style) {
    // Unstyled in VSCode too: the token falls back to the editor foreground color.
    style = ZED_ONLY.has(key) && base.syntax?.[key] ? base.syntax[key] : { color: textColor };
    fallbacks.push(key);
  }
  if (!hex.test(style.color)) throw new Error(`bad color for ${key}: ${style.color}`);
  syntax[key] = {
    color: (SEMANTIC_HINTS.get(key) ?? style.color).toLowerCase(),
    font_style: style.font_style ?? null,
    font_weight: style.font_weight ?? null,
  };
}

// --- contrast variants -------------------------------------------------------
// Comments keep their One Dark color in every variant: the grey they use sits just above the
// background, so scaling its chroma or lightness either washes the code out or makes comments
// compete with it.
const FROZEN = /^comment(\.|$)/;

const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);

function toOklab([r, g, b]) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function fromOklab([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const clamp = (c) => Math.min(1, Math.max(0, c));
  return [
    clamp(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    clamp(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    clamp(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

// Scales chroma in OKLab (perceptually even, hue and lightness preserved).
function scaleChroma(color, factor) {
  const value = color.replace("#", "");
  const alpha = value.length === 8 ? value.slice(6) : "";
  const [L, a, b] = toOklab([0, 2, 4].map((i) => toLinear(parseInt(value.slice(i, i + 2), 16) / 255)));
  const out = fromOklab([L, a * factor, b * factor])
    .map((c) => Math.round(toSrgb(c) * 255))
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
  return `#${out}${alpha}`;
}

function variant(styles, factor) {
  const out = {};
  for (const [key, style] of Object.entries(styles))
    out[key] = FROZEN.test(key) ? style : { ...style, color: scaleChroma(style.color, factor) };
  return out;
}

// Dialled in with _color-lab/soft-lab.html: chroma 0.85, lightness untouched, no grey mix.
const SOFT_CHROMA = 0.85;

const family = {
  $schema: "https://zed.dev/schema/themes/v0.2.0.json",
  name: "One Dark Pro Next",
  author: "Migrated from One Dark Pro by zhuangtongfa / Binaryify",
  themes: [
    { name: "One Dark Pro Next", appearance: "dark", style: { ...base, syntax } },
    {
      name: "One Dark Pro Next Soft",
      appearance: "dark",
      style: { ...base, syntax: variant(syntax, SOFT_CHROMA) },
    },
  ],
};

const out = join(root, "themes/one-dark-pro-next.json");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(family, null, 2) + "\n");

const total = vscode.tokenColors?.length ?? 0;
console.log(`source      ${src}`);
console.log(`rules       ${total} tokenColors, ${rules.length} selectors`);
console.log(`syntax keys ${Object.keys(syntax).length} written to ${out}`);
console.log(`variants    ${family.themes.map((theme) => theme.name).join(" | ")}`);
if (fallbacks.length)
  console.log(`fallback    ${fallbacks.length} (editor foreground): ${fallbacks.join(" ")}`);
console.log(`used        ${usedRules.size}/${total} tokenColors reach at least one Zed key`);
