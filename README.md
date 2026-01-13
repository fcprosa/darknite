# DarkNite

DarkNite is a React Native app for discovering nightlife venues and sharing real-time vibes.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables:
   - Create a `.env` file in the root directory
   - Add your Supabase credentials:
     ```
     EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
     EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
     ```

3. Run the app:
   ```bash
   npm start
   ```

## Database

### Venues

Venues require `address` for accurate Maps linking. Recommended format: "Street, New York, NY ZIP, USA".

The `address` field is used for Maps deep-links. If `address` is not provided, the app falls back to using the venue name and neighborhood.
