# One Dark Noir

One Dark Pro's colors for Zed. The syntax palette is generated from the VS Code theme's `tokenColors` and mapped onto Zed's tree-sitter captures; the UI colors follow Zed's built-in One Dark, and the seven rainbow-bracket accents come from One Dark Pro's accent set.

## Install

- Marketplace: `zed: extensions` → **One Dark Noir** → **Install**.
- From source: `zed: extensions` → **Install Dev Extension** → pick this repository.

Then select it: `zed: theme selector` → **One Dark Noir**.

## Configuration

```json
{
  "theme": "One Dark Noir"
}
```

Any color can be overridden without editing the theme file:

```json
{
  "theme_overrides": {
    "One Dark Noir": {
      "accents": ["#c678dd", "#98c379", "#e06c75", "#61afef", "#e5c07b", "#56b6c2", "#d19a66"],
      "syntax": {
        "comment": { "color": "#7f848e", "font_style": "italic" }
      }
    }
  }
}
```

`accents` also drives rainbow brackets when `"colorize_brackets": true`, so overriding it changes both bracket colors and the accent-tinted UI.

## License

MIT; syntax colors derived from [One Dark Pro](https://github.com/Binaryify/OneDark-Pro) by Binaryify.
