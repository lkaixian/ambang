// Fills the live site's answer cache by clicking every suggested question in the real page, so the page builds the exact prompts.
// node warm_cache.js [url] [--dry]   --dry lists what it would ask and sends nothing.
const { chromium } = require("playwright"), fs = require("fs");
const URL = process.argv.find(a => a.startsWith("http")) || "https://ambang.my/", DRY = process.argv.includes("--dry");
const PACE = 700; // ms between uncached calls. Needs RATE_PER_MIN raised on the server (the default 15 would stop this); nginx allows 300/min
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  await p.goto(URL, { waitUntil: "networkidle" });
  const dests = await p.evaluate(() => Object.keys(PANEL)), out = [];
  let planned = 0;
  for (const scheme of ["ewm", "equal"]) {
    await p.click(`#wseg button[data-w="${scheme}"]`);
    for (const about of ["", ...dests]) {
      await p.evaluate(a => AMBANG_ASK.open(a), about);
      await p.waitForSelector("#askChips .chip");
      const qs = await p.$$eval("#askChips .chip", e => e.map(x => x.textContent));
      for (let i = 0; i < qs.length; i++) {
        planned++;
        if (DRY) { console.log(scheme, about || "(overview)", "|", qs[i]); continue; }
        let r;
        for (let tries = 0; tries < 3; tries++) {
          const [resp] = await Promise.all([p.waitForResponse(x => x.url().includes("/api/ai") && x.request().method() === "POST", { timeout: 150000 }), p.locator("#askChips .chip").nth(i).click()]);
          const j = await resp.json().catch(() => ({}));
          r = { scheme, about, q: qs[i], status: resp.status(), cache: resp.headers()["x-cache"] || "", text: j.text || j.error || "" };
          if (r.status !== 429) break;
          await sleep(((j.retryAfter || 30) + 3) * 1000);
        }
        await p.waitForFunction(() => !document.querySelector("#askSend").disabled, null, { timeout: 150000 });
        out.push(r); console.log(r.status, r.cache.padEnd(6), scheme, about || "(overview)", "|", qs[i]);
        await sleep(r.cache === "MISS" ? PACE : 300);
      }
    }
  }
  if (!DRY) { fs.writeFileSync("warm_results.json", JSON.stringify(out, null, 1)); const c = k => out.filter(r => r.cache === k).length; console.log(`done: ${out.length} asked, ${c("MISS")} new, ${c("HIT")} already cached, ${out.filter(r => r.status !== 200).length} failed`); }
  else console.log(`dry run: ${planned} questions`);
  await b.close();
})();
