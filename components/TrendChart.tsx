import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { MealLog, DailySummary } from '../types';
import { getStartOfDay } from '../services/storage';

interface TrendChartProps {
  logs: MealLog[];
}

const TrendChart: React.FC<TrendChartProps> = ({ logs }) => {
  const data = useMemo(() => {
    // Generate last 10 days
    const result: DailySummary[] = [];
    const today = new Date();
    
    for (let i = 9; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const start = getStartOfDay(d);
      
      // Aggregate logs for this day
      // Note: This is simple aggregation. In a prod app, optimizing this map/reduce is better.
      const daysLogs = logs.filter(l => {
        const logDate = new Date(l.timestamp);
        return getStartOfDay(logDate) === start;
      });

      const totalCalories = daysLogs.reduce((acc, curr) => acc + curr.calories, 0);

      result.push({
        date: d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
        calories: totalCalories,
        protein: 0, carbs: 0, fats: 0, addedSugar: 0 // Unused for this specific chart view
      });
    }
    return result;
  }, [logs]);

  return (
    <div className="w-full h-48 mt-4 bg-surface rounded-xl p-2 border border-slate-800">
      <h3 className="text-slate-400 text-xs font-semibold mb-2 ml-2">10 Day Calorie Trend</h3>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorCalories" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <XAxis 
            dataKey="date" 
            tick={{fontSize: 10, fill: '#64748b'}} 
            axisLine={false} 
            tickLine={false}
            interval={2} 
          />
          <YAxis 
            hide 
          />
          <Tooltip 
            contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', fontSize: '12px', color: '#f1f5f9' }}
            itemStyle={{ color: '#06b6d4' }}
            labelStyle={{ color: '#94a3b8' }}
          />
          <Area 
            type="monotone" 
            dataKey="calories" 
            stroke="#06b6d4" 
            fillOpacity={1} 
            fill="url(#colorCalories)" 
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default TrendChart;