import React, { useState } from 'react';
import { ArrowLeft, Camera, Plus, Save, Trash, Loader2 } from 'lucide-react';
import { SavedMeal, ViewState, UserSettings, Macros } from '../types';
import { StorageService } from '../services/storage';
import { GeminiService, fileToGenerativePart } from '../services/geminiService';
import Footer from './Footer';

interface SavedMealsProps {
  settings: UserSettings;
  setViewState: (view: ViewState) => void;
}

const SavedMeals: React.FC<SavedMealsProps> = ({ settings, setViewState }) => {
  const [savedMeals, setSavedMeals] = useState<SavedMeal[]>(StorageService.getSavedMeals());
  
  // Creation State
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [pendingText, setPendingText] = useState('');
  const [accumulatedMacros, setAccumulatedMacros] = useState<Macros>({ calories: 0, protein: 0, carbs: 0, fats: 0, addedSugar: 0 });
  const [partsCount, setPartsCount] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleAnalyzePart = async (file?: File) => {
    if (!pendingText && !file) return;

    setIsAnalyzing(true);
    try {
      const base64 = file ? await fileToGenerativePart(file) : undefined;
      const result = await GeminiService.analyzeMeal(settings.apiKey, settings.activeModel, pendingText, base64);
      
      setAccumulatedMacros(prev => ({
        calories: prev.calories + result.macros.calories,
        protein: prev.protein + result.macros.protein,
        carbs: prev.carbs + result.macros.carbs,
        fats: prev.fats + result.macros.fats,
        addedSugar: prev.addedSugar + result.macros.addedSugar,
      }));
      
      setPartsCount(prev => prev + 1);
      setPendingText(''); // Clear text after use
      
      // Auto-suggest name if empty
      if (!newName && result.detectedName) {
        setNewName(result.detectedName);
      }

    } catch (e) {
      alert("Analysis failed.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveMeal = () => {
    if (!newName) {
      alert("Please name your meal");
      return;
    }

    const newMeal: SavedMeal = {
      id: crypto.randomUUID(),
      name: newName,
      keywords: newName.split(' '),
      ...accumulatedMacros
    };

    StorageService.addSavedMeal(newMeal);
    setSavedMeals(StorageService.getSavedMeals());
    
    // Reset
    setIsCreating(false);
    setNewName('');
    setAccumulatedMacros({ calories: 0, protein: 0, carbs: 0, fats: 0, addedSugar: 0 });
    setPartsCount(0);
  };

  const deleteSavedMeal = (id: string) => {
    if(confirm("Remove this saved meal?")) {
      StorageService.deleteSavedMeal(id);
      setSavedMeals(StorageService.getSavedMeals());
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 pb-20 flex flex-col">
      <header className="flex items-center gap-4 mb-6">
        <button onClick={() => setViewState('DASHBOARD')} className="p-2 bg-slate-800 rounded-full hover:bg-slate-700">
          <ArrowLeft size={20} className="text-slate-300" />
        </button>
        <h1 className="text-xl font-bold text-white">Saved Meals</h1>
      </header>

      {/* Creator Section */}
      <div className="bg-surface rounded-xl p-4 border border-slate-800 mb-6">
        <h2 className="text-primary font-bold mb-4 flex items-center gap-2">
          <Plus size={18} /> Create New Saved Meal
        </h2>

        <input 
          className="w-full bg-slate-800 p-3 rounded-lg text-white mb-3 border border-slate-700 text-sm"
          placeholder="Meal Name (e.g. My Morning Coffee)"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />

        <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-800/50 mb-3">
          <p className="text-xs text-slate-500 mb-2 font-mono">STEP 1: ADD INGREDIENTS</p>
          <div className="flex gap-2 mb-2">
             <input 
              className="flex-1 bg-slate-800 p-2 rounded text-sm text-white border border-slate-700"
              placeholder="Description (e.g. 1 scoop whey)"
              value={pendingText}
              onChange={(e) => setPendingText(e.target.value)}
            />
            <label className="p-2 bg-slate-700 rounded cursor-pointer hover:bg-slate-600">
              <Camera size={20} className="text-slate-300" />
              <input type="file" className="hidden" accept="image/*" onChange={(e) => {
                if(e.target.files?.[0]) handleAnalyzePart(e.target.files[0]);
              }} />
            </label>
            <button 
              onClick={() => handleAnalyzePart()}
              disabled={!pendingText || isAnalyzing}
              className="px-3 bg-secondary rounded text-white text-xs font-bold hover:bg-blue-600 disabled:opacity-50"
            >
              {isAnalyzing ? <Loader2 className="animate-spin" size={16}/> : 'Add'}
            </button>
          </div>
          <p className="text-xs text-slate-500">
            Current Parts: {partsCount} | Calories: {accumulatedMacros.calories}
          </p>
        </div>

        <button 
          onClick={handleSaveMeal}
          disabled={partsCount === 0}
          className="w-full py-3 bg-primary text-white font-bold rounded-lg hover:bg-cyan-600 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Save size={18} /> Save to Library
        </button>
      </div>

      {/* List Section */}
      <div className="flex flex-col gap-3">
        {savedMeals.map(meal => (
          <div key={meal.id} className="bg-surface p-4 rounded-xl border border-slate-800 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-slate-200">{meal.name}</h3>
              <div className="text-xs text-slate-400 mt-1">
                {meal.calories} kcal | P: {meal.protein} C: {meal.carbs} F: {meal.fats}
              </div>
            </div>
            <button 
              onClick={() => deleteSavedMeal(meal.id)}
              className="p-2 text-slate-600 hover:text-red-500"
            >
              <Trash size={18} />
            </button>
          </div>
        ))}
        {savedMeals.length === 0 && (
          <p className="text-center text-slate-600 text-sm mt-4">No saved meals yet.</p>
        )}
      </div>
      
      <Footer />
    </div>
  );
};

export default SavedMeals;