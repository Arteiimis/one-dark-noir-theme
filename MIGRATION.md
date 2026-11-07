# Can One Dark Pro's coloring be migrated 1:1?

No. Zed has no `tokenColors` and no TextMate scopes; it has a fixed capture vocabulary and a prefix
lookup. This document records what actually crosses over, measured against the installed source theme
(`zhuangtongfa.material-theme` 3.20.3, `themes/OneDark-Pro-mix.json`) and Zed 1.26.2
(`crates/syntax_theme/src/syntax_theme.rs`, `docs/src/extensions/languages.md`,
`crates/grammars/src/*/highlights.scm`).

## The two interfaces side by side

| Layer | VSCode | Zed |
| --- | --- | --- |
| Where colors live | `tokenColors[]` = `{ scope: "a, b.c", settings }` | `themes/*.json` → `themes[].style.syntax` = `{ "<capture>": { color, background_color, font_style, font_weight } }` |
| Vocabulary | any scope string a TextMate grammar emits | capture names emitted by tree-sitter queries: **44 documented**, **46** in Zed's own One Dark, **124** distinct names across the bundled grammars |
| Matching | selector is a segment-prefix of the token scope, may carry ancestor scopes (`meta.function entity.name`) and a language suffix (`… .python`); most specific wins, later rule breaks ties | the theme key must be a **dot-boundary prefix** of the capture name (`SyntaxTheme::highlight_id`); no selectors, no ancestors, no ordering. `function.method` → keys `function.method`, `function` |
| Unknown keys | n/a | allowed (`syntax` is `additionalProperties` in the schema) but inert: a theme cannot invent capture names |
| Attributes | `foreground`, `fontStyle` (`italic bold underline strikethrough`), `background` | `color`, `background_color`, `font_style` (`italic`/`oblique`), `font_weight` (100–900) |
| LSP semantic layer | `semanticTokenColors`: `"type:modifier"` → style, per language, shipped inside the theme | `semantic_tokens` setting (`off`/`combined`/`full`) + `global_lsp_settings.semantic_token_rules` in settings; per-language rules ship as `semantic_token_rules.json` next to the grammar. **Not part of a theme** |
| UI colors | `colors` (223 keys here) | flat `style` (141 keys) + `accents` / `players` |

## What the generator produced

| Metric | Value |
| --- | --- |
| `tokenColors` blocks / selectors in the source | 275 / 462 |
| Selectors pinned to one language (32 ids) | 264 |
| Selectors using a `source.*` / `meta.*` ancestor | 13 / 39 |
| Zed `syntax` keys generated | 101 |
| Capture names in bundled grammars that resolve to a key | 107 of 124 (85 exact) |
| Keys that resolved to no VSCode rule → `editor.foreground` | 6 (`punctuation*`, `diff.delta`, `strikethrough.markup`) |
| Formatting attributes in the source | italic 4 rules, underline 1, bold 0, background 0 |

`scripts/gen-theme.mjs` is the authoritative mapping: its `SCOPES` table lists, per Zed capture, the
TextMate scope stacks that feed it (most specific first). Colors are resolved with VSCode's own
semantics — prefix matching per stack, then the matching rule chain folded from least to most
specific (segment count, then source order), then the candidate whose winning rule is most specific.
The one deliberate exception: `markup.*` captures are markdown-only in Zed, so their candidate lists
use `.markdown`-qualified scopes (`entity.name.section.markdown`, `markup.inline.raw.markdown`) to
avoid picking up a generic rule with a different color.

## What does not cross over

1. **Per-language color overrides.** 264 of 462 selectors are scoped to one of 32 languages
   (`variable.parameter.function.language.special.self.python` = `#e5c07b`,
   `punctuation.separator.c`/`.cpp` = `#c678dd`). One Zed capture serves every language, so those
   become either a global color or nothing. This is the single biggest fidelity loss.
2. **Ancestor-scoped selectors** (`meta.object-literal.key`, `source.js …`) — Zed keys are flat.
   39 + 13 selectors affected; the generator approximates them through the per-capture candidate list.
3. **`semanticTokenColors`** (11 entries). Not shippable by a theme; see the `settings.json` snippet in
   the README. Two entries there have no Zed capture at all (`memberOperatorOverload`, `tomlArrayKey`).
4. **Scopes with no Zed counterpart**: `invalid.*` (9 selectors), `markup.*` in files without a
   markdown grammar, `support.class` for JSX (folded into `tag.component.jsx`).
5. **`fontStyle: underline`** — one rule in the source; theme syntax styles have no underline field.
6. **Workbench `colors`** — out of scope for this port; the UI comes from Zed's built-in One Dark.
7. Per-language grammar *differences*: Zed's queries decide what gets captured at all. A scope VSCode
   styles may never be emitted as a capture in Zed, and vice versa (`enum`, `variant`, `label`,
   `hint`, `predictive` are Zed-only concepts).

## Contrast variants

Zed has no contrast setting and a theme extension cannot add one, so the family ships two themes
(`Next` / `Soft`). Non-comment colors in `Soft` get their OKLab chroma multiplied by 0.85, with
lightness and hue untouched (the number was dialled in with `_color-lab`). `comment*` keys stay
byte-identical in both — scaling the comment grey either washes out the code or makes comments
compete with it. This is a deliberate deviation from a pure port: the source theme has no such
variant.

## Going finer than this theme

- Per-capture tuning: add or change an entry in `SCOPES`, rerun the generator.
- Language-specific colors: Zed cannot vary a capture per language through a theme. The only lever is
  a language extension that ships its own `highlights.scm` and assigns different capture names per
  construct — which a theme extension cannot do.
- Semantic tokens: `semantic_token_rules` in `settings.json`, or `theme_overrides` for one-off tweaks.
