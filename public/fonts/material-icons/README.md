# Legacy Material Icons fallback

These unmodified upstream files are distributed under the adjacent Apache-2.0 LICENSE.
Source: https://github.com/google/material-design-icons/tree/bd8cb85bd4bad964fe6918f79665bb40c3a8efef/font

- MaterialIcons-Regular.ttf SHA-256: ef149f08bdd2ff09a4e2c8573476b7b0f3fbb15b623954ade59899e7175bedda
- MaterialIcons-Regular.codepoints SHA-256: 530f25bf7b2d71c8e1da9476d53f9a9bb6b7e187bff69bb7128bb679b8194894

The codepoint JSON in src/lib/utils/material-icon-codepoints.json maps every line of the upstream inventory to its Unicode character. Existing Lucide mappings take precedence. This font supplies only valid names that have no existing mapping; it does not replace Next UI's icon design or use Google Fonts at runtime.

The inventory contains 2,235 rows and 2,234 unique names: `flourescent` appears twice with identical glyph outlines. The JSON retains the last entry for that name.
