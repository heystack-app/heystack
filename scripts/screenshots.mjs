// Captures README screenshots from a running app + seeded "Demo" collection.
// Usage: npm run dev (with the Demo collection seeded), then:
//   npm i -D playwright && node scripts/screenshots.mjs
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = "docs/screenshots";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1280, height: 920 },
    deviceScaleFactor: 2,
  });

  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.getByPlaceholder(/What did I write/).waitFor({ timeout: 20000 });

  // Scope to the Demo collection (neutral content).
  try {
    await page.getByRole("button", { name: /All collections/ }).click();
    await page.getByRole("button", { name: /^Demo/ }).click({ timeout: 4000 });
  } catch {
    /* picker shape changed; the coffee content is neutral anyway */
  }

  // Ask a question and wait for the streamed answer to finish.
  await page
    .getByPlaceholder(/What did I write/)
    .fill("How do I make a pour over, and what coffee to water ratio should I use?");
  await page.getByRole("button", { name: "Ask" }).click();
  await page.getByText("Sources", { exact: true }).waitFor({ timeout: 90000 });
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll("button")].some(
        (b) => b.textContent?.trim() === "Ask"
      ),
    { timeout: 90000 }
  );
  await sleep(600);
  await page.screenshot({ path: `${OUT}/chat.png`, fullPage: true });

  // Open a source for the viewer shot. Prefer a markdown source: it renders
  // fully, whereas a PDF iframe is blank in headless Chromium.
  try {
    const md = page.locator("button", { hasText: "Coffee brewing guide" }).first();
    if (await md.count()) await md.click();
    else await page.locator("button", { hasText: "Open source" }).first().click();
    await page.getByRole("button", { name: "Close" }).waitFor({ timeout: 10000 });
    await sleep(900);
    await page.screenshot({ path: `${OUT}/source.png` });
    await page.keyboard.press("Escape");
    await sleep(400);
  } catch (e) {
    console.warn("source shot skipped:", e.message);
  }

  // Scan modal (idle).
  try {
    await page.getByTitle("Scan your computer for documents").click();
    await page.getByText("Scan my computer").waitFor({ timeout: 6000 });
    await sleep(400);
    await page.screenshot({ path: `${OUT}/scan.png` });
    await page.keyboard.press("Escape");
    await sleep(400);
  } catch (e) {
    console.warn("scan shot skipped:", e.message);
  }

  // Dark theme.
  try {
    await page.getByRole("button", { name: "Toggle theme" }).click();
    await sleep(700);
    await page.screenshot({ path: `${OUT}/dark-light.png`, fullPage: true });
  } catch (e) {
    console.warn("dark shot skipped:", e.message);
  }

  await browser.close();
  console.log("Screenshots written to", OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
