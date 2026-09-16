# Platform-wide UI/UX refresh

## Goal
Make Gridiron Gods feel immediately understandable and comfortable on phones while keeping its cream, green, and gold identity and all current business behavior.

## What will change

### 1. Establish one reusable interface system
- Strengthen readability and contrast for supporting text.
- Standardize page headings, status summaries, cards, fields, buttons, empty states, loading placeholders, and inline messages.
- Make all primary controls at least 44px tall with clear keyboard focus and disabled states.
- Keep Oswald for short sports headings and use the body typeface for instructions and data.

### 2. Simplify navigation and page context
- Refine the signed-in header and bottom navigation so the active destination is unmistakable.
- Give every signed-in page the same clear opening structure: title, short context, then the main action or selector.
- Improve league and week selectors for small screens.
- Make horizontally scrolling tabs easier to discover and accessible to screen readers.

### 3. Improve first-time and account journeys
- Clarify the home page’s main action and benefits without adding marketing clutter.
- Make login, signup, email, and phone choices proper accessible tabs.
- Clarify password-based phone access and provide better busy, error, and success feedback.
- Improve form labels, guidance, validation states, and return navigation.

### 4. Make leagues and dashboard action-oriented
- Turn league rows into clearer summaries with obvious next actions.
- Replace abrupt loading text with stable loading placeholders.
- Improve empty states with a direct next step.
- Reorganize dashboard information so active leagues and weekly tasks come before account management.
- Keep membership and username controls available in a clearly separated account section.

### 5. Make weekly picks easier and safer
- Show visible completion progress for each pick set.
- Make set selectors and team choices accessible, with selected states announced.
- Explain exactly what remains before a set can be saved, including missing picks or tiebreaker.
- Preserve the sticky mobile save action while reducing visual crowding.
- Keep locked, saved, final, winning, and losing states visually distinct.

### 6. Improve standings, leaderboard, and league sections
- Standardize money summaries and rankings for faster scanning.
- Make season/week and chart controls accessible segmented controls.
- Improve no-results guidance and loading states.
- Keep mobile card lists and efficient desktop tables.
- Preserve all existing tabs and features while improving labels and touch targets.

### 7. Make commissioner work predictable
- Keep league and week context visible throughout commissioner tasks.
- Standardize section tabs, summary cards, payment controls, member rows, money forms, bank actions, and chat states.
- Add clearer pending/success/error feedback around destructive and financial actions.
- Improve labels and touch safety for member removal and settings forms.

## Technical details
- Use the existing semantic color tokens and shared controls; no business logic, database, or payment behavior changes.
- Add small reusable presentation components for loading, empty, page-heading, segmented-control, and status patterns where they reduce inconsistency.
- Add ARIA tab semantics, selected/pressed states, live announcements, explicit form associations, and visible focus styles.
- Verify the main public and authenticated journeys at 393px mobile and 1280px desktop, including overflow and text fitting.
- Confirm every content route retains unique metadata and the final build has no errors.

## Success criteria
- A first-time user can identify the next action on every screen without explanation.
- Frequent tasks—open a league, submit picks, check standings, record payments—are reachable and readable on one hand-held phone.
- No important action relies on color alone, hidden horizontal scrolling, or unexplained disabled controls.
- Existing data, permissions, calculations, subscriptions, and payment behavior remain unchanged.
