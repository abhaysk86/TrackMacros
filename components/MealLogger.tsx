import React, { useState, useRef } from 'react';
import { Camera, Loader2, Send } from 'lucide-react';
import { GeminiService, fileToGenerativePart } from '../services/geminiService';
import { MealLog, UserSettings, SavedMeal } from '../types';
import { StorageService } from '../services/storage';

interface MealLoggerProps {
  settings: UserSettings;
  onLogAdded: (log: MealLog) => void;
  savedMeals: SavedMeal[];
}

const MealLogger: React.FC<MealLoggerProps> = ({ settings, onLogAdded, savedMeals }) => {
  const [inputText, setInputText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedImage(e.target.files[0]);
    }
  };

  const handleLog = async () => {
    if (!inputText.trim() && !selectedImage) return;

    setIsAnalyzing(true);
    try {
      let logData: MealLog;
      
      // 1. Check for Saved Meal Match
      const normalizedInput = inputText.trim().toLowerCase();
      const matchedSavedMeal = !selectedImage ? savedMeals.find(sm =>
        sm.name.toLowerCase() === normalizedInput ||
        sm.keywords.some(k => k.toLowerCase() === normalizedInput)
      ) : null;

      // 2. Check complexity (Does the user want a specific time?)
      // If input has numbers (9am), "at", "yesterday", or is much longer than the meal name.
      const hasTimeContext = /\d|at |on |yesterday|today|tomorrow/i.test(inputText);

      // SCENARIO A: Saved Meal + Simple Input (e.g. "Standard Coffee")
      // -> Instant Log (No AI) - KEEPS THE SPEED YOU LIKE
      if (matchedSavedMeal && !hasTimeContext) {
        logData = {
          ...matchedSavedMeal,
          id: crypto.randomUUID(),
          timestamp: Date.now(), 
          imageUri: undefined
        };
      } 
      // SCENARIO B: Everything else (New Meal OR Saved Meal + Time Context)
      // -> Call AI
      else {
        const imageBase64 = selectedImage ? await fileToGenerativePart(selectedImage) : undefined;
        
        const analysis = await GeminiService.analyzeMeal(
          settings.apiKey, 
          settings.activeModel, 
          inputText, 
          imageBase64
        );

        let timestamp = Date.now();
        if (analysis.detectedTimestamp) {
            timestamp = new Date(analysis.detectedTimestamp).getTime();
        }

        // If we found a saved meal match locally, we prefer ITS macros over the AI's guess.
        // But we use the AI's calculated TIMESTAMP.
        if (matchedSavedMeal) {
            logData = {
                ...matchedSavedMeal, // Use accurate saved P/C/F
                id: crypto.randomUUID(),
                timestamp: timestamp, // Use AI's accurate time
                imageUri: undefined
            };
        } else {
            // Full AI result
            logData = {
                id: crypto.randomUUID(),
                name: analysis.detectedName,
                ...analysis.macros,
                timestamp: timestamp,
                imageUri: undefined 
            };
        }
      }

      StorageService.addLog(logData);
      onLogAdded(logData);
      
      // Reset
      setInputText('');
      setSelectedImage(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

    } catch (error) {
      alert("Failed to analyze meal. Please check your connection or API key.");
      console.error(error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="bg-surface p-4 rounded-xl border border-slate-800 shadow-lg mb-6">
      <h3 className="text-slate-300 text-sm font-semibold mb-3">Log a Meal</h3>
      
      <div className="flex flex-col gap-3">
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="E.g., 2 eggs and toast at 8:30am, or 'Epigamia Yogurt'"
          className="w-full bg-slate-800 text-white rounded-lg p-3 text-sm focus:ring-2 focus:ring-primary outline-none border border-slate-700 resize-none h-20"
        />

        {selectedImage && (
          <div className="relative w-fit">
            <img 
              src={URL.createObjectURL(selectedImage)} 
              alt="Preview" 
              className="h-16 w-16 object-cover rounded-lg border border-slate-600"
            />
            <button 
              onClick={() => { setSelectedImage(null); if(fileInputRef.current) fileInputRef.current.value = ''; }}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 w-5 h-5 flex items-center justify-center text-xs"
            >
              ×
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <input 
            type="file" 
            ref={fileInputRef} 
            accept="image/*" 
            className="hidden" 
            onChange={handleImageSelect}
          />
          
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-primary rounded-lg transition-colors border border-slate-700 flex-1 justify-center"
          >
            <Camera size={18} />
            <span className="text-sm font-medium">Add Photo</span>
          </button>

          <button 
            onClick={handleLog}
            disabled={isAnalyzing || (!inputText && !selectedImage)}
            className="flex items-center gap-2 px-6 py-3 bg-primary hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-all font-bold shadow-[0_0_15px_rgba(6,182,212,0.3)] flex-[2] justify-center"
          >
            {isAnalyzing ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <>
                <span className="text-sm">Log Meal</span>
                <Send size={16} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MealLogger;
