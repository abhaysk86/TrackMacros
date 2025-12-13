import { GoogleGenAI, Type } from "@google/genai";
import { Macros } from "../types";

// Helper to convert File to Base64
export const fileToGenerativePart = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = (reader.result as string).split(',')[1];
      resolve(base64String);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

interface AnalysisResult {
  macros: Macros;
  detectedName: string;
  detectedTimestamp?: string; // CHANGED: Now expects full ISO string, not just HH:MM
}

export const GeminiService = {
  validateKey: async (apiKey: string, model: string): Promise<boolean> => {
    try {
      const ai = new GoogleGenAI({ apiKey });
      await ai.models.generateContent({
        model: model,
        contents: "Hello",
      });
      return true;
    } catch (e) {
      console.error("Key validation failed", e);
      return false;
    }
  },

  analyzeMeal: async (
    apiKey: string,
    model: string,
    description: string,
    imageBase64?: string,
    currentTimeContext?: string // We will ignore this param in favor of dynamic calculation below
  ): Promise<AnalysisResult> => {
    const ai = new GoogleGenAI({ apiKey });

    const parts: any[] = [];
    
    if (imageBase64) {
      parts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: imageBase64
        }
      });
    }

    if (description) {
      parts.push({ text: description });
    }

    // NEW: Robust Date Calculation Context
    const now = new Date();
    const dateContext = now.toDateString(); // e.g. "Sat Dec 13 2025"
    const timeContext = now.toLocaleTimeString(); 

    const prompt = `
      You are an expert nutritionist. Analyze the provided image (if any) and text description.
      
      CONTEXT:
      - Today's Date: ${dateContext}
      - Current System Time: ${timeContext}
      
      TASK:
      1. Identify the food items.
      2. Estimate nutrition (Calories, Protein, Carbs, Fats, Added Sugar). 
         IMPORTANT: Round ALL numbers to the nearest whole integer. No decimals.
      3. TIME/DATE ANALYSIS: 
         - If the user mentions a specific date (e.g., "Yesterday", "10th Dec", "Last Friday"), calculate the correct ISO Timestamp for that date.
         - If the user mentions a time (e.g. "at 5pm"), combine it with the identified date.
         - If no date/time is mentioned, use the "Current System Time".
         - Return the final result as a valid ISO 8601 String (e.g., "2025-12-10T17:00:00.000Z").
      4. Provide a short, descriptive name.

      Return ONLY a JSON object.
    `;

    try {
      const response = await ai.models.generateContent({
        model: model,
        contents: { parts: [{ text: prompt }, ...parts] },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              detectedName: { type: Type.STRING },
              detectedTimestamp: { type: Type.STRING, description: "Full ISO 8601 Timestamp of the meal." },
              macros: {
                type: Type.OBJECT,
                properties: {
                  calories: { type: Type.NUMBER },
                  protein: { type: Type.NUMBER },
                  carbs: { type: Type.NUMBER },
                  fats: { type: Type.NUMBER },
                  addedSugar: { type: Type.NUMBER }
                }
              }
            }
          }
        }
      });

      const text = response.text;
      if (!text) throw new Error("No response from AI");
      return JSON.parse(text) as AnalysisResult;

    } catch (error) {
      console.error("Gemini Analysis Error:", error);
      throw error;
    }
  }
};
