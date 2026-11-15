// The estimate prompt and reply format, shared by the app (own-key path) and
// the edge function (free public path). No imports, so both can load it.

export const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    name: { type: 'STRING', description: 'Short descriptive meal name, at most 6 words.' },
    calories: { type: 'NUMBER' },
    protein: { type: 'NUMBER', description: 'grams' },
    carbs: { type: 'NUMBER', description: 'grams' },
    fats: { type: 'NUMBER', description: 'grams' },
    addedSugar: { type: 'NUMBER', description: 'grams of added sugar only, not natural sugar' },
    date: { type: 'STRING', description: 'YYYY-MM-DD the meal was eaten' },
    time: { type: 'STRING', description: 'HH:mm, 24-hour, the meal was eaten' },
    serving: { type: 'STRING', description: 'For a nutrition label only: which column was read, e.g. "per serving (30 g)" or "per 100 g"' },
  },
  required: ['name', 'calories', 'protein', 'carbs', 'fats', 'addedSugar', 'date', 'time'],
};

/**
 * @param text what the user typed (may be empty when only a photo was sent)
 * @param today the user's local date, YYYY-MM-DD
 * @param now the user's local time, HH:mm (24-hour)
 */
export const buildPrompt = (text: string, today: string, now: string) => `You are a nutrition expert estimating the content of one meal.

Current local date: ${today}. Current local time: ${now} (24-hour).
${text ? `The user wrote: "${text}"` : 'The user sent a photo with no description.'}

Do this:
1. Identify the food and estimate the portion actually shown or described.
2. Estimate calories, protein, carbs, fats and ADDED sugar (sugar added in cooking or processing; not sugar naturally in fruit or milk) for that portion.
3. Work out when it was eaten. If the user gives a day or time ("yesterday", "at 8am", "on the 10th"), resolve it against the current date and time. A named meal with no time means a typical time for it (breakfast 08:30, lunch 13:00, dinner 20:00). Otherwise use the current date and time. Never return a future date.
4. Give a short, plain name for the meal.

Round every number to a whole number. Reply with JSON only.`;

export const buildLabelPrompt = (text: string, today: string, now: string) => `The photo shows the nutrition information printed on a food package. Read the printed values. Do not estimate.

Current local date: ${today}. Current local time: ${now} (24-hour).
${text ? `The user added: "${text}"` : ''}

Do this:
1. Read energy in kcal, protein, carbohydrate, fat and added sugars. If added sugars are not printed, use total sugars. If energy is printed only in kJ, divide by 4.184.
2. Use the per-serving column if the label has one. Otherwise use the per 100 g (or per 100 ml) column.
3. In "serving", say which column you read and its size, for example "per serving (30 g)" or "per 100 g".
4. In "name", give the product name if it is visible. Otherwise use "Packaged food".
5. Use the current date and time for "date" and "time".

If the photo does not show a nutrition label, set every number to 0 and "name" to "No label found".
Round every number to a whole number. Reply with JSON only.`;

export type EstimateMode = 'meal' | 'label';

/** The request body for Gemini's generateContent method. */
export const buildRequest = (text: string, today: string, now: string, imageBase64?: string, mode: EstimateMode = 'meal') => ({
  contents: [
    {
      parts: [
        { text: (mode === 'label' ? buildLabelPrompt : buildPrompt)(text.trim().slice(0, 300), today, now) },
        ...(imageBase64 ? [{ inline_data: { mime_type: 'image/jpeg', data: imageBase64 } }] : []),
      ],
    },
  ],
  generationConfig: {
    responseMimeType: 'application/json',
    responseSchema: RESPONSE_SCHEMA,
    // A meal estimate needs little reasoning; thinking is billed as output.
    thinkingConfig: { thinkingLevel: 'low' },
  },
});
