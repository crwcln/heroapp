// ===== SITE CONFIG =====
// Duplicating this repo? Change `id` (and `name`). Every Firestore path (quiz data, leaderboards,
// announcements, feedback, analytics, visit counter) is namespaced under this id, so two sites sharing
// one Firebase project never see each other's data.
const SITE = { id: 'hero-2026', name: 'Hero', intro: 1 };   // bump `intro` to show the opening film to everyone again
window.__app_id = SITE.id;
