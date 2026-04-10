# Click to the Beat

A small web app where you click to the beat of a song.

Search any song via the bar at the bottom, pick one, and click anywhere on the grid to the rhythm. Each click sends a wave rippling out across the page.

## Setup

1. Get a free [YouTube Data API v3](https://console.cloud.google.com) key
2. Create a `.env.local` file in the root:
   ```
   VITE_YT_API_KEY=your_key_here
   ```
3. Install and run:
   ```bash
   npm install
   npm run dev
   ```
