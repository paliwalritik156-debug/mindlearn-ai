# Tests

One-time setup (in the frontend folder):

    npm i -D vitest jsdom

Then add this line under "scripts" in package.json:   "test": "vitest run"

Run:   npm test

`tests/unit/` = fast checks of the core logic (XP, streaks, planner, leagues, Hinglish, lite mode).
