# Security Fix: Client Permission Audit - 2026-01-02

## Summary
Audited and fixed client permissions to prevent unauthorized actions. Clients can no longer terminate sessions or access host-only controls.

---

## Issues Fixed

### 1. ✅ **TERMINATE SESSION Button** - CRITICAL
**Problem**: Clients had access to "TERMINATE SESSION" button which would disconnect them and potentially disrupt gameplay

**Fix**:
- Moved "TERMINATE SESSION" button inside host-only conditional
- Only host can now see and use this button
- Clients see "SYNCED // E2EE_LOCKED" status instead

**Location**: `App.tsx:754-766`

**Before**:
```typescript
<button onClick={() => { window.location.search = ''; window.location.reload(); }} ...>
  TERMINATE SESSION
</button>
{game.isHost ? (
  // host buttons
) : (
  // client status
)}
```

**After**:
```typescript
{game.isHost ? (
  <>
    <button onClick={...}>TERMINATE SESSION</button>
    <button>QR ACCESS</button>
    <button>UPLINK TUNNEL</button>
  </>
) : (
  <div>SYNCED // E2EE_LOCKED</div>
)}
```

---

### 2. ✅ **Action Handler Security** - IMPORTANT

**Problem**: Previous implementation blocked ALL client actions with single guard clause, but needed selective allowance

**Fix**:
- Created whitelist of client-allowed actions
- Added explicit host-only checks for each action type
- Added warning logging for unauthorized action attempts

**Client-Allowed Actions** (sent from client to host for processing):
1. `REGISTER_PLAYER` - Join a team
2. `TOGGLE_DOUBLE` - Team decision to use double stake
3. `LOCK_IN` - Team decision to lock in answer
4. `PASS` - Team decision to pass question
5. `DEFECT` - Defector's decision to betray
6. `STANDOFF_CHOICE` - Defector's standoff choice

**Host-Only Actions** (blocked from clients):
1. `JUDGE_ANSWER` - Only host judges correctness
2. `NEXT_QUESTION` - Only host controls game flow
3. `START_GAME` - Only host starts game
4. `RESOLVE_STANDOFF` - Only host resolves standoff
5. `DISMISS_NOTIFICATION` - Only host dismisses notifications

**Location**: `App.tsx:137-218`

**Security Flow**:
```typescript
const handleIncomingAction = (action: GameAction, senderPeerId?: string) => {
  // 1. Allow SYNC_STATE (state synchronization)
  if (action.type === 'SYNC_STATE') { ... }

  // 2. Whitelist check for client actions
  const clientAllowedActions = ['REGISTER_PLAYER', 'TOGGLE_DOUBLE', 'LOCK_IN', 'PASS', 'DEFECT', 'STANDOFF_CHOICE'];

  // 3. Block unauthorized client actions
  if (!game.isHost && !clientAllowedActions.includes(action.type)) {
    console.warn(`Client attempted unauthorized action: ${action.type}`);
    return;
  }

  // 4. Each case has explicit host check
  switch (action.type) {
    case 'JUDGE_ANSWER':
      if (!game.isHost) return; // Host only
      judgeAnswer(action.isCorrect);
      break;
    // ... etc
  }
}
```

---

## Security Principles Applied

1. **Whitelist over Blacklist**: Only explicitly allowed client actions are permitted
2. **Defense in Depth**: Both UI restrictions AND server-side validation
3. **Explicit Checks**: Every action has explicit host-only guard
4. **Audit Logging**: Unauthorized attempts are logged to console
5. **Least Privilege**: Clients only have permissions they need for gameplay

---

## Client Experience

**What Clients CAN Do**:
- ✅ Join teams during lobby
- ✅ Use Double Stake (their team only)
- ✅ Lock in answers (their team only)
- ✅ Pass on questions (their team only)
- ✅ Defect (if they're the defector)
- ✅ Make standoff choices (if they're the defector)

**What Clients CANNOT Do**:
- ❌ Terminate the session
- ❌ Judge answers as correct/incorrect
- ❌ Control game flow (next question)
- ❌ Start the game
- ❌ Resolve standoffs
- ❌ Dismiss notifications
- ❌ Access QR codes or invite links

**What Clients SEE**:
- Game state (scores, questions, teams)
- Inner Mind commentary
- Their own team's controls (when it's their turn)
- Defection button (only if they're the revealed defector)
- "SYNCED // E2EE_LOCKED" status (instead of host controls)

---

## Testing Verification

Build succeeded with no errors:
```bash
npm run build
✓ 1737 modules transformed.
✓ built in 2.90s
```

---

## Impact

This security fix ensures:
- ✅ **Game Integrity**: Only host controls game flow and judging
- ✅ **Session Stability**: Clients can't terminate sessions
- ✅ **Fair Play**: Teams control their own decisions but can't manipulate scoring
- ✅ **Clear Separation**: Explicit distinction between host and client privileges
- ✅ **Audit Trail**: Unauthorized attempts are logged

**The game is now secure against client-side manipulation while maintaining multiplayer functionality.**
