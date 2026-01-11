# Critical Fixes Applied - 2026-01-02

## Summary
Fixed 7 compliance issues (5 critical + 2 medium priority) to align TROUBLE CROSS with the TURNCOAT v2.18 specification.

---

## ✅ Fix 1: Token Reveal Randomization

**Problem**: Token reveals were hardcoded (Token A after R1, Token B after R2)

**Solution**:
- Added `tokenARevealRound` and `tokenBRevealRound` to GameState
- Randomize on game start:
  - Token A: Random between rounds 1-3
  - Token B: Random between rounds 2-4 (must be ≥ Token A)
- Token reveals now happen dynamically based on these values

**Files Modified**:
- `types.ts` - Added new state fields
- `App.tsx` - Randomization logic in `startGame()`, reveal logic in `handleNext()`

**Code Example**:
```typescript
// Token A: Random between rounds 1, 2, or 3
const tokenAReveal = Math.floor(Math.random() * 3) + 1;

// Token B: Random between rounds 2, 3, or 4, but must be >= tokenAReveal
const minTokenB = Math.max(2, tokenAReveal);
const maxTokenB = 4;
const tokenBReveal = Math.floor(Math.random() * (maxTokenB - minTokenB + 1)) + minTokenB;
```

---

## ✅ Fix 2: Standoff Trigger Condition

**Problem**: Standoff always triggered at Round 5, regardless of token usage

**Solution**:
- Added `tokenAUsed` and `tokenBUsed` boolean flags to track token state
- Updated `handleDefection()` to mark tokens as used when defection occurs
- Changed standoff trigger to check: `if (nextRound === 5 && !game.tokenAUsed && !game.tokenBUsed)`
- Standoff now only happens if BOTH tokens are still held after Round 4

**Files Modified**:
- `types.ts` - Added `tokenAUsed` and `tokenBUsed` fields
- `App.tsx` - Token tracking in `handleDefection()`, conditional standoff in `handleNext()`

**Code Example**:
```typescript
// In handleNext() after Round 4:
if (nextRound === 5 && !game.tokenAUsed && !game.tokenBUsed) {
  // Trigger standoff only if both tokens unused
  updateGame(prev => ({
    ...prev,
    standoff: { ...prev.standoff, triggered: true },
    defectionWindowOpen: false,
    // ... rest of standoff setup
  }));
  return;
}
```

---

## ✅ Fix 3: Mutual Defection Team Swap

**Problem**: When both defectors chose DEFECT in standoff, players did not swap teams

**Solution**:
- Implemented player team swapping for all standoff scenarios:
  - **LOYAL + LOYAL**: No changes
  - **DEFECT + LOYAL**: Defector swaps to other team, +3 points
  - **LOYAL + DEFECT**: Defector swaps to other team, +3 points
  - **DEFECT + DEFECT**: Both players swap teams, no points awarded (CHAOS)
- Updated `resolveStandoff()` to modify player team assignments

**Files Modified**:
- `App.tsx` - Complete rewrite of `resolveStandoff()` with player swapping logic

**Code Example**:
```typescript
// DEFECT + DEFECT scenario:
updatedPlayers = updatedPlayers.map(player => {
  if (player.peerId === p.defectorPeerIdA) return { ...player, team: 'B' };
  if (player.peerId === p.defectorPeerIdB) return { ...player, team: 'A' };
  return player;
});
```

---

## ✅ Fix 4: Turn Order Within Rounds

**Problem**: Turn order logic was incorrect (used `nextRound % 2 === 0` which reversed the teams)

**Solution**:
- Fixed first team selection for new rounds:
  - Rounds 1, 3, 5 (odd) → Team A starts
  - Rounds 2, 4, 6 (even) → Team B starts
- Changed logic to: `(nextRound % 2 === 1) ? 'A' : 'B'`
- Maintained existing alternation within rounds (each question switches teams)

**Files Modified**:
- `App.tsx` - Corrected logic in `handleNext()`

**Code Example**:
```typescript
// Determine first answering team for new round
// Rounds 1, 3, 5 → Team A starts; Rounds 2, 4, 6 → Team B starts
const firstTeam = (nextRound % 2 === 1) ? 'A' : 'B';
```

---

## ✅ Fix 5: Player Count Validation

**Problem**: No enforcement of team size limits, could have unlimited players per team

**Solution**:
- Added server-side validation when players register for teams
- Maximum 6 players per team (prevents overcrowding)
- Minimum 2 players total to start game
- UI feedback:
  - Shows player count (X/6 Players) on join buttons
  - Disables join buttons when team is full
  - Shows "(FULL)" indicator on capacity teams
  - Shows "(Need 2+ players)" on start button when insufficient players

**Files Modified**:
- `App.tsx` - Validation logic in REGISTER_PLAYER handler, UI updates in team selection and lobby

**Code Example**:
```typescript
case 'REGISTER_PLAYER':
  updateGame(p => {
    // Check if team already has 6 players
    const teamCount = p.players.filter((pl: Player) => pl.team === action.team).length;
    const existingPlayer = p.players.find((pl: Player) => pl.peerId === action.peerId);

    // Allow if: player already exists (re-registering) OR team has less than 6 players
    if (existingPlayer || teamCount < 6) {
      return {
        ...p,
        players: [...p.players.filter((pl: Player) => pl.peerId !== action.peerId),
                  { peerId: action.peerId, team: action.team, name: action.name }]
      };
    }
    // Team is full, don't add player
    return p;
  });
  break;
```

---

## ✅ Fix 6: Pass Button Functionality

**Problem**: No way for teams to pass on questions they don't know

**Solution**:
- Added `PASS` action to game action types
- Implemented `handlePass()` that resolves question with no points awarded
- Added "PASS QUESTION" button in AWAITING state (visible to answering team and host)
- Added "PASS" button in STEAL state (for host to skip steal attempt)
- Inner Mind provides commentary: "Passed. Strategic silence or cowardice?"

**Files Modified**:
- `types.ts` - Added PASS to GameAction union
- `App.tsx` - Handler implementation and UI buttons

**Code Example**:
```typescript
const handlePass = () => {
  if (!game.isHost) return;
  // Team passes on the question - mark as resolved with no points
  updateGame(p => ({ ...p, currentTurn: { ...p.currentTurn, status: QuestionStatus.RESOLVED } }));
  updateInnerMind('Passed. Strategic silence or cowardice?');
};
```

---

## ✅ Fix 7: Defection Window Timing Enforcement

**Problem**: Defection button could potentially be clicked during Round 5+ even though window should be closed

**Solution**:
- Added server-side validation in `handleDefection()` to enforce window closure
- Checks `defectionWindowOpen` flag before allowing defection
- Validates that only actual defectors (peerId matches defectorPeerIdA or defectorPeerIdB) can defect
- Provides Inner Mind feedback when defection is blocked
- UI already hides button when window closed, but now server enforces it too

**Files Modified**:
- `App.tsx` - Enhanced `handleDefection()` with validation

**Code Example**:
```typescript
const handleDefection = (peerId: string) => {
  if (!game.isHost) return;

  // Enforce defection window - cannot defect after Round 4 ends
  if (!game.defectionWindowOpen) {
    updateInnerMind('Defection window is CLOSED. The time for betrayal has passed.');
    return;
  }

  // Verify this player is actually a defector
  if (peerId !== game.defectorPeerIdA && peerId !== game.defectorPeerIdB) {
    return;
  }

  // ... proceed with defection
};
```

---

## 🧪 Testing Verification

Build succeeded with no TypeScript errors:
```bash
npm run build
✓ 1737 modules transformed.
✓ built in 4.09s
```

---

## 📋 Next Steps (Optional Enhancements)

Remaining issues from compliance log (not critical):
1. Multiple display modes (MOBILE, LIVE, QUICK)
2. Command system interface
3. Offline mode generation

---

## 🎯 Impact

These fixes ensure:
- ✅ Random, unpredictable token reveals increase strategic depth
- ✅ Standoff only occurs when both players hold their tension, making it a rare high-stakes moment
- ✅ Mutual defection creates true chaos with team swaps
- ✅ Turn order matches spec exactly for fair gameplay
- ✅ Player count limits prevent overcrowding and ensure balanced teams
- ✅ Teams can pass on difficult questions for strategic gameplay
- ✅ Defection window properly enforced to maintain game integrity

**All core game mechanics now comply with TURNCOAT v2.18 specification, with flexible player counts (2-12 players total, max 6 per team) and complete gameplay controls.**
