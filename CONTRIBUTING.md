# Contributing

Thanks for helping improve Devistic JSON Beautify. The app is a client-side formatter: parsing, repair, and text transforms should stay in the browser, with no analytics and no server storage.

## Setup

```bash
npm install
npm test
npm run lint
npm run dev
```

The dev server prints a local URL. Production builds use the base path `/devistic-json-beautify/`.

## Pull requests

1. Open an issue for larger changes so the approach can be agreed first.
2. Keep TypeScript strict. Do not add `any` to get past the checker.
3. Add or update unit tests for parser, unescape, repair, and text behavior in `src/lib`.
4. Run `npm test`, `npm run lint`, and `npm run build` before you push.
5. Describe the user-facing change in the pull request. Screenshots help for UI work.

## Project layout

- `src/lib/json` holds validation, repair, unwrapping, and formatting. Keep these functions pure.
- `src/lib/text` holds the text cleaners and case conversions.
- `src/components` is the page. It should call the library, not reimplement parsing.

## Privacy

Do not add trackers, remote fonts, or a backend that receives document text. Settings belong in `localStorage`.

## Reporting issues

Use the bug and feature templates. Contact is the GitHub profile only: https://github.com/devistic-asim
