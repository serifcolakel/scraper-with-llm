import puppeteer from "puppeteer";
import { extractWithLLM } from "./llm";
import { BASE_URL, CSS_SELECTOR, REQUIRED_KEYS } from "./config";
import { isCompleteVenue, isDuplicate } from "./utils";

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      const delay = initialDelay * Math.pow(2, i);
      console.log(`Attempt ${i + 1} failed, retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

export async function scrapeVenues() {
  const browser = await puppeteer.launch({
    headless: false,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();

  let pageNumber = 1;
  let run = true;
  const allVenues: any[] = [];
  const seenNames = new Set<string>();

  while (run) {
    try {
      const url = `${BASE_URL}?page=${pageNumber}`;
      console.log(`Fetching page ${pageNumber}...`);

      // Add a random delay between requests (2-5 seconds)
      await new Promise((resolve) =>
        setTimeout(resolve, Math.random() * 3000 + 2000)
      );

      await retryWithBackoff(async () => {
        await page.goto(url, {
          waitUntil: "domcontentloaded", // Changed from networkidle0 to be less strict
          timeout: 30000,
        });

        // Wait for the content to be visible with retry
        await retryWithBackoff(async () => {
          await page.waitForSelector(CSS_SELECTOR, { timeout: 10000 });
        });
      });

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
      // If we get a protocol error, wait longer and try again
      if (error instanceof Error && error.message.includes("protocol")) {
        console.log(
          "Protocol error detected, waiting 30 seconds before retry..."
        );
        await new Promise((resolve) => setTimeout(resolve, 30000));
        continue;
      }
      // For other errors, break after 3 consecutive failures
      if (pageNumber > 1) {
        console.log("Breaking due to consecutive errors");
        break;
      }
    }
  }

  await browser.close();
  return allVenues;
}
