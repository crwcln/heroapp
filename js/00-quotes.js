// ===== QUOTES =====
// Quote of the day = one quote per calendar day, in order, so nothing repeats until the whole list has been shown.
// To extend the cycle, append more entries (aim for 365+ for a full year without a repeat).
const QUOTES = [
  { t: 'Egypt is the gift of the Nile.', a: 'Herodotus, The Histories' },
  { t: 'Of all human sorrows, the bitterest is to know so much and control so little.', a: 'Herodotus, The Histories' },
  { t: 'The whole earth is the tomb of famous men.', a: "Thucydides, Pericles' Funeral Oration" },
  { t: 'The secret of happiness is freedom, and the secret of freedom is courage.', a: 'Thucydides' },
  { t: 'To be ignorant of what happened before you were born is to remain always a child.', a: 'Cicero' },
  { t: 'Those who cannot remember the past are condemned to repeat it.', a: 'George Santayana' },
  { t: "The past is never dead. It's not even past.", a: 'William Faulkner' },
  { t: 'Look back over the past, with its changing empires that rose and fell, and you can foresee the future too.', a: 'Marcus Aurelius, Meditations' },
  { t: 'History is the essence of innumerable biographies.', a: 'Thomas Carlyle' },
  { t: 'There is properly no history; only biography.', a: 'Ralph Waldo Emerson' },
  { t: 'Travel is fatal to prejudice, bigotry, and narrow-mindedness.', a: 'Mark Twain, The Innocents Abroad' },
  { t: 'Who controls the past controls the future.', a: 'George Orwell, Nineteen Eighty-Four' },
  { t: 'They make a desert and call it peace.', a: 'Tacitus, Agricola' },
  { t: 'History, despite its wrenching pain, cannot be unlived, but if faced with courage, need not be lived again.', a: 'Maya Angelou' },
  { t: 'History is a continuous process of interaction between the historian and his facts, an unending dialogue between the present and the past.', a: 'E. H. Carr, What Is History?' },
  { t: 'A journey of a thousand miles begins with a single step.', a: 'Lao Tzu, Tao Te Ching' },
  { t: 'What is history but a fable agreed upon?', a: 'Attributed to Napoleon Bonaparte' },
  { t: 'History is not the past. It is the present.', a: 'James Baldwin' },
  { t: 'Herodotus here presents his inquiries, so that the deeds of men may not fade with time.', a: 'Herodotus, The Histories (opening, paraphrased)' }
];
const quoteOfDay = () => QUOTES[Math.floor((Date.now() - new Date(2026, 0, 1)) / 864e5 + 100000) % QUOTES.length];
const quoteLine = () => { const q = quoteOfDay(); return `\u201c${q.t}\u201d \u2014 ${q.a}`; };
