import { scrapeVenues } from "./scraper";
import fs from "fs";

(async () => {
  const venues = await scrapeVenues();
  fs.writeFileSync("venues.json", JSON.stringify(venues, null, 2));
  console.log(`Saved ${venues.length} venues to venues.json`);
})();
