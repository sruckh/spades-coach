# Spades Coach — Design System

A web-based Spades game that teaches while you play. This document defines the
visual language, tokens, and layout rules for a **9:16 mobile-first** experience.

---

## 1. Design thesis

Spades lives at a felt table: four players seated at the compass points
(N / E / S / W), two partnerships facing each other, a contract bid before every
hand, and a single trick fought in the middle. The design encodes that world
literally so the layout itself teaches:

- **Seating is a compass rose.** You (South) always sit at the bottom, your
  partner (North) at the top, opponents East/West on the sides. Turn order and
  partnership are spatial, not explained in prose.
- **The trick zone is the center of gravity.** Every played card lands in the
  middle, pointing back toward its player, so the flow of a trick is legible.
- **The Coach is a character, not a tooltip.** Strategy arrives in a warm,
  low-stakes slide-up panel — the voice of someone leaning over your shoulder.

We deliberately avoid the casino-green-felt cliché. The mood is a **night parlor**:
ink-navy table, brass reward accents, real card-stock cream. Brass is earned —
it appears when you make your bid, win a trick, or the Coach highlights the smart
play. That restraint is what makes the reward feel like a reward.

**Signature element:** the compass-rose table with a live trick zone at its heart.

---

## 2. Color

Semantic tokens. Never hard-code a hex outside this table.

| Token | Hex | Role |
|---|---|---|
| `--table-ink` | `#141C2E` | App background — the parlor at night |
| `--table-ink-deep` | `#0D1420` | Deepest wells, modal scrim base |
| `--felt` | `#1E2A44` | The playing surface, raised above the ink |
| `--felt-line` | `#2C3A57` | Hairline seams, seat dividers, borders |
| `--card-stock` | `#F4EFE3` | Card faces, Coach panel — warm paper |
| `--card-edge` | `#D9D0BC` | Card shadow edge, paper depth |
| `--brass` | `#C9A24B` | Reward accent: bids made, tricks won, focus |
| `--brass-bright` | `#E4C273` | Brass highlight / active glow |
| `--ink-text` | `#EAE6DC` | Primary text on dark |
| `--ink-muted` | `#8C97AD` | Secondary text, labels, captions |
| `--suit-red` | `#C0392B` | Hearts & Diamonds |
| `--suit-black` | `#1B2230` | Spades & Clubs (ink, not pure black) |
| `--spade-glow` | `#5B7FB0` | Spade emphasis — the trump suit's own color |
| `--good` | `#5C9A6E` | On track to make bid |
| `--warn` | `#C77D3E` | Bag / overtrick warning |

**Usage rules**
- Brass is precious. One brass element per screen state at most.
- Spades are the trump suit and get their own cool-blue glow (`--spade-glow`)
  when they matter — this teaches trump visually.
- `--good` / `--warn` only ever touch the bid tracker, never chrome.

---

## 3. Typography

Three roles, loaded from Google Fonts.

| Role | Family | Use |
|---|---|---|
| Display | **Fraunces** (opsz, high contrast serif) | Scores, seat bids, Coach headline, big moments |
| Body | **Inter** | UI, buttons, Coach body text |
| Data | **Space Mono** | Card counts, bid/trick tallies, timers — anything tabular |

Fraunces gives the "card-parlor / vintage playing-card" character with restraint;
Inter keeps the interface quiet and legible on a phone; Space Mono makes numbers
line up so the bid tracker reads like a scoreboard.

**Type scale** (mobile base 16px)

```
display-xl   34 / 1.05   Fraunces 600   scores, hero numbers
display-lg   26 / 1.1    Fraunces 600   Coach headline
title        19 / 1.25   Inter 600      panel titles
body         15 / 1.5    Inter 400      Coach text, descriptions
label        13 / 1.3    Inter 600      seat names, buttons (tracking .04em, caps)
data        15 / 1       Space Mono 500 tallies
caption      11 / 1.3    Inter 500      hints, meta (tracking .06em, caps)
```

---

## 4. Layout — 9:16 mobile

Everything fits a portrait phone frame with three stacked zones. Controls live
in the bottom third for thumb reach.

```
┌───────────────────────────┐  ← 9:16 frame, max 420px wide
│  STATUS BAR               │   round · your bid/made · score
│  ─────────────────────    │
│                           │
│          [ N ]            │   partner (top)
│                           │
│  [W]    ╔═════╗    [E]     │   TRICK ZONE — center of gravity
│         ║ ♠ ♥ ║           │   played cards point to their player
│         ╚═════╝           │
│                           │
│          seat: YOU        │   your seat label + bid chip
│                           │
│  ┌─────────────────────┐  │
│  │  YOUR HAND (fanned)  │  │   13 cards, arc fan, tap to play
│  └─────────────────────┘  │
│                           │
│  [ Coach ]      [ Bid ]   │   thumb-zone actions
└───────────────────────────┘
        ↑ Coach panel slides up over lower 2/3 when opened
```

**Grid & spacing** — 8px base. Gutters 16px. Safe-area padding for notches.
Spacing scale: `4 · 8 · 12 · 16 · 24 · 32 · 48`.

**Seating** uses the compass so it survives any screen size: South anchored
bottom-center, North top-center, West/East vertically centered on the edges.

**Radii:** cards `10px`, panels `20px 20px 0 0` (sheet), chips/pills `999px`,
buttons `12px`.

---

## 5. The card

Cards are the product; they must feel like paper.

- Face: `--card-stock`, `10px` radius, subtle bottom `--card-edge` shadow for lift.
- Rank + suit top-left, mirrored bottom-right (real card anatomy).
- Suit color per token table; spades tinted toward `--suit-black` but gain the
  `--spade-glow` ring when the Coach flags them or when spades are led.
- **Playable** cards sit `8px` higher with a brass hairline; **unplayable**
  (can't follow suit rules) drop opacity to 45% and lose the lift — the rules
  teach themselves through what you *can* touch.
- Hand is a fanned arc (~ -18° to +18°), overlapping ~60%.

---

## 6. The Coach panel

A slide-up sheet — the teaching heart of the app.

- Surface `--card-stock`, top-rounded, `--card-edge` top hairline, soft scrim
  (`--table-ink-deep` at 62%) behind.
- Fraunces headline (e.g. "Lead low, save your Ace"), Inter body, one brass
  "Got it" confirm.
- **Contextual mode:** during play, tapping a card can pop a one-line Coach
  whisper ("Following suit — no choice here") anchored above the hand instead
  of the full sheet.
- Coach never blocks the trick zone longer than needed; it dismisses on tap-out.

---

## 7. Motion

Deliberate, few, and reduced-motion aware.

| Moment | Motion | Duration / ease |
|---|---|---|
| Card played | slide from seat → trick zone, small settle | 320ms `cubic-bezier(.2,.8,.2,1)` |
| Trick won | four cards sweep toward winner's seat | 420ms ease-out |
| Bid made | seat's bid chip fills brass, single pulse | 500ms |
| Coach open | sheet rises + scrim fade | 300ms |
| Playable lift | translateY on hand render | 180ms |

`@media (prefers-reduced-motion: reduce)` — replace all travel with cross-fades,
no sweeps, no pulse.

---

## 8. Quality floor

- Responsive from 320px up; layout locks to a centered 9:16 frame on wider screens.
- Visible keyboard focus (`--brass-bright` 2px ring) on every interactive element.
- Hit targets ≥ 44px. Card taps have generous padded hit zones despite overlap.
- Color is never the only signal: playable state also changes elevation; bid
  status also changes label text.
- Contrast: `--ink-text` on `--table-ink` and `--suit-*` on `--card-stock` all
  meet WCAG AA.
