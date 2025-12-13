import React, { useState } from 'react';
import { ArrowLeft, CheckCircle, AlertTriangle, Trash2, RefreshCcw, Save, Activity } from 'lucide-react';
import { UserSettings, ViewState, DEFAULT_MODEL } from '../types';
import { GeminiService } from '../services/geminiService';
import { StorageService } from '../services/storage';
import Footer from './Footer';

interface SettingsProps {
  settings: UserSettings;
  setViewState: (view: ViewState) => void;
  onSettingsChange: (s: UserSettings) => void;
}

const Settings: React.FC<SettingsProps> = ({ settings, setViewState, onSettingsChange }) => {
  const [diagnosticStatus, setDiagnosticStatus] = useState<'IDLE' | 'RUNNING' | 'OK' | 'FAIL'>('IDLE');
  const [model, setModel] = useState(settings.activeModel);
  const [goal, setGoal] = useState(settings.calorieGoal.toString());

  const handleSave = () => {
    const newSettings = {
      ...settings,
      activeModel: model,
      calorieGoal: parseInt(goal) || 2000
    };
    StorageService.saveSettings(newSettings);
    onSettingsChange(newSettings);
    alert("Settings saved successfully.");
  };

  const runDiagnostics = async () => {
    setDiagnosticStatus('RUNNING');
    const isValid = await GeminiService.validateKey(settings.apiKey, model);
    
    if (isValid) {
      setDiagnosticStatus('OK');
    } else {
      // Try to self-heal by switching to default model if current is weird
      if (model !== DEFAULT_MODEL) {
        const canHeal = await GeminiService.validateKey(settings.apiKey, DEFAULT_MODEL);
        if (canHeal) {
          setModel(DEFAULT_MODEL);
          setDiagnosticStatus('OK');
          alert(`Diagnostics: Switched model to ${DEFAULT_MODEL} to fix connection.`);
          // Auto save the fix
          const newSettings = { ...settings, activeModel: DEFAULT_MODEL };
          StorageService.saveSettings(newSettings);
          onSettingsChange(newSettings);
        } else {
          setDiagnosticStatus('FAIL');
        }
      } else {
        setDiagnosticStatus('FAIL');
      }
    }
  };

  const factoryReset = () => {
    if (confirm("WARNING: This will delete ALL data, including your API Key and Logs. This cannot be undone.")) {
      StorageService.clearAll();
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 pb-20 flex flex-col">
      <header className="flex items-center gap-4 mb-8">
        <button onClick={() => setViewState('DASHBOARD')} className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition-colors">
          <ArrowLeft size={20} className="text-slate-300" />
        </button>
        <h1 className="text-xl font-bold text-white">Settings</h1>
      </header>

      <div className="flex flex-col gap-6">
        
        {/* Calorie Goal */}
        <section className="bg-surface p-4 rounded-xl border border-slate-800">
          <h2 className="text-slate-200 font-bold mb-4">Daily Goals</h2>
          <div className="flex flex-col gap-2">
            <label className="text-xs text-slate-500 uppercase">Calorie Target</label>
            <input 
              type="number" 
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded p-3 text-white focus:border-primary outline-none"
            />
          </div>
        </section>

        {/* AI Configuration */}
        <section className="bg-surface p-4 rounded-xl border border-slate-800">
          <h2 className="text-slate-200 font-bold mb-4 flex items-center gap-2">
            <Activity size={18} className="text-primary" /> System & Diagnostics
          </h2>
          
          <div className="flex flex-col gap-4">
            <div>
              <label className="text-xs text-slate-500 uppercase block mb-1">Active Model</label>
              <input 
                type="text" 
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-white text-sm font-mono focus:border-primary outline-none"
              />
            </div>

            <div className="flex items-center justify-between bg-slate-900 p-3 rounded-lg border border-slate-800">
              <div className="flex items-center gap-3">
                {diagnosticStatus === 'IDLE' && <div className="w-3 h-3 rounded-full bg-slate-600" />}
                {diagnosticStatus === 'RUNNING' && <RefreshCcw size={16} className="text-primary animate-spin" />}
                {diagnosticStatus === 'OK' && <CheckCircle size={16} className="text-green-500" />}
                {diagnosticStatus === 'FAIL' && <AlertTriangle size={16} className="text-red-500" />}
                <span className="text-sm text-slate-300">
                  {diagnosticStatus === 'IDLE' ? 'System Ready' : 
                   diagnosticStatus === 'RUNNING' ? 'Checking Connection...' :
                   diagnosticStatus === 'OK' ? 'All Systems Operational' : 'Connection Failed'}
                </span>
              </div>
              <button 
                onClick={runDiagnostics}
                className="text-xs bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded transition-colors"
              >
                Run Test
              </button>
            </div>
          </div>
        </section>

        <button 
          onClick={handleSave}
          className="w-full py-3 bg-primary text-white font-bold rounded-lg hover:bg-cyan-600 transition-colors flex justify-center items-center gap-2"
        >
          <Save size={18} /> Save Changes
        </button>

        {/* Danger Zone */}
        <section className="mt-8">
          <button 
            onClick={factoryReset}
            className="w-full py-4 border border-red-900/50 bg-red-950/20 text-red-500 font-bold rounded-xl hover:bg-red-900/30 transition-colors flex justify-center items-center gap-2"
          >
            <Trash2 size={18} /> Factory Reset App
          </button>
          <p className="text-center text-xs text-slate-600 mt-2">
            This will permanently delete your API key and all logged data.
          </p>
        </section>
      </div>

      <Footer />
    </div>
  );
};

export default Settings;