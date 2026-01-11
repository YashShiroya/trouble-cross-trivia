# TURNCOAT Spec Compliance Analysis
**Date**: 2026-01-02
**Version**: TROUBLE CROSS v2.18
**Status**: Critical Issues Fixed (2026-01-02)
**Last Updated**: 2026-01-02

---

## ✅ **FIXED - Critical Issues (2026-01-02)**

### 1. ✅ **Token Reveal Timing** - FIXED
- **Spec**:
  - Token 1 (Team A): Reveal after Round 1, 2, or 3 (random)
  - Token 2 (Team B): Reveal after Round 2, 3, or 4 (random, but ≥ Token 1)
- **Fix**: Added `tokenARevealRound` and `tokenBRevealRound` to GameState with randomization in `startGame()`
- **Location**: `types.ts:79-83`, `App.tsx:238-245`, `App.tsx:299-304`
- **Status**: ✅ RESOLVED

### 2. ✅ **Standoff Trigger Logic** - FIXED
- **Spec**: Standoff triggers ONLY if both tokens still held after Round 4
- **Fix**: Added `tokenAUsed` and `tokenBUsed` tracking, standoff only triggers if `!tokenAUsed && !tokenBUsed`
- **Location**: `App.tsx:313-324`, `App.tsx:278-279`
- **Status**: ✅ RESOLVED

### 3. ✅ **Standoff Player Swapping** - FIXED
- **Spec**: "DEFECT + DEFECT → Both swap teams. No points awarded."
- **Fix**: Implemented full player team swapping in all standoff scenarios
- **Location**: `App.tsx:384-428` - `resolveStandoff()` now swaps players correctly
- **Status**: ✅ RESOLVED

### 4. ✅ **Turn Order Within Rounds** - FIXED
- **Spec**:
  - Rounds 1, 3, 5 → Team A answers first
  - Rounds 2, 4, 6 → Team B answers first
  - Within rounds, questions alternate between teams
- **Fix**: Corrected first team logic to use `(nextRound % 2 === 1) ? 'A' : 'B'`, maintains alternation within rounds
- **Location**: `App.tsx:329-349`
- **Status**: ✅ RESOLVED

---

## ✅ **FIXED - Player Management (2026-01-02)**

### 5. ✅ **Player Count Validation** - FIXED
- **Original Spec**: 8 players (2 teams of 4) + 1 Host
- **Updated Requirement**: Max 6 players per team (flexible minimum of 2 total)
- **Fix**:
  - Added validation in REGISTER_PLAYER action to prevent teams exceeding 6 players
  - Added UI feedback showing player count (X/6 Players) on team selection
  - Disabled join buttons when teams are full
  - Added minimum 2 players requirement for game start
- **Location**: `App.tsx:146-162`, `App.tsx:493-537`, `App.tsx:566-573`
- **Status**: ✅ RESOLVED

---

## ✅ **FIXED - Gameplay Features (2026-01-02)**

### 6. ✅ **Pass Button Functionality** - FIXED
- **Spec**: Teams can `pass` on questions
- **Fix**:
  - Added PASS action to GameAction types
  - Implemented `handlePass()` function that marks question as resolved with no points
  - Added Pass button in AWAITING state (for answering team)
  - Added Pass button in STEAL state (for host to pass on steal attempt)
  - Updates Inner Mind with commentary when passed
- **Location**: `types.ts:112`, `App.tsx:166`, `App.tsx:377-382`, `App.tsx:694-698`, `App.tsx:724`
- **Status**: ✅ RESOLVED

### 7. ✅ **Defection Window Timing Enforcement** - FIXED
- **Spec**: "Defector can switch teams anytime before Round 5"
- **Fix**:
  - Added validation in `handleDefection()` to check `defectionWindowOpen` flag
  - Prevents defection when window is closed (Round 5 onwards)
  - Validates that only actual defectors can execute defection
  - Provides feedback via Inner Mind when defection is blocked
- **Location**: `App.tsx:275-287`
- **Status**: ✅ RESOLVED

### 8. ✅ **Client Permission Security** - FIXED (CRITICAL SECURITY)
- **Issue**: Clients could access "TERMINATE SESSION" and potentially unauthorized actions
- **Fix**:
  - Moved TERMINATE SESSION button to host-only section
  - Created whitelist of client-allowed actions (REGISTER_PLAYER, TOGGLE_DOUBLE, LOCK_IN, PASS, DEFECT, STANDOFF_CHOICE)
  - Added explicit host-only checks for each action handler
  - Added warning logging for unauthorized client action attempts
  - Enforced host-only actions: JUDGE_ANSWER, NEXT_QUESTION, START_GAME, RESOLVE_STANDOFF, DISMISS_NOTIFICATION
- **Location**: `App.tsx:137-218`, `App.tsx:754-766`
- **Status**: ✅ RESOLVED

---

## ⚠️ **Medium Priority Issues**

### 8. **Display Modes Not Implemented**
- **Spec**: 4 display modes (HOST_OS, MOBILE, LIVE, QUICK) with different UI layouts
- **Code**: Enum exists in `types.ts:11-16` but only one UI layout implemented
- **Impact**: Mobile/Live/Quick modes not rendered differently
- **Priority**: MEDIUM

### 7. **Command System Missing**
- **Spec**: Extensive command system (`init`, `dry_run`, `tipsy_mode`, `scores`, `abilities`, `chronicle`, etc.)
- **Code**: Only basic game actions via buttons, no command interface
- **Impact**: No text-based commands, no tipsy mode, no chronicle summaries
- **Priority**: MEDIUM

### 8. **Offline Mode Missing**
- **Spec**: `offline chat <difficulty>` and `offline pdf <difficulty>` commands
- **Code**: Not implemented at all
- **Impact**: Cannot generate printable/downloadable game kits
- **Priority**: MEDIUM

### 9. **Pass Functionality**
- **Spec**: Teams can `pass` on questions
- **Code**: No pass button or action
- **Location**: Missing from `App.tsx:564-574` - answer controls section
- **Priority**: MEDIUM

### 10. **Defection Window Timing**
- **Spec**: "Defector can switch teams anytime before Round 5"
- **Code**: Defection window closes at Round 5 start (correct) but doesn't prevent defection during questions
- **Location**: `App.tsx:552-559` - Button visible if `defectionWindowOpen`
- **Priority**: LOW

---

## ℹ️ **Minor/Cosmetic Issues**

### 11. **Game Name**
- **Spec**: "TURNCOAT"
- **Code**: "TROUBLE CROSS"
- **Impact**: Branding inconsistency
- **Priority**: LOW

### 12. **Version Display**
- **Spec**: Should show "HOST OS v2.18" prominently
- **Code**: Shows as badge but not as prominently
- **Location**: `SetupScreen.tsx:25`
- **Priority**: LOW

### 13. **Inner Mind Commentary**
- **Spec**: Specific dramatic phrases for situations
- **Code**: AI-generated commentary (more dynamic but less consistent)
- **Impact**: Different tone/style than spec examples
- **Priority**: LOW

### 14. **Scoring Display Format**
- **Spec**: Detailed ASCII-art scoreboards with player lists
- **Code**: Simplified progress bars and minimal player info
- **Location**: `App.tsx:501-515`
- **Priority**: LOW

### 15. **Reveal Command**
- **Spec**: `reveal` command to show correct answer after judging
- **Code**: Answer auto-reveals after resolution
- **Impact**: Less host control over pacing
- **Priority**: LOW

---

## ✅ **Correctly Implemented**

- ✓ Core game flow (6 rounds, 3 questions each = 18 total)
- ✓ Scoring system (+1 correct, +2 double, -1 double fail, +2 early defection, +3 standoff)
- ✓ Defector assignment (one per team, random)
- ✓ Double or Nothing mechanic
- ✓ Steal mechanic (wrong answer opens steal)
- ✓ PeerJS networking with host-client architecture
- ✓ AI question generation with difficulty levels
- ✓ Team scoring and progress tracking
- ✓ Question answer judging
- ✓ Standoff UI and choice collection
- ✓ Defection mechanics (+2 points)
- ✓ Round tracking and progression

---

## 🎯 **Recommended Fix Order**

### Phase 1: Critical Game Mechanics
1. Token reveal randomization
2. Standoff trigger condition check (only if both tokens held)
3. Mutual defection team swap implementation
4. Turn order within-round alternation

### Phase 2: Player Management
5. Player count validation (4 per team minimum)
6. Pass button functionality

### Phase 3: Enhanced Features
7. Multiple display modes (MOBILE, LIVE, QUICK)
8. Command system interface (optional - web UI alternative exists)
9. Offline mode generation

### Phase 4: Polish
10. Branding alignment (TURNCOAT vs TROUBLE CROSS)
11. Display formatting improvements
12. Host control enhancements

---

## 📝 **Notes**

- Current implementation uses web-based UI instead of CLI command system - this is acceptable as modern alternative
- Gemini AI integration adds dynamic commentary beyond spec examples
- PeerJS networking works well for multiplayer synchronization
- Core betrayal mechanics are sound and functional
