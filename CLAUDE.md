# CLAUDE.md — Startale Support Bot

This file provides context for AI assistants (Claude and others) working on this codebase.

---

## Project Overview

**startale-support-bot** is a Node.js Discord bot that automates support ticket management for the Startale blockchain/wallet application. It:

- Detects support ticket channels and auto-replies to user messages using a rule-based keyword matching system.
- Manages the full ticket lifecycle: creation (via slash command + modal), channel permissions, and closure.
- Optionally falls back to OpenAI for responses that don't match any rule.
- Supports a manual handoff mode where support staff take over from the bot.

The entire bot is implemented in a single file: `src/bot.js` (~817 lines).

---

## Repository Structure

```
startale-support-bot/
├── src/
│   └── bot.js          # All bot logic (entry point, event handlers, rules)
├── package.json         # Dependencies and npm scripts
├── package-lock.json    # Locked dependency versions
├── .gitignore           # Excludes .env, node_modules
├── README.md            # Korean-language setup guide
└── CLAUDE.md            # This file
```

There is no build step, no test framework, and no CI/CD configuration.

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Runtime | Node.js (ESM, `"type": "module"`) |
| Discord library | discord.js v14 |
| AI fallback | OpenAI API (`/v1/responses`) |
| Config | `dotenv` — `.env` file |
| State | In-memory only (no database) |

---

## Running the Bot

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env and set DISCORD_TOKEN at minimum

# Start
npm start
```

---

## Environment Variables

Defined at the top of `src/bot.js`. All are read from `process.env`.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DISCORD_TOKEN` | **Yes** | — | Discord bot token. Validated: must be ≥50 chars, no placeholder text. |
| `GUILD_ID` | No | — | Discord server (guild) ID. Set for fast (guild-scoped) slash command registration. If omitted or invalid, uses global registration (slower propagation). |
| `TICKET_CATEGORY_ID` | No | — | Discord category ID. Channels under this category are treated as ticket channels. |
| `SUPPORT_ROLE_ID` | No | — | Role ID for support staff. Members with this role get view/send access to all ticket channels. |
| `TICKET_CHANNEL_PREFIX` | No | `ticket-` | Prefix for ticket channel names when `TICKET_CATEGORY_ID` is not set. |
| `AUTO_REPLY_COOLDOWN_SEC` | No | `300` | Cooldown in seconds. Repeated identical messages from the same user in the same channel within this window are suppressed. Set to `0` to disable. |
| `AI_ENABLED` | No | `false` | Set to `true` to enable OpenAI fallback for unmatched messages. |
| `OPENAI_API_KEY` | No | — | Required only when `AI_ENABLED=true`. |
| `OPENAI_MODEL` | No | `gpt-4.1-mini` | OpenAI model to use for AI replies. |
| `SCORE_PORTAL_URL` | No | `https://portal.soneium.org/en/profile/YOUR_WALLET_ADDRESS` | URL appended to score portal auto-replies. |
| `ROLE_TAG_ESCALATION_MENTIONS` | No | `@Alicia @Ramz @Jerad` | Text sent when a user @-mentions a role in a ticket channel. |
| `DEBUG_AUTOREPLY` | No | `false` | Set to `true` to enable verbose `[auto-reply]` console logging. |

---

## Discord Commands

### `/ticketpanel`
- **Permission required:** `ManageChannels`
- **Effect:** Posts an embed with an "Open a support ticket!" button in the current channel.
- Clicking the button opens a modal requesting:
  - Startale App Smart Wallet Address
  - Connected EOA Wallet Address
- On submit, a private text channel named `ticket-{userId}` is created with a "Close Ticket" button.

### `/deletebotreply`
- **Permission required:** User ID must be in `AUTO_REPLY_EXCLUDED_USER_IDS` (hardcoded support staff IDs).
- **Effect:** Finds and deletes the most recent bot message in the current channel (within the last 50 messages).

---

## Core Logic — How Auto-Reply Works

Auto-reply is triggered in the `MessageCreate` event handler (`src/bot.js:756`).

### Flow

```
MessageCreate event
  → skip if: not in guild, bot message, not a ticket channel
  → if author is in AUTO_REPLY_EXCLUDED_USER_IDS (support staff):
      → if message starts with "!test ": simulate reply for testing
      → otherwise: check for prior bot reply → enable manual handoff if so
      → return (never auto-reply to support staff)
  → if channel is in manual handoff mode → skip (human has taken over)
  → if message @-mentions a role or @everyone → send ROLE_TAG_ESCALATION_MENTIONS
  → cooldown check (shouldReplyForContent): skip if same content within cooldown window
  → getRuleBasedReply(content) → if match found, send reply
  → if no rule matched and AI_ENABLED: getAIReply(content) → send if non-null
```

### Ticket Channel Detection (`isTicketChannel`)

A channel is treated as a ticket channel if:
1. It is a `GuildText` channel **and** (`TICKET_CATEGORY_ID` is set and matches `channel.parentId`) **or** the channel name starts with `TICKET_CHANNEL_PREFIX`.
2. It is a thread — if `TICKET_CATEGORY_ID` is set, checks thread or parent category; if not, falls back to name prefix matching; otherwise accepts all threads the bot can see.

### Rule-Based Reply System (`getRuleBasedReply`)

Located at `src/bot.js:231–465`. Uses `includesAny()` (substring match) and `includesWord()` (word-boundary regex) on lowercased content.

Rules are evaluated **in priority order** — the first match wins:

| Priority | Issue | Key Trigger Terms | Response |
|----------|-------|-------------------|----------|
| 1 | GM / Gasless action | `gm`, `gasless action` + failure terms | `GM_FIXING_VARIANTS` (random) |
| 2 | Sake Finance | `sake` + `finance`/`task`/`deposit`/`points` | `SAKE_FINANCE_REPLY` |
| 3 | Star Point LNY (processing) | `processing` + point/wheel terms + wait terms | `STAR_POINT_LNY_PROCESSING_REPLY` |
| 4 | Star Point LNY (general) | `lny`/`star point` + mission/swap/checkmark | `STAR_POINT_LNY_REPLY` |
| 5 | Soneium Score Portal | `soneium`/`score portal` + access/failure terms | `SCORE_REPLY_VARIANTS` (random) + portal URL |
| 6 | Passkey / Google login | `passkey`/`gmail`/`google account` + failure terms | `GENERAL_FIXING_VARIANTS` (random) |
| 7 | Forgot password | `forgot password`/`reset password` + related terms | `FORGOT_PASSWORD_REPLY` |
| 8 | EOA signing | `eoa` + `sign`/`signature` + failure terms | `EOA_SIGNING_FIXING_VARIANTS` (random) |
| 9 | AA/Smart Wallet migration | `aa`/`account abstraction`/`smart wallet` + `migrate`/`upgrade` | `AA_MIGRATION_RESOLVED_VARIANTS` (random) |
| 10 | Earn Vault | `earn vault`/`vault` + failure terms | `EARN_VAULT_FIXING_VARIANTS` (random) |
| 11 | Wallet connection | `wallet`/`metamask`/`rabby` + failure terms | `WALLET_FIXING_VARIANTS` (random) |
| 12 | Migration (general) | `migrate`/`migration`/`account upgrade` + failure terms | `MIGRATION_FIXING_VARIANTS` (random) |
| 13 | Bridge | `bridge`/`auto bridge`/`invariant failed`/`claim failed` | `BRIDGE_FIXING_VARIANTS` (random) |
| 14 | Swap / LP / Liquidity | `swap` (word), `lp` (word), `liquidity`/`deposit` — only if no checkmark signal | `SWAP_FIXING_VARIANTS` (random) |
| 15 | Discord role | `discord role`/`role`/`roles` + issue terms | `DISCORD_ROLE_REPLY` |
| 16 | "Still fixing?" | `still`/`yet`/`waiting` + `fix`/`resolve`, or days-waiting regex | `STILL_FIXING_VARIANTS` (random) |
| — | No match | — | `null` (no reply, or AI fallback if enabled) |

All matched replies are prefixed with `FIXING_GREETING` ("Hello, thank you for the report!") via `withGreeting()`.

### AI Fallback (`getAIReply`)

- Only called when `AI_ENABLED=true` and `OPENAI_API_KEY` is valid.
- Calls `POST https://api.openai.com/v1/responses` with a system prompt positioning the model as a Startale support assistant.
- Max 220 output tokens.
- Failures return `null` silently.

---

## Cooldown System

Implemented in `shouldReplyForContent()` (`src/bot.js:187`).

- Key: `channelId:userId`
- Stored in `lastReplyByChannelUser` (in-memory `Map`).
- Only suppresses if the **normalized content is identical** and within the cooldown window.
- Content normalization: lowercase, collapse whitespace, strip non-alphanumeric/non-space characters.
- Cooldown does NOT apply to `AUTO_REPLY_EXCLUDED_USER_IDS`.

---

## Manual Handoff Mode

- `MANUAL_HANDOFF_CHANNEL_IDS` is an in-memory `Set`.
- When a support staff member (excluded user ID) sends a message in a channel that already has at least one prior bot reply, that channel is added to `MANUAL_HANDOFF_CHANNEL_IDS`.
- Once in handoff mode, the bot stops auto-replying in that channel.
- **This state is lost on bot restart.**

---

## Testing Support

There is no automated test suite. Testing is done manually:

- **Support staff test prefix:** Send `!test <message>` in a ticket channel. The bot simulates `getRuleBasedReply()` on `<message>` and prints the result prefixed with `[Support Test]`.
- Only users in `AUTO_REPLY_EXCLUDED_USER_IDS` can trigger this (hardcoded IDs: `516260929093107729`, `747167440945020978`).
- **Debug logging:** Set `DEBUG_AUTOREPLY=true` in `.env` to enable `[auto-reply]` console output.

---

## Key Constants (Hardcoded)

These values are in `src/bot.js` and cannot be changed via `.env`:

| Constant | Value | Purpose |
|----------|-------|---------|
| `OPEN_TICKET_BUTTON_ID` | `open_ticket` | Button custom ID |
| `CLOSE_TICKET_BUTTON_ID` | `close_ticket` | Button custom ID |
| `PANEL_COMMAND_NAME` | `ticketpanel` | Slash command name |
| `DELETE_AUTO_REPLY_COMMAND_NAME` | `deletebotreply` | Slash command name |
| `OPEN_TICKET_MODAL_ID` | `open_ticket_modal` | Modal custom ID |
| `SMART_WALLET_INPUT_ID` | `smart_wallet_address` | Modal field ID |
| `EOA_WALLET_INPUT_ID` | `eoa_wallet_address` | Modal field ID |
| `SUPPORT_TEST_PREFIX` | `!test ` | Support test trigger |
| `FIXING_GREETING` | `Hello, thank you for the report!` | Reply prefix |
| `AUTO_REPLY_EXCLUDED_USER_IDS` | Two hardcoded Discord user IDs | Support staff who bypass auto-reply |

---

## Code Conventions

- **ES Modules** throughout (`import`/`export`, no CommonJS `require`).
- **Constants in UPPER_SNAKE_CASE** for all config, IDs, and reply text.
- **Early returns** for validation and guard clauses in event handlers.
- **`pickRandom(array)`** used for all response variant selection.
- **`withGreeting(reply)`** wraps all auto-replies with the greeting prefix.
- **`includesAny(text, words)`** for substring matching; **`includesWord(text, word)`** for word-boundary matching.
- Error logging: `console.error()` for failures; `console.warn()` for config warnings; `debugLog()` (gated on `DEBUG_AUTOREPLY`) for verbose tracing.
- Korean console messages are intentional (the project originated in Korean).

---

## Discord.js Intents Required

The bot requires these Gateway intents (set in the `Client` constructor):

```js
GatewayIntentBits.Guilds
GatewayIntentBits.GuildMessages
GatewayIntentBits.MessageContent   // Privileged intent — must be enabled in Discord Developer Portal
```

`MessageContent` is a **privileged intent**. It must be explicitly enabled in the Discord Developer Portal under the bot's settings.

---

## Adding New Auto-Reply Rules

To add a new rule:

1. Define response text as a constant at the top of `src/bot.js` (use an array for variants, a string for single responses).
2. Add a detection block inside `getRuleBasedReply()` before the `return null` at the end.
3. Use `includesAny(text, [...])` for substring matching and `includesWord(text, word)` for whole-word matching.
4. Return `withGreeting(pickRandom(VARIANTS))` or `withGreeting(SINGLE_REPLY)`.
5. Consider rule priority — earlier checks win. Place more specific rules before broader ones.

---

## Modifying Support Staff User IDs

The list of support staff (users who bypass auto-reply and can use `!test`) is hardcoded:

```js
// src/bot.js:60–63
const AUTO_REPLY_EXCLUDED_USER_IDS = new Set([
  '516260929093107729',
  '747167440945020978'
]);
```

To add/remove a support staff member, update this set directly.

---

## State & Persistence

The bot has **no persistent storage**. All runtime state is in-memory:

| State | Type | Lost on restart? |
|-------|------|-----------------|
| Cooldown tracking | `Map<string, {at, content}>` | Yes |
| Manual handoff channels | `Set<string>` | Yes |
| AI key warning shown flag | `boolean` | Yes |

Ticket channels themselves persist in Discord after restart. Cooldowns and handoff state do not.

---

## Deployment Notes

- No Docker or process manager config is included. Use PM2, systemd, or a cloud runner.
- The bot must run continuously — state (cooldowns, handoffs) is in-memory only.
- Slash commands are registered on every startup. Guild-scoped commands propagate instantly; global commands can take up to 1 hour.
- Ensure `MessageContent` privileged intent is enabled in the Discord Developer Portal.
