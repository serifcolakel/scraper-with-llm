import puppeteer from "puppeteer";
import { extractWithLLM } from "./llm";
import { BASE_URL, CSS_SELECTOR, REQUIRED_KEYS } from "./config";
import { isCompleteVenue, isDuplicate } from "./utils";

export async function scrapeVenues() {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--disable-gpu",
      "--window-size=1920x1080",
    ],
  });

  const page = await browser.newPage();

  // Set a realistic user agent
  await page.setUserAgent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
  );

  // Set extra headers to look more like a real browser
  await page.setExtraHTTPHeaders({
    "Accept-Language": "en-US,en;q=0.9",
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    Connection: "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
  });

  let pageNumber = 1;
  let run = true;
  const allVenues: any[] = [];
  const seenNames = new Set<string>();

  while (run) {
    try {
      const url = `${BASE_URL}?page=${pageNumber}`;
      console.log(`Fetching page ${pageNumber}...`);

      // Add a random delay between requests
      await new Promise((resolve) =>
        setTimeout(resolve, Math.random() * 2000 + 1000)
      );

      await page.goto(url, {
        waitUntil: "networkidle0",
        timeout: 30000,
      });

      // Wait for the content to be visible
      await page.waitForSelector(CSS_SELECTOR, { timeout: 5000 });

      const content = await page.$$eval(CSS_SELECTOR, (els) =>
        els.map((el) => el.innerHTML).join("\n")
      );

      if (content.includes("No Results Found")) {
        console.log("No more pages to scrape.");
        run = false;
        break;
      }

      const venues = await extractWithLLM(content);
      const valid = venues.filter(
        (v) =>
          isCompleteVenue(v, REQUIRED_KEYS) && !isDuplicate(v.name, seenNames)
      );
      valid.forEach((v) => seenNames.add(v.name));
      allVenues.push(...valid);

      console.log(`Page ${pageNumber}: Found ${valid.length} valid venues`);
      pageNumber += 1;
    } catch (error) {
      console.error(`Error on page ${pageNumber}:`, error);
      break;
    }
  }

  await browser.close();
  return allVenues;
}
