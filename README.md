🌙 DarkNite
Real-time nightlife intel for NYC bars & clubs.

DarkNite is a React Native mobile app that lets users share and discover live venue vibes—crowd levels, music, pricing, line waits, and more. Check in for points, post detailed vibes, and find the perfect spot for your night out.

🚀 Quick Start
Prerequisites
Node.js 18+ and npm
Expo CLI: npm install -g expo-cli
Supabase account with a project set up
Installation
Clone and install dependencies:
bash
   git clone <your-repo>
   cd darknite
   npm install
Set up environment variables: Create a .env file in the root directory:
env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key-here
📍 Get these from your Supabase project: Settings → API

⚠️ The .env file is in .gitignore - never commit it!

Database setup: Your database should already be set up. If starting fresh, refer to database-schema.md for the complete schema. Key tables: venues, vibes, check_ins, user_profiles, user_points
Run the app:
bash
   npm start
Scan the QR code with Expo Go (iOS/Android) or press i for iOS simulator / a for Android emulator.

📱 Features
🎯 Core Features
Quick Check-ins (+1 point)
Clubs: Report line wait time
Bars: Report crowd level
Detailed Vibes (+5 points, coming soon)
Share crowd, music, pricing, ratio, and more
Different fields for bars vs. clubs
Live Venue Intel
See latest check-ins and vibes
Real-time crowd tracking
Line wait estimates for clubs
Gamification
Earn points for contributions
Leaderboards (coming soon)
Track your check-ins and vibes
Personalized For You Feed (coming soon)
Based on your preferred days, neighborhoods, and music
Smart recommendations
🏗️ Key Concepts
Bars vs. Clubs:

Bars track: crowd level, drinks pricing, bar type
Clubs track: line wait, cover charge, music
Points System:

✓ Check-in: +1 point
🔥 Post vibe: +5 points (to be implemented)
🗄️ Database
Schema Overview
The app uses 5 main tables:

Table	Purpose
venues	Nightlife venues (bars & clubs)
vibes	User-submitted detailed vibes
check_ins	Quick check-ins with minimal info
user_profiles	User info and nightlife preferences
user_points	Gamification tracking
📚 For detailed schema documentation, see database-schema.md

Key Features
Row Level Security (RLS) enabled on all tables
Users can only edit their own data
Public read access for venue data
Rate limiting and spam prevention
🔐 Authentication & Security
Supabase Auth
Email/password authentication via Supabase Auth
JWT-based session management
Auto-refresh tokens
RLS Policies
Implemented for all tables:

user_profiles: Users can only edit their own profile
user_points: Public read (leaderboards), users update own points
check_ins: Public read, users insert/delete own check-ins
vibes: Public read, users delete own vibes
venues: Public read, admin-only write
Data Privacy
Sensitive data never logged in production
User emails and auth data protected by Supabase Auth
No location tracking (lat/lng removed from check-ins)
📂 Project Structure
darknite/
├── components/          # React Native components
│   ├── VenueCardLovable.js       # Venue card on map
│   ├── VenueDetailsLovable.js    # Venue details screen
│   └── CheckInModal.js           # Check-in flow
├── contexts/            # React contexts
│   ├── AuthContext.js            # Auth state
│   └── AppContext.js             # App state (venues, vibes)
├── services/            # API services
│   ├── vibeService.js            # Vibe CRUD
│   ├── checkInService.js         # Check-in CRUD
│   └── supabase.js               # Supabase client
├── utils/               # Utilities
│   ├── vibeHelpers.js            # Ratio calculations
│   ├── priceMapping.js           # Price tier mapping
│   └── timeHelpers.js            # Time formatting
├── database-schema.md   # Complete DB documentation
├── .env                 # Environment variables (not in git)
└── app.config.js        # Expo configuration
🔧 Environment Variables
Required
Variable	Description	Where to Find
SUPABASE_URL	Your Supabase project URL	Supabase Dashboard → Settings → API
SUPABASE_ANON_KEY	Public anonymous key	Supabase Dashboard → Settings → API
Optional
Variable	Description
SENTRY_DSN	Error tracking (production)
NODE_ENV	Environment mode (auto-set)
💡 Tip: The anon key is safe to use client-side. Supabase uses RLS to secure data.

🎨 Design Principles
UI/UX
Dark mode first - Optimized for nightlife
Quick actions - Check-in takes 5 seconds
Visual hierarchy - Emoji-first for scannability
Haptic feedback - Enhanced tactile experience
Data Philosophy
Fresh over cached - Always show latest venue data
Progressive disclosure - Quick check-ins vs. detailed vibes
Social proof - Check-in counts, crowd levels
Minimal friction - One question for check-ins
🚧 Roadmap
✅ Completed
 Venue map and details
 Check-in system (bars & clubs)
 Basic vibe posting
 User authentication
 Points tracking
 RLS policies
🔄 In Progress
 Onboarding flow (4 questions)
 +5 points for posting vibes
 Leaderboards
📋 Planned
 Personalized "For You" feed
 Push notifications (vibe reminders)
 Search and filters
 User profiles and social features
 Venue recommendations
🛠️ Development
Running Locally
bash
# Start Expo dev server
npm start

# Run on iOS simulator
npm run ios

# Run on Android emulator
npm run android
Debugging
React Native Debugger for component inspection
Supabase Dashboard for database queries
Console logs in development mode
Code Style
Use functional components with hooks
Follow existing naming conventions
Keep components focused and modular
Document complex logic
📚 Key Files to Know
database-schema.md - Complete database documentation
CheckInModal.js - Check-in flow (bars vs. clubs)
VenueDetailsLovable.js - Venue details with live data
vibeService.js - All vibe-related API calls
checkInService.js - Check-in logic and points
🐛 Troubleshooting
"Failed to connect to Supabase"
Check your .env file exists and has correct values
Verify SUPABASE_URL and SUPABASE_ANON_KEY
Restart the Expo dev server after changing .env
"RLS policy violation"
Ensure you're logged in
Check RLS policies in Supabase Dashboard
Verify user_id matches auth.uid()
Check-in/Vibe not appearing
Data is cached for performance - pull to refresh
Check Supabase logs for errors
Verify RLS policies allow INSERT
📄 License
[Your License Here]

🤝 Contributing
This is a personal project, but contributions are welcome! Please:

Fork the repo
Create a feature branch
Test thoroughly
Submit a PR with clear description
Built with ❤️ for NYC nightlife

