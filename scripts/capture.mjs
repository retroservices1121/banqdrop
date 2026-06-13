// Uses the system Edge (Chromium) via puppeteer-core — no bundled browser download.
// Two jobs:
//   1) Render the real banqdrop bucket logo into PWA icons (white bucket on ink).
//   2) Capture real screenshots of the running /app for the landing page.
//
//   (dev server must be running on :3200)  ->  node scripts/capture.mjs

import puppeteer from "puppeteer-core";
import { readFileSync, writeFileSync } from "node:fs";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const BASE = "http://localhost:3200";
const logoDataUri =
  "data:image/png;base64," + readFileSync("public/brand/logo.png").toString("base64");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function clickText(page, text) {
  return page.evaluate((t) => {
    const els = [...document.querySelectorAll("button,a")];
    const el = els.find((e) => (e.textContent || "").trim().includes(t));
    if (el) { el.click(); return true; }
    return false;
  }, text);
}

async function renderIcons(browser) {
  const page = await browser.newPage();
  // white bucket (filter recolors the dark logo) centered on the ink brand tile.
  const tile = (S, { radius, pad }) => `<!doctype html><html><body style="margin:0">
    <div style="width:${S}px;height:${S}px;background:#0d0f1a;border-radius:${radius}px;
      display:flex;align-items:center;justify-content:center;overflow:hidden">
      <img src="${logoDataUri}" style="width:${100 - pad}%;height:${100 - pad}%;
        object-fit:contain;filter:brightness(0) invert(1)"/>
    </div></body></html>`;

  const jobs = [
    { file: "public/icons/icon-192.png", S: 192, radius: 42, pad: 36 },
    { file: "public/icons/icon-512.png", S: 512, radius: 112, pad: 36 },
    { file: "public/icons/maskable-512.png", S: 512, radius: 0, pad: 50 },
    { file: "public/icons/apple-touch-icon.png", S: 180, radius: 0, pad: 32 },
    { file: "public/icons/favicon-32.png", S: 32, radius: 7, pad: 26 },
  ];
  for (const j of jobs) {
    await page.setViewport({ width: j.S, height: j.S, deviceScaleFactor: 1 });
    await page.setContent(tile(j.S, j), { waitUntil: "load" });
    const buf = await page.screenshot({
      clip: { x: 0, y: 0, width: j.S, height: j.S },
      omitBackground: true,
    });
    writeFileSync(j.file, buf);
    console.log("  icon", j.file);
  }
  await page.close();
}

async function renderOG(browser) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
  const dot = (c) => `<span style="width:34px;height:34px;border-radius:50%;background:${c}"></span>`;
  const html = `<!doctype html><html><body style="margin:0">
    <div style="width:1200px;height:630px;background:#0d0f1a;color:#fff;display:flex;align-items:center;
      gap:60px;padding:0 96px;box-sizing:border-box;
      font-family:ui-sans-serif,system-ui,'Segoe UI',Roboto,sans-serif">
      <img src="${logoDataUri}" style="width:240px;height:240px;object-fit:contain;
        filter:brightness(0) invert(1);flex:none"/>
      <div>
        <div style="font-size:88px;font-weight:600;letter-spacing:-3px">banqdrop</div>
        <div style="font-size:40px;color:rgba(255,255,255,.65);margin-top:6px">Money that lands splits itself.</div>
        <div style="margin-top:30px;display:flex;gap:16px">${dot("#22c55e")}${dot("#3b82f6")}${dot("#a855f7")}${dot("#f59e0b")}</div>
      </div>
    </div></body></html>`;
  await page.setContent(html, { waitUntil: "load" });
  await sleep(200);
  writeFileSync("public/og.png", await page.screenshot({ clip: { x: 0, y: 0, width: 1200, height: 630 } }));
  console.log("  og.png");
  await page.close();
}

// Hide dev-only chrome (the mock dev harness + Next's dev indicator) so the
// marketing screenshots show only the real product.
async function clean(page) {
  await page.addStyleTag({
    content:
      "nextjs-portal,[data-nextjs-toast],[data-nextjs-dev-tools-button],#__next-build-watcher{display:none!important}",
  });
  await page.evaluate(() => {
    for (const s of document.querySelectorAll("section")) {
      if ((s.textContent || "").toLowerCase().includes("dev harness")) s.style.display = "none";
    }
  });
}

async function shootApp(browser) {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await page.goto(`${BASE}/app`, { waitUntil: "load" });

  // Onboard
  await page.waitForSelector('input[type="email"]', { timeout: 15000 });
  await page.type('input[type="email"]', "demo@banqdrop.app");
  await clickText(page, "Open my account");
  await page.waitForFunction(() => document.body.innerText.includes("Ready to spend"), {
    timeout: 20000,
  });

  // Fund $1,000 so buckets show real amounts, then refresh the snapshot.
  await page.evaluate(async () => {
    await fetch("/api/dev/fund", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ amountUsd: 1000 }),
    });
  });
  await page.reload({ waitUntil: "load" });
  await page.waitForFunction(() => document.body.innerText.includes("Ready to spend"));
  await clean(page);
  await sleep(600);
  writeFileSync("public/screens/app-buckets.png", await page.screenshot());
  console.log("  shot app-buckets");

  // Split editor
  await clickText(page, "Edit split");
  await page.waitForFunction(() => document.body.innerText.includes("/ 100%"));
  await clean(page);
  await sleep(400);
  writeFileSync("public/screens/app-split.png", await page.screenshot());
  console.log("  shot app-split");
  await clickText(page, "Done");
  await sleep(300);

  // Card tab → activate
  await clickText(page, "Card");
  await sleep(600);
  if (await page.evaluate(() => document.body.innerText.includes("Activate card"))) {
    await clickText(page, "Activate card");
    await page.waitForFunction(() => !document.body.innerText.includes("Issuing…"), {
      timeout: 10000,
    });
    await sleep(600);
  }
  await clean(page);
  await sleep(300);
  writeFileSync("public/screens/app-card.png", await page.screenshot());
  console.log("  shot app-card");

  await page.close();
}

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: true,
  args: ["--no-sandbox", "--hide-scrollbars"],
});
try {
  console.log("rendering icons from the real bucket logo…");
  await renderIcons(browser);
  console.log("rendering OG image…");
  await renderOG(browser);
  console.log("capturing /app screenshots…");
  await shootApp(browser);
} finally {
  await browser.close();
}
console.log("done.");
