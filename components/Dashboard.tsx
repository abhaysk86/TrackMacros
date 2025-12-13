import React, { useState, useEffect, useMemo } from 'react';
import { ChefHat, Settings, Zap } from 'lucide-react';
import { UserSettings, MealLog, SavedMeal, ViewState } from '../types';
import { StorageService } from '../services/storage';
import TrendChart from './TrendChart';
import MealLogger from './MealLogger';
import Footer from './Footer';

interface DashboardProps {
  settings: UserSettings;
  setViewState: (view: ViewState) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ settings, setViewState }) => {
  const [logs, setLogs] = useState<MealLog[]>([]);
  const [savedMeals, setSavedMeals] = useState<SavedMeal[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  
  // Refresh data on mount and when returning to dashboard
  useEffect(() => {
    setLogs(StorageService.getLogs());
    setSavedMeals(StorageService.getSavedMeals());
  }, []);

  const dailyLogs = useMemo(() => {
    return StorageService.getLogsForDate(selectedDate);
  }, [logs, selectedDate]);

  // FIXED: Added Math.round to prevent "939.18000" decimals in totals
  const dailyTotals = useMemo(() => {
    return dailyLogs.reduce((acc, log) => ({
      calories: Math.round(acc.calories + log.calories),
      protein: Math.round(acc.protein + log.protein),
      carbs: Math.round(acc.carbs + log.carbs),
      fats: Math.round(acc.fats + log.fats),
      addedSugar: Math.round(acc.addedSugar + log.addedSugar),
    }), { calories: 0, protein: 0, carbs: 0, fats: 0, addedSugar: 0 });
  }, [dailyLogs]);

  const handleLogAdded = (newLog: MealLog) => {
    // Optimistically update
    setLogs(prev => [newLog, ...prev]);
  };

  const handleDeleteLog = (id: string) => {
    if (confirm("Delete this log?")) {
      StorageService.deleteLog(id);
      setLogs(prev => prev.filter(l => l.id !== id));
    }
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) {
      setSelectedDate(new Date(e.target.value));
    }
  };

  const isToday = new Date().toDateString() === selectedDate.toDateString();

  return (
    <div className="min-h-screen flex flex-col bg-background p-4 pb-20">
      {/* Header */}
      <header className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-slate-800 rounded-full border border-primary/30">
            <Zap className="text-primary fill-primary" size={24} />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-100">TrackMacros</h1>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setViewState('SAVED_MEALS')}
            className="p-2 bg-slate-800 rounded-full text-accent hover:bg-slate-700 transition-colors border border-slate-700"
          >
            <ChefHat size={20} />
          </button>
          <button 
            onClick={() => setViewState('SETTINGS')}
            className="p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white hover:bg-slate-700 transition-colors border border-slate-700"
          >
            <Settings size={20} />
          </button>
        </div>
      </header>

      {/* Goal & Summary */}
      <div className="mb-6">
        <div className="flex justify-between items-end mb-2 px-1">
          <span className="text-slate-400 text-sm">Goal: {settings.calorieGoal} kcal</span>
          <div className="h-2 w-full max-w-[100px] bg-slate-800 rounded-full ml-4 overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-500" 
              style={{ width: `${Math.min((dailyTotals.calories / settings.calorieGoal) * 100, 100)}%` }}
            ></div>
          </div>
        </div>

        {/* Big Calorie Box */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 text-center border border-slate-700 shadow-xl mb-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 rounded-full blur-2xl -mr-8 -mt-8"></div>
          <h2 className="text-5xl font-bold text-white mb-1">{dailyTotals.calories}</h2>
          <p className="text-primary font-medium text-sm tracking-wide uppercase">Calories Consumed</p>
        </div>

        {/* Macros Grid */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Protein', val: dailyTotals.protein, color: 'text-green-400' },
            { label: 'Carbs', val: dailyTotals.carbs, color: 'text-blue-400' },
            { label: 'Fats', val: dailyTotals.fats, color: 'text-yellow-400' },
            { label: 'Sugar', val: dailyTotals.addedSugar, color: 'text-rose-400' },
          ].map((m) => (
            <div key={m.label} className="bg-surface rounded-xl p-3 text-center border border-slate-800 flex flex-col justify-center">
              <span className={`text-lg font-bold ${m.color}`}>{m.val}g</span>
              <span className="text-[10px] text-slate-500 uppercase font-semibold">{m.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Trend */}
      <TrendChart logs={logs} />

      <div className="h-6"></div>

      {/* Logger */}
      {isToday && (
        <MealLogger 
          settings={settings} 
          onLogAdded={handleLogAdded} 
          savedMeals={savedMeals}
        />
      )}

      {/* Log List Header */}
      <div className="flex justify-between items-center mb-4 mt-2">
        <h3 className="text-lg font-bold text-white">
          {isToday ? "Today's Log" : "History"}
        </h3>
        <input 
          type="date" 
          value={selectedDate.toISOString().split('T')[0]}
          onChange={handleDateChange}
          className="bg-slate-800 text-slate-300 text-sm px-3 py-1 rounded-lg border border-slate-700 outline-none"
        />
      </div>

      {/* List */}
      <div className="flex flex-col gap-3">
        {dailyLogs.length === 0 ? (
          <div className="text-center text-slate-500 py-8 bg-surface rounded-xl border border-slate-800 border-dashed">
            No meals logged for this date.
          </div>
        ) : (
          dailyLogs.map(log => (
            <div key={log.id} className="bg-surface p-4 rounded-xl border border-slate-800 flex justify-between items-center group">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-slate-200">{log.name}</span>
                  <span className="text-xs text-slate-500 bg-slate-900 px-2 py-0.5 rounded">
                    {new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </span>
                </div>
                {/* FIXED: Added Sugar to the display list & Rounded numbers */}
                <div className="text-xs text-slate-400">
                  {Math.round(log.calories)} kcal • P: {Math.round(log.protein)} • C: {Math.round(log.carbs)} • F: {Math.round(log.fats)} • S: {Math.round(log.addedSugar)}
                </div>
              </div>
              {log.imageUri && (
                <img src={log.imageUri} alt="Meal" className="w-12 h-12 rounded-md object-cover ml-2 border border-slate-700" />
              )}
              <button 
                onClick={() => handleDeleteLog(log.id)}
                className="ml-3 p-2 text-slate-600 hover:text-red-500 transition-colors"
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>

      <Footer />
    </div>
  );
};

export default Dashboard;
