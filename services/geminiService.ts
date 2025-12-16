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
  detectedTimestamp?: string; // We expect a full ISO string from AI now
}

export const GeminiService = {
  validateKey: async (apiKey: string, model: string): Promise<boolean> => {
    try {
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
    knownMealNames: string[] = [] // <--- CHANGE 1: Accept the list of saved meal names
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

    // CRITICAL FIX: Send full verbose time so AI understands "Yesterday" vs "Today"
    const now = new Date();
    const fullTimeContext = now.toLocaleString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric', 
      hour: 'numeric', 
      minute: 'numeric',
      hour12: true 
    });
    // e.g. "Saturday, December 13, 2025 at 11:15 PM"

    // CHANGE 2: Format the known items for the prompt
    const knownItemsString = knownMealNames.length > 0 
      ? knownMealNames.join(", ") 
      : "None";
    
    const prompt = `
      You are an expert nutritionist. Analyze the provided image and text.
      
      CONTEXT:
      - Current System Time: "${fullTimeContext}"
      - User Input: "${description}"
      
      TASK:
      1. Identify the food items.
      2. MATCHING LOGIC (CRITICAL):
         - Check if the User Input matches a name in KNOWN_ITEMS.
         - **STRICT ADJECTIVE RULE**: 
           If User Input contains a specific modifier (e.g., "Black", "Cappuccino") that is NOT in the KNOWN_ITEM name, **DO NOT MATCH**.
           
           *Example A:* User="Black Coffee", Known="Standard Coffee" -> NO MATCH (Adjective conflict).
           *Example B:* User="Standard Coffee", Known="Standard Coffee" -> MATCH.
           
         - IF MATCH: Use the EXACT name from KNOWN_ITEMS as 'detectedName'.
         - IF NO MATCH: Create a new descriptive 'detectedName' (e.g., "Black Coffee") and estimate macros from scratch.
      3. Estimate nutrition (Calories, P, C, F, Sugar). Round to nearest integer.
      4. TIME TRAVEL CALCULATION (Crucial):
         - Based on the "Current System Time", calculate the exact timestamp the user meant.
         - Example 1: If Current is "Dec 13" and user says "for 10th Dec at 5pm", the target is Dec 10, 17:00.
         - Example 2: If user says "Yesterday breakfast", and Current is Saturday Dec 13, the target is Friday Dec 12, 09:00.
         - Example 3: If no time mentioned, use Current System Time.
         - OUTPUT: Return the final calculated time as an ISO 8601 String (e.g., "2025-12-10T17:00:00.000").
      5. Provide a descriptive name.

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
              // We ask AI to do the math and give us the final string
              finalIsoTimestamp: { type: Type.STRING, description: "The calculated ISO 8601 timestamp for the meal." },
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

      return {
        detectedName: result.detectedName,
        macros: result.macros,
        // Map the AI's "finalIsoTimestamp" to our internal "detectedTimestamp"
        detectedTimestamp: result.finalIsoTimestamp 
      };

    } catch (error: any) {
      console.error("Analysis Error:", error);
      alert(`Analysis Failed: ${error.message}`);
      throw error;
    }
  }
};
