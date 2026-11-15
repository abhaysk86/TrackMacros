import { Sheet } from './Sheet';

export type LegalDoc = 'privacy' | 'terms';

export const CONTACT_EMAIL = 'hello@theabhayperspective.com';
const UPDATED = '15 November 2026';

interface Section {
  heading: string;
  body: string[];
}

const PRIVACY: Section[] = [
  {
    heading: 'Who we are',
    body: [
      `MealGlimpse is built and run by The Abhay Perspective. For any question about your data, write to ${CONTACT_EMAIL}.`,
    ],
  },
  {
    heading: 'What stays on your device',
    body: [
      'Your meals, meal photo thumbnails, frequent meals, goals and settings are stored in your browser on this device. They are not sent to us and we cannot see them.',
      'If you add your own Gemini key, it is stored on this device only.',
      'The goal calculator uses your age, height, weight and activity once, on your device, to suggest goals. Those answers are not stored or sent anywhere.',
      'A backup file is created on your device and stays wherever you save it.',
    ],
  },
  {
    heading: 'What leaves your device when you ask for an AI estimate',
    body: [
      "With the free allowance: the photo or text you submit, and your local date and time, are sent to our estimate service (hosted with Supabase in Mumbai, India), which passes them to Google's Gemini API to work out the nutrition figures. We do not store the photo or the text. Under Google's terms for its paid API, this content is not used to improve Google's products.",
      "With your own Gemini key: the photo or text goes straight from your device to Google under your own Google account and its terms. On Google's free tier, Google may use that content to improve its products.",
      'Logging from the food list, from frequent meals, or by entering numbers yourself sends nothing.',
    ],
  },
  {
    heading: 'What our service records',
    body: [
      'To keep the free allowance fair, the service keeps counters: a random id created by this app on your device, a scrambled (hashed) form of your network address, and how many AI estimates each has used per day. These are deleted after 35 days.',
      'It also records the total daily cost of AI estimates. This is not linked to you.',
      'We do not ask for your name, email or phone number, and there are no accounts.',
    ],
  },
  {
    heading: 'Hosting and visit statistics',
    body: [
      'The app is served by Vercel, and the estimate service runs on Supabase. Like any web host, they keep standard technical logs, which can include network addresses, for a limited time.',
      'We use Vercel Web Analytics to count visits in aggregate. It does not use cookies and does not track you across other sites.',
      'We do not show ads and we do not sell or share data for advertising.',
    ],
  },
  {
    heading: 'Your choices',
    body: [
      'Profile has "Delete all my data", which removes everything stored on this device. Clearing your browser data does the same.',
      `To ask about or remove the counters described above, write to ${CONTACT_EMAIL}. They also expire on their own after 35 days.`,
    ],
  },
  {
    heading: 'Children',
    body: ['MealGlimpse is not intended for anyone under 18.'],
  },
  {
    heading: 'Changes',
    body: ['If this policy changes, the new version will appear here with a new date.'],
  },
];

const TERMS: Section[] = [
  {
    heading: 'About these terms',
    body: [
      `MealGlimpse is provided by The Abhay Perspective. By using the app you agree to these terms. Questions: ${CONTACT_EMAIL}.`,
    ],
  },
  {
    heading: 'Not medical advice',
    body: [
      'Nutrition figures in MealGlimpse are estimates. AI estimates from photos and descriptions can be wrong, sometimes by a wide margin, and food list values are standard reference figures that may not match what you ate.',
      'The goal calculator gives a general starting point. Nothing in the app is medical, dietary or health advice. Speak to a doctor or registered dietitian before changing your diet, especially if you are pregnant, under 18, or have a medical condition or a history of disordered eating.',
    ],
  },
  {
    heading: 'The free AI allowance',
    body: [
      'A limited number of free AI estimates is offered each day. The allowance may be reduced, paused or withdrawn at any time, and may be unavailable when the shared budget for the day or month has been used.',
      'Do not try to get around the limits, use the service through automated tools, or use it for anything other than logging your own meals.',
    ],
  },
  {
    heading: 'Your own key',
    body: [
      "If you add your own Gemini key, your use of Google's service is between you and Google, under Google's terms, and any charges from Google are yours.",
    ],
  },
  {
    heading: 'Your data and backups',
    body: [
      'Your data is stored on your device. It can be lost if you clear your browser data, change device, or if the browser removes it. Keeping backups is your responsibility; we cannot recover lost data.',
    ],
  },
  {
    heading: 'Food data',
    body: [
      'Food list values come from USDA FoodData Central and from Open Food Facts, which is made available under the Open Database Licence.',
    ],
  },
  {
    heading: 'No warranty',
    body: [
      'The app is provided as it is, without warranties of any kind. To the extent the law allows, The Abhay Perspective is not liable for any loss or harm arising from use of the app or reliance on its figures.',
    ],
  },
  {
    heading: 'General',
    body: [
      'These terms are governed by the laws of India, and the courts of Bengaluru have jurisdiction. If these terms change, the new version will appear here with a new date.',
    ],
  },
];

export function LegalSheet({ doc, onClose }: { doc: LegalDoc; onClose: () => void }) {
  const sections = doc === 'privacy' ? PRIVACY : TERMS;
  return (
    <Sheet title={doc === 'privacy' ? 'Privacy policy' : 'Terms of use'} onClose={onClose}>
      <p className="mb-3 text-xs text-muted">Last updated {UPDATED}</p>
      {sections.map((s) => (
        <section key={s.heading} className="mb-4">
          <h3 className="mb-1 text-[14px] font-bold">{s.heading}</h3>
          {s.body.map((p, i) => (
            <p key={i} className="mb-1.5 text-[13px] leading-relaxed text-muted">
              {p}
            </p>
          ))}
        </section>
      ))}
    </Sheet>
  );
}

/** "Privacy · Terms" links that open the documents. */
export function LegalLinks({ onOpen }: { onOpen: (doc: LegalDoc) => void }) {
  return (
    <>
      <button type="button" onClick={() => onOpen('privacy')} className="font-semibold text-accent-ink underline">
        Privacy
      </button>
      {' · '}
      <button type="button" onClick={() => onOpen('terms')} className="font-semibold text-accent-ink underline">
        Terms
      </button>
    </>
  );
}
