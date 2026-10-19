// ===== EDIT SITE SETTINGS HERE =====
// When you duplicate this repo, give it a new unique id and update the name.
// The id namespaces this site's Firestore data when projects share one Firebase database.
const SITE = {
  id: 'hero-2026',
  name: 'Hero',
  version: '1.2.5',
  tagline: 'STUDYING, REDEFINED.',

  // Public opening time: 6:00 PM EST (UTC-5) on October 20, 2026.
  launchAt: '2026-10-20T23:00:00Z',

  // Increase intro to replay the opening film for everyone. Optional: set a custom MP4 path.
  intro: 2,
  introVideo: 'media/hero-trailer.mp4', // Example: 'media/hero-intro.mp4'

  // Turn features off here rather than removing their source files.
  features: {
    clio: true,
    music: true,
    tutorial: true,
    cookies: true,
    secrets: true,
    flappyBird: true,
    randomLocations: true,
  },
}

// Site id is used by the Firestore paths throughout the app.
window.__app_id = SITE.id;
