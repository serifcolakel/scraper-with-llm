export function isCompleteVenue(venue: any, keys: string[]): boolean {
  return keys.every((key) => key in venue);
}

export function isDuplicate(name: string, seen: Set<string>): boolean {
  return seen.has(name);
}
