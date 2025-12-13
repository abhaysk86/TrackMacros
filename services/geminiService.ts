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
  detectedTime?: string; // HH:MM format
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
    currentTimeContext?: string
  ): Promise<AnalysisResult> => {
    const ai = new GoogleGenAI({ apiKey });

    const parts: any[] = [];
    
    if (imageBase64) {
      parts.push({
        inlineData: {
          mimeType: "image/jpeg", // Assuming JPEG for simplicity, can be dynamic
          data: imageBase64
        }
      });
    }

    if (description) {
      parts.push({ text: description });
    }

    const prompt = `
      You are an expert nutritionist. Analyze the provided image (if any) and text description.
      Current System Time: ${currentTimeContext || new Date().toLocaleTimeString()}.
      
      Task:
      1. Identify the food items.
      2. Estimate the total nutrition (Calories, Protein, Carbs, Fats, Added Sugar).
      3. If the user mentions a specific time (e.g., "at 2pm"), extract it in 24h format (HH:MM). If not mentioned, return null for time.
      4. Provide a short, descriptive name for the meal.

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
              detectedTime: { type: Type.STRING, description: "Time of meal in HH:MM 24h format, or null/empty if not specified." },
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