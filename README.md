# Kyowa

Kyowa hides files inside an image. Each hidden file is encrypted with its own
passphrase before being written into the image's pixel data, so an image
that looks completely ordinary can carry one or more encrypted documents,
notes, or files.

## Features

- Hide any number of files inside a PNG or JPEG image
- Each hidden file has its own passphrase (AES-CBC, key derived with PBKDF2)
- Choice of hashing scheme for the hiding-pattern seed: SHA-256, SHA-512, or
  Argon2id (memory-hard, slower on purpose — see [Security notes](#security-notes))
- Drag an image straight from another browser tab, or choose one from disk
- Built-in text editor for quick notes, with search across all decrypted
  notes (jumps to the match, selects it, and scrolls it into view)
- Collapsible entries in the hidden-file list, so a note can stay open
  alongside the search bar without scrolling through the rest of the list
- Try a list of candidate passphrases against every still-encrypted file at once
- Live storage gauge showing how much of the image's capacity is used, with
  visual warning zones for images that would become visibly altered
- Light / dark theme

## How it works

Kyowa hides data using steganography:

- **PNG carriers** use the least-significant bits of the image's ARGB channels.
- **JPEG carriers** use the least-significant bits of the image's DCT
  (frequency-domain) coefficients, chosen so the changes stay within the
  range the JPEG encoder already tolerates.

Each hidden file is serialized, AES-encrypted with a passphrase-derived key,
and written bit-by-bit into positions selected by a hash of the passphrase —
so retrieving a file requires knowing (or trying) its passphrase. Unrelated
hidden files in the same image can each use a different passphrase.

### Security notes

- The **hashing scheme selector** (SHA-256 / SHA-512 / Argon2id) only
  controls how the *hiding pattern* (which pixel/coefficient positions are
  used) is derived from the passphrase. It does not change how individual
  files are encrypted — that always uses AES-CBC with a PBKDF2-SHA256
  derived key, regardless of this setting.
- Argon2id is intentionally slow (memory-hard), which raises the cost of
  brute-forcing the hiding pattern. It runs with a random salt: the app
  stores the salt alongside the hidden data besides the image itself.

> **Note:** this project is a personal / educational tool. The cryptography
> and steganography have not been independently audited; do not rely on it
> to protect anything sensitive.

## Getting started

```bash
bun install
bun run dev
```

Runs the app in development mode with Vite. Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

### Opening an image

- Click **"Choose an image"**, or
- Drag an image directly from another browser tab and drop it onto the
  image zone (works even for images from other websites — most Chromium
  browsers materialize the dropped file regardless of that site's CORS
  settings, since the drop target is a different page).

### Available scripts

- `bun run dev` / `bun start` — start the Vite development server
- `bun test` — run the test suite with Vitest
- `bun run build` — build a production bundle in `build/` (also generates the offline-caching service worker)
- `bun run preview` — serve the production build locally to verify it

## Tech stack

- React + TypeScript, built with [Vite](https://vitejs.dev/)
- PrimeReact (unstyled) with a Tailwind CSS passthrough theme
- `crypto-js` (SHA-256/512) and `hash-wasm` (Argon2id) for hashing, the Web
  Crypto API for AES encryption/decryption
- `upng` for PNG encoding/decoding
- A custom JPEG encoder/decoder for direct access to DCT coefficients
- Vitest for tests
- Workbox for the offline service worker
