import React, { useState, useEffect } from 'react';
import { ArrowRight, Lock } from 'lucide-react';
import { UserSettings, ViewState, DEFAULT_MODEL } from './types';
import { StorageService } from './services/storage';
import { GeminiService } from './services/geminiService';
import Dashboard from './components/Dashboard';
import SavedMeals from './components/SavedMeals';
import Settings from './components/Settings';

const App: React.FC = () => {
  const [viewState, setViewState] = useState<ViewState>('SETUP');
  const [settings, setSettings] = useState<UserSettings | null>(null);
  
  // Setup State
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [isValidating, setIsValidating] = useState(false);

  useEffect(() => {
    const existingSettings = StorageService.getSettings();
    if (existingSettings) {
      setSettings(existingSettings);
      setViewState('DASHBOARD');
    }
  }, []);

  const handleSetup = async () => {
    if (!apiKeyInput.trim()) return;
    
    setIsValidating(true);
    try {
      const isValid = await GeminiService.validateKey(apiKeyInput, DEFAULT_MODEL);
      if (isValid) {
        const newSettings: UserSettings = {
          apiKey: apiKeyInput,
          calorieGoal: 2000, // Default
          activeModel: DEFAULT_MODEL
        };
        StorageService.saveSettings(newSettings);
        setSettings(newSettings);
        setViewState('DASHBOARD');
      } else {
        alert("Invalid API Key or Model access denied. Please check your key.");
      }
    } catch (e) {
      alert("Error validating key");
    } finally {
      setIsValidating(false);
    }
  };

  if (viewState === 'SETUP') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <div className="mb-8 p-4 bg-surface rounded-full border border-slate-800 shadow-[0_0_30px_rgba(6,182,212,0.15)]">
          <Lock size={48} className="text-primary" />
        </div>
        
        <h1 className="text-3xl font-bold text-white mb-2">TrackMacros</h1>
        <p className="text-slate-400 mb-8 max-w-xs">
          Get started with nutrition tracking powered by AI.
        </p>

        <div className="w-full max-w-sm flex flex-col gap-4">
          <input 
            type="password"
            placeholder="Enter Gemini API Key"
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-4 text-white focus:ring-2 focus:ring-primary outline-none transition-all"
          />
          
          <button 
            onClick={handleSetup}
            disabled={isValidating || !apiKeyInput}
            className="w-full bg-primary hover:bg-cyan-600 text-white font-bold py-4 rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-cyan-900/20"
          >
            {isValidating ? 'Verifying...' : 'Start Tracking'}
            {!isValidating && <ArrowRight size={20} />}
          </button>
        </div>
        
        <p className="mt-8 text-xs text-slate-600">
          Your API key is stored locally on your device.
        </p>
      </div>
    );
  }

  // Authenticated Views
  if (!settings) return null; // Should not happen if not in SETUP

  return (
    <>
      {viewState === 'DASHBOARD' && (
        <Dashboard 
          settings={settings} 
          setViewState={setViewState} 
        />
      )}
      {viewState === 'SAVED_MEALS' && (
        <SavedMeals 
          settings={settings} 
          setViewState={setViewState} 
        />
      )}
      {viewState === 'SETTINGS' && (
        <Settings 
          settings={settings} 
          setViewState={setViewState} 
          onSettingsChange={setSettings}
        />
      )}
    </>
  );
};

export default App;