# One Dark Pro Next

A Zed theme extension that ports the **syntax colors** of the VSCode [One Dark Pro](https://github.com/Binaryify/OneDark-Pro) extension, generated from that extension's own `tokenColors` instead of being eyeballed.

- Source theme: `zhuangtongfa.material-theme` 3.20.3, `themes/OneDark-Pro-mix.json`
- Zed target: 1.26.x, theme schema [`v0.2.0`](https://zed.dev/schema/themes/v0.2.0.json)
- UI colors: Zed's built-in **One Dark** (`scripts/zed-one-dark-base.json`), unchanged. Only `style.syntax` is generated.

What can and cannot move from VSCode to Zed is measured in [MIGRATION.md](./MIGRATION.md) — read that before treating this as a pixel-perfect port.

## Install (dev extension)

```sh
# clone anywhere, then in Zed:
#   command palette -> zed: install dev extension -> pick this directory
#   command palette -> theme selector: toggle -> "One Dark Pro Next"
```

No Rust toolchain is needed: a theme extension is `extension.toml` + `themes/*.json`.

## Regenerate after the source theme updates

```sh
node scripts/gen-theme.mjs                                   # installed One Dark Pro Mix
node scripts/gen-theme.mjs path/to/OneDark-Pro-darker.json    # another variant
```

The script prints how many `tokenColors` blocks fed a key and which keys fell back to the editor foreground. `VERBOSE=1` prints, per Zed capture, the TextMate scope that supplied its color.

To ship another variant, add a second theme object to `themes/one-dark-pro-next.json` (or emit one file per variant — Zed picks up every `themes/*.json`).

## Contrast variants

Zed extensions cannot register settings, so the "contrast knob" is a theme family with three tiers — `theme selector: toggle` picks one, UI colors and backgrounds are identical in all three:

| Theme | Non-comment syntax colors | Comments |
| --- | --- | --- |
| One Dark Pro Next | as migrated from VSCode | as migrated |
| One Dark Pro Next Soft | OKLab lightness ×0.9 | unchanged |
| One Dark Pro Next High Contrast | OKLab lightness +40% toward white | unchanged |

Comments are deliberately frozen in every tier (`/^comment(\.|$)/` in `scripts/gen-theme.mjs`): their grey sits just above the background, so scaling it either washes the code out or makes comments compete with it. Everything else is scaled on the lightness axis only, chroma untouched, so hues stay put.

Measured WCAG contrast of the syntax palette against `editor.background` (min / median): soft `2.90` / `4.50`:1, normal `3.73` / `5.92`:1, high `6.70` / `8.43`:1. `scripts/check-theme.mjs` fails if the ordering or the frozen comments ever drift.

## Semantic tokens

VSCode's `semanticTokenColors` cannot be shipped by a Zed theme: Zed's equivalent lives in
settings (`global_lsp_settings.semantic_token_rules`) and points at capture names. Most entries
already land correctly because the theme defines `variant`, `function.macro` and `variable.builtin`
— the names Zed's default rules resolve to. Two overrides are worth pasting into `settings.json`:

```json
{
  "semantic_tokens": "combined",
  "global_lsp_settings": {
    "semantic_token_rules": [
      { "token_type": "variable", "token_modifiers": ["constant"], "foreground_color": "#d19a66" },
      { "token_type": "memberOperatorOverload", "foreground_color": "#c678dd" }
    ]
  }
}
```

## License

MIT, same as One Dark Pro. See [LICENSE](./LICENSE).
