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
  detectedTimestamp?: string; // ISO String
}

export const GeminiService = {
  validateKey: async (apiKey: string, model: string): Promise<boolean> => {
    try {
      // Use the stable model
      const SAFE_MODEL = "gemini-2.5-flash"; 
      
      const ai = new GoogleGenAI({ apiKey });
      await ai.models.generateContent({
        model: SAFE_MODEL,
        contents: "Hello",
      });
      return true;
    } catch (e: any) {
      console.error("Key validation failed", e);
      alert(`Debug Error: ${e.message || JSON.stringify(e)}`); 
      return false;
    }
  },

  analyzeMeal: async (
    apiKey: string,
    model: string,
    description: string,
    imageBase64?: string
  ): Promise<AnalysisResult> => {
    const SAFE_MODEL = "gemini-2.5-flash";
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

    const now = new Date();
    const dateContext = now.toDateString(); // "Sat Dec 13 2025"
    
    const prompt = `
      You are an expert nutritionist. Analyze the provided image and text.
      
      CONTEXT:
      - Today's Date: ${dateContext}
      
      TASK:
      1. Identify the food items.
      2. Estimate nutrition (Calories, P, C, F, Sugar). Round to nearest integer.
      3. TIME EXTRACTION:
         - extract "date_override": If user mentions "Yesterday", "10th Dec", return "YYYY-MM-DD". If today, return null.
         - extract "time_override": If user mentions "at 5pm", "for breakfast", return "HH:MM" (24h). If not mentioned, return null.
      4. Provide a descriptive name.

      Return ONLY JSON.
    `;

    try {
      const response = await ai.models.generateContent({
        model: SAFE_MODEL,
        contents: { parts: [{ text: prompt }, ...parts] },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              detectedName: { type: Type.STRING },
              date_override: { type: Type.STRING, nullable: true },
              time_override: { type: Type.STRING, nullable: true },
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
      if (!text) throw new Error("No response");
      
      const result = JSON.parse(text);

      // --- CLIENT SIDE TIME LOGIC (THE FIX) ---
      let finalDate = new Date(); // Start with "Now"

      // 1. Apply Date Override
      if (result.date_override) {
        // Parse YYYY-MM-DD strictly to avoid UTC shifts
        const [year, month, day] = result.date_override.split('-').map(Number);
        finalDate.setFullYear(year, month - 1, day);
      }

      // 2. Apply Time Override
      if (result.time_override) {
        const [hours, minutes] = result.time_override.split(':').map(Number);
        finalDate.setHours(hours, minutes, 0, 0);
      }

      // Return the constructed result
      return {
        detectedName: result.detectedName,
        macros: result.macros,
        detectedTimestamp: finalDate.toISOString()
      };

    } catch (error: any) {
      console.error("Analysis Error:", error);
      alert(`Analysis Failed: ${error.message}`);
      throw error;
    }
  }
};
