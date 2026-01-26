# 🌙 DarkNite  
**Real-time nightlife intel for NYC bars & clubs**

DarkNite is a **React Native mobile app** that lets users share and discover live venue vibes — crowd levels, music, pricing, line waits, and more.

Check in for points, post detailed vibes, and find the perfect spot for your night out.

---

## 🚀 Quick Start

### Prerequisites
- **Node.js 18+**
- **npm**
- **Expo CLI**
  ```bash
  npm install -g expo-cli
Supabase account with a project set up

Installation
1️⃣ Clone the repo and install dependencies
git clone <your-repo-url>
cd darknite
npm install
2️⃣ Environment variables
Create a .env file in the project root:

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
📍 Get these from: Supabase Dashboard → Settings → API

⚠️ Important

.env is in .gitignore

Never commit environment variables

3️⃣ Database setup
If starting fresh, see database-schema.md for the full schema.

Key tables:

venues

vibes

check_ins

user_profiles

user_points

4️⃣ Run the app
npm start
Scan the QR code with Expo Go (iOS / Android)

Or press:

i → iOS simulator

a → Android emulator

📱 Features
🎯 Core Features
Quick Check-ins (+1 point)
Clubs: Report line wait time

Bars: Report crowd level

Detailed Vibes (+5 points — coming soon)
Crowd

Music

Pricing

Ratio

Different fields for bars vs clubs

Live Venue Intel
Latest check-ins & vibes

Real-time crowd tracking

Line wait estimates (clubs)

Gamification
Earn points for contributions

Track check-ins & vibes

Leaderboards (coming soon)

Personalized “For You” Feed (coming soon)
Based on preferred days, neighborhoods & music

Smart venue recommendations

🏗️ Key Concepts
Bars vs Clubs
Bars track:

Crowd level

Drinks pricing

Bar type

Clubs track:

Line wait

Cover charge

Music

Points System
✅ Check-in → +1 point

🔥 Post vibe → +5 points (planned)

🗄️ Database
Schema Overview
Table	Purpose
venues	Nightlife venues (bars & clubs)
vibes	User-submitted detailed vibes
check_ins	Quick check-ins with minimal info
user_profiles	User info & nightlife preferences
user_points	Gamification & scoring
📚 See database-schema.md for full documentation.

Database Features
Row Level Security (RLS) on all tables

Users can only modify their own data

Public read access for venue data

Rate limiting & spam prevention

🔐 Authentication & Security
Supabase Auth
Email/password authentication

JWT-based sessions

Auto-refresh tokens

RLS Policies
user_profiles → users edit own profile

user_points → public read, users update own

check_ins → public read, users insert/delete own

vibes → public read, users delete own

venues → public read, admin-only write

Data Privacy
No sensitive data logged in production

Auth data protected by Supabase

No location tracking (lat/lng removed)

📂 Project Structure
darknite/
├── components/              # Reusable UI components
│   ├── VenueCardLovable.js
│   ├── VenueDetailsLovable.js
│   └── CheckInModal.js
├── contexts/                # Global state
│   ├── AuthContext.js
│   └── AppContext.js
├── services/                # Supabase service layer
│   ├── vibeService.js
│   ├── checkInService.js
│   └── supabase.js
├── utils/                   # Helper utilities
│   ├── vibeHelpers.js
│   ├── priceMapping.js
│   └── timeHelpers.js
├── database-schema.md       # Database documentation
├── .env                     # Environment variables (ignored)
└── app.config.js            # Expo config
🔧 Environment Variables
Required
Variable	Description	Location
SUPABASE_URL	Supabase project URL	Dashboard → Settings → API
SUPABASE_ANON_KEY	Public anonymous key	Dashboard → Settings → API
Optional
Variable	Description
SENTRY_DSN	Error tracking
NODE_ENV	Environment mode
💡 The anon key is safe for client-side usage — RLS secures data.

🎨 Design Principles
UI / UX
Dark mode first (nightlife-optimized)

Fast actions (check-in in ~5 seconds)

Emoji-first hierarchy for scannability

Haptic feedback for tactile feel

Data Philosophy
Fresh over cached

Progressive disclosure (quick check-ins → detailed vibes)

Social proof (counts, crowd levels)

Minimal friction

🚧 Roadmap
✅ Completed
Venue map & details

Check-in system

Basic vibe posting

Authentication

Points system

RLS policies

🔄 In Progress
Onboarding flow (4 questions)

+5 points for vibes

Leaderboards

📋 Planned
Personalized “For You” feed

Push notifications

Search & filters

Social profiles

Venue recommendations

🛠️ Development
Running Locally
npm start
npm run ios
npm run android
Debugging
React Native Debugger

Supabase Dashboard

Console logs (dev mode)

Code Style
Functional components + hooks

Modular, focused components

Consistent naming

Document complex logic

🐛 Troubleshooting
“Failed to connect to Supabase”
Check .env exists

Verify SUPABASE_URL & SUPABASE_ANON_KEY

Restart Expo after env changes

“RLS policy violation”
Ensure user is logged in

Confirm auth.uid() matches user_id

Check RLS policies allow action

Check-ins / vibes not appearing
Pull to refresh (cached data)

Check Supabase logs

Verify INSERT policies

📄 License
TBD

🤝 Contributing
This is a personal project, but contributions are welcome!

Fork the repo

Create a feature branch

Test thoroughly

Submit a PR with a clear description
