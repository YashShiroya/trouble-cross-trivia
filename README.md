# TROUBLE CROSS: HOST OS v2.18

A real-time multiplayer trivia game with betrayal mechanics. Built with React, TypeScript, and powered by Gemini API.

## 🎮 Game Overview

**TROUBLE CROSS** (based on TURNCOAT spec) is a team-based trivia game where:
- 2 teams compete across 6 rounds (18 AI-generated questions)
- Each team has a secret **defector** who can betray for bonus points
- Features a dramatic **Standoff** mechanic when both defectors hold their tokens
- Real-time P2P multiplayer using PeerJS
- AI-generated questions and dramatic commentary via Gemini

## 🚀 Quick Start

### Prerequisites
- Node.js (v16 or higher)
- Google Gemini API key ([Get one here](https://makersuite.google.com/app/apikey))

### Setup

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd trouble-cross
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**

   Create a `.env.local` file in the project root:
   ```bash
   GEMINI_API_KEY=your_api_key_here
   ```

   ⚠️ **IMPORTANT**: Never commit your `.env.local` file! It's already in `.gitignore`.

4. **Run the dev server**
   ```bash
   npm run dev
   ```

   The app will be available at `http://localhost:3000`

5. **Build for production**
   ```bash
   npm run build
   npm run preview
   ```

## 🎯 How to Play

1. **Host** starts a game and shares the room code (or QR code)
2. **Players** join using the room code on their devices
3. Players select **Team A** or **Team B** (max 6 per team)
4. Host clicks **GENERATE MISSION** to start
5. Teams answer trivia questions, use **Double Stake**, and strategize
6. Secret defectors can betray their team for bonus points
7. If both defectors hold until Round 5, a **Standoff** occurs!

## 📁 Project Structure

```
trouble-cross/
├── App.tsx                 # Main game logic & state management
├── types.ts                # TypeScript type definitions
├── index.tsx               # React entry point
├── index.html              # HTML template
├── components/
│   ├── SetupScreen.tsx     # Lobby & join screens
│   └── TerminalFrame.tsx   # UI frame component
├── services/
│   └── geminiService.ts    # Gemini AI integration
├── vite.config.ts          # Build configuration
├── COMPLIANCE_LOG.md       # Spec compliance tracking
├── FIXES_APPLIED.md        # Development changelog
└── SECURITY_FIX.md         # Security improvements log
```

## 🔧 Tech Stack

- **Frontend**: React 19, TypeScript
- **Build Tool**: Vite
- **Networking**: PeerJS (WebRTC P2P)
- **AI**: Google Gemini 3 Flash
- **Styling**: Tailwind CSS (via CDN)
- **Icons**: Lucide React

## 🛡️ Security Features

- Host-only game control (judging, flow control)
- Client permissions whitelist
- Server-side validation for all actions
- No direct state manipulation by clients

## 📋 Game Mechanics (Compliant with TURNCOAT v2.18)

- ✅ Random token reveal timing (Rounds 1-4)
- ✅ Standoff only triggers if both tokens held after Round 4
- ✅ Mutual defection causes team swaps
- ✅ Proper turn order alternation
- ✅ Player count validation (2-12 players, max 6 per team)
- ✅ Pass button functionality
- ✅ Defection window enforcement
- ✅ Secure client permissions

## 🌐 Deployment

The app is configured to run on port 3000 with ngrok support. Update `vite.config.ts` for your deployment:

```typescript
server: {
  port: 3000,
  host: '0.0.0.0',
  allowedHosts: ['your-ngrok-domain.ngrok-free.dev']
}
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

ISC

## 🙏 Acknowledgments

- Original game design: TURNCOAT v2.18 specification
- AI generation: Google Gemini
- Networking: PeerJS library

---

**Built with ❤️ for high-stakes trivia and strategic betrayal**
