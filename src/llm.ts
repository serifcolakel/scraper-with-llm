import { Groq } from "groq-sdk";
import dotenv from "dotenv";
// import OpenAI from "openai";

dotenv.config();

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY ?? "",
});

export async function extractWithLLM(content: string): Promise<any[]> {
  const prompt = `
Extract venue information from the following HTML content.
Return a JSON array of venue objects with fields:
name, price, location, capacity, rating, reviews, description.
Use null if any field is missing.
Content:
${content}
`;

  const completion = await groq.chat.completions.create({
    model: "llama3-8b-8192",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
  });

  const json = completion.choices[0]?.message?.content || "[]";
  try {
    return JSON.parse(json);
  } catch {
    console.error("Failed to parse LLM response:", json);
    return [];
  }
}
