# Screenshots

These PNGs appear in the main README. They are captured from the bundled demo
data (the `demo/` folder), so they contain only neutral content. Keep it that
way: never commit screenshots of personal files into this public repo.

Current shots: `chat.png`, `source.png`, `scan.png`, `dark-light.png`.

## Regenerate

```bash
# 1. Seed the demo and start the app
npm run seed
# Use neutral folder names in the scan shot:
SCAN_ROOTS='C:/Users/you/Desktop,C:/Users/you/Documents,C:/Users/you/Downloads' npm run dev

# 2. Capture (Playwright is not a project dependency, install it on demand)
npm i -D playwright
npx playwright install chromium
node scripts/screenshots.mjs
```

The script drives the real app: it scopes to the Demo collection, asks a coffee
question, then captures the chat, a source view, the scan modal, and dark mode.
