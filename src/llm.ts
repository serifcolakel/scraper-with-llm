import axios from "axios";

export async function extractWithLLM(content: string): Promise<any[]> {
  const prompt = `
      Extract venue information from the following HTML content.
      Return a JSON array of venue objects with fields:
      name, price, location, capacity, rating, reviews, description.
      Use null if any field is missing.
      Content:
      ${content}
      Example JSON:
      [
        {
          "name": "Venue Name",
          "price": 1000,
          "location": "123 Venue St, City, State",
          "capacity": 200,
          "rating": 4.5,
          "reviews": 50,
          "description": "A beautiful venue for weddings."
        }
      ]
      Return only the JSON array, no other text.
  `;

  const response = await axios.post("http://localhost:11434/api/generate", {
    model: "llama3.2",
    prompt,
    stream: false,
  });

  const text = response.data.response.trim();
  try {
    return JSON.parse(text);
  } catch {
    console.error("Failed to parse LLM response:", text);
    return [];
  }
}
