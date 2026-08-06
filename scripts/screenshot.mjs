import puppeteer from "puppeteer";
import fs from "fs";

const BASE = "http://localhost:5180";
const OUT = "./screens";
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT);

const pages = [
  { path: "/login", name: "01_login", auth: false },
  { path: "/", name: "02_dashboard" },
  { path: "/depenses", name: "03_depenses" },
  { path: "/recettes", name: "04_recettes" },
  { path: "/autorisations", name: "05_autorisations" },
  { path: "/analyses", name: "06_analyses" },
  { path: "/flux", name: "07_flux" },
  { path: "/journal", name: "08_journal" },
];

const browser = await puppeteer.launch({ headless: "new", defaultViewport: { width: 1440, height: 900 } });
const page = await browser.newPage();

// login first
await page.goto(BASE + "/login", { waitUntil: "networkidle0" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle0" });
await page.click('button ::-p-text("admin")').catch(() => {});
const buttons = await page.$$("button");
for (const b of buttons) {
  const t = await page.evaluate((el) => el.textContent, b);
  if (t.trim() === "admin") { await b.click(); break; }
}
await page.click('button[type="submit"]');
await new Promise((r) => setTimeout(r, 600));

for (const p of pages) {
  if (p.path === "/login") continue;
  await page.goto(BASE + p.path, { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 900)); // let animations/charts settle
  await page.screenshot({ path: `${OUT}/${p.name}.png` });
  console.log("captured", p.name);
}

await browser.close();
console.log("done");
