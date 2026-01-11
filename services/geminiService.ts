
import { GoogleGenAI, Type } from "@google/genai";
import { Question } from "../types";

// Always use the process.env.API_KEY directly as per guidelines
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateQuestions = async (difficulty: string = 'medium'): Promise<Question[]> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Generate 18 trivia questions for a game called TROUBLE CROSS. 
    Difficulty level: ${difficulty}. 
    Categories should be diverse: Science, Geography, History, Pop Culture, Technology, and some general India-specific knowledge.
    The response must be a JSON array of objects with keys: "text", "answer", and "difficulty".`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            text: { type: Type.STRING },
            answer: { type: Type.STRING },
            difficulty: { type: Type.STRING }
          },
          required: ["text", "answer", "difficulty"]
        }
      }
    }
  });

  try {
    return JSON.parse(response.text);
  } catch (e) {
    console.error("Failed to parse Gemini response", e);
    return [];
  }
};

export const getInnerMindCommentary = async (situation: string): Promise<string> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `You are HOST OS, a dramatic, snarky game engine for a game of betrayal called TROUBLE CROSS. 
    Provide a very short (1 sentence), punchy, dramatic commentary on the current situation: ${situation}.`,
  });

  return response.text.trim();
};
