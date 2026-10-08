// ===== SITE CONFIG =====
// Duplicating this repo? Change `id` (and `name`). Every Firestore path (quiz data, leaderboards,
// announcements, feedback, analytics, visit counter) is namespaced under this id, so two sites sharing
// one Firebase project never see each other's data.
 HEAD
const SITE = {
  id: 'hero-2026',        // change when duplicating this repo; namespaces ALL Firestore data
  name: 'Hero', version: '1.0.0', intro: 1, introVideo: '',
  tagline: 'STUDYING, REDEFINED.',
  // Flip a feature off here instead of deleting code (js/17-features.js applies these).
  features: { clio: true, music: true, tutorial: true, cookies: true, secrets: true, flappyBird: true, randomLocations: true },
}; // <-- EDIT ABOVE THIS LINE. Everything below reads from SITE and should not need changes.   // introVideo: e.g. 'media/hero-intro.mp4' (put the file in /media) replaces the built-in film   // bump `intro` to show the opening film to everyone again
const SITE = { id: 'heroapp-cc053', name: 'Hero', intro: 1 };   // bump `intro` to show the opening film to everyone again
 _0a68a4c1f48af580e2308f9340e66c7a0de13627
window.__app_id = SITE.id;
