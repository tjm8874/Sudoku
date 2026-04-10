# Sudoku Infinity

A static Sudoku website built with **HTML + TypeScript** for deployment on **Cloudflare Pages**.

## Features

- Endless puzzle generation in four difficulty levels
- Desktop and mobile friendly UI
- Notes mode and hint button
- JP / EN auto-detect with manual language switch
- Solve counts and in-progress board saved only in `localStorage`
- No server-side logic or database

## Local development

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
```

The static site output is generated in `dist/`.

## Cloudflare Pages

- **Build command:** `npm run build`
- **Build output directory:** `dist`

## GitHub Pages

A workflow is included at `.github/workflows/deploy.yml`.

1. Push this folder to the `main` branch of `tjm8874/Sudoku`
2. In GitHub, open `Settings` → `Pages`
3. Set **Source** to `GitHub Actions`
4. The site will deploy automatically on the next push
