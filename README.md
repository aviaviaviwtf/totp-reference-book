# TOTP Reference Book

A standalone browser tool for turning an authenticator setup into six-month reference books, [a la this viral reel](https://www.instagram.com/p/DgA6IDKO9FN/)

## Run locally

Install Node.js 22.13 or later, then:

```sh
git clone https://github.com/aviaviaviwtf/totp-reference-book.git
cd totp-reference-book
npm ci
npm run dev
```

Open the localhost URL printed by Vite. That's it!

## Create a book

1. Upload a PNG, JPEG, or WebP of a setup QR code, scan it with the camera, or paste the setup key/`otpauth://` link.
2. If you are enrolling a new authenticator, enter the current code into the service that issued the setup.
3. Select your options
4. Review the book pages and cover, and download your pdfs.

The supported setup is TOTP with six digits and a 30-second period (SHA-1, SHA-256, or SHA-512). Books use US Letter interiors; cover geometry follows the established casewrap template.

## Local processing

Everything in this repo runs in the browser, locally, and isn't cached to localStorage. Refreshing or closing the page will clear the session.

Fonts, JavaScript, and the public QR illustration are bundled with the app and served locally. The code has no analytics or upload endpoint. The platform shortcuts and Instagram footer open external pages only when clicked.

A note: A downloaded PDF or printed book contains usable authentication codes for its dates. Keep it private. A book stops working if the service changes or revokes its setup key.

## Build and check

```sh
npm test
npm run build
npm run preview
```

The production build is static files in `dist/`. Serve that directory at the root of a static host over HTTPS. Opening `index.html` directly as a `file://` URL is not supported because the app uses workers and fetches bundled fonts. Installation needs access to npm; the running local application does not need a printing or payment service.

## Edit

- Website wording: `src/strings.json`
- Four-step interface: `src/workbench/Studio.tsx`
- Website styles: `src/workbench/workbench.css`
- Book interior: `src/pdf.worker.ts`
- Cover and spine: `lib/cover.ts`
- Cover PNG guide: `lib/workbench/template.ts`
- Code generation and timezones: `lib/totp.ts`

## License

Code is licensed under the [MIT License](LICENSE). Bundled fonts retain their own licenses in `public/fonts/`.
