# PLAYWRIGHT & BROWSER AUTOMATION — SPEC
# Builder Doc 11 | Headless + Headful Browser System

## CURRENT STATE
browser.ts exists but uses Browserbase API stub.
Playwright not installed. No real browser automation live.

## TARGET STATE
Full Playwright/Chromium on Vercel via one of:

### Option A: Playwright-Core + Vercel Layer (PREFERRED)
- Install: playwright-core + @sparticuz/chromium-min
- This provides Chromium binary compatible with Vercel Lambda
- Works on Vercel Pro (1024MB memory per function)
- Cost: 0 (included in Pro)

### Option B: Browserless.io
- External headless Chrome API
- $49/month for 10 concurrent sessions
- No binary management

### Option C: Bright Data Scraping Browser
- Managed browser with proxy rotation
- Best for anti-bot bypass

## PLAYWRIGHT CAPABILITIES ONCE LIVE
1. Full page navigation + screenshot
2. Form filling + submission
3. JavaScript execution on page
4. Network interception
5. Cookie + session management
6. PDF generation from any URL
7. Multi-page scraping with pagination
8. Login automation (CRM systems)
9. Lead form submission automation
10. Competitor site monitoring

## IMPLEMENTATION PLAN
File: agents/browser.ts (rewrite)
- Use playwright-core with sparticuz chromium
- Expose: navigate, scrape, screenshot, fill_form, extract_text
- Route: POST /api/browser (auth: BRIDGE_SECRET)
- Memory: store results in ghost_runs table

## VERCEL SANDBOX INTEGRATION
Vercel Sandbox provides isolated execution environments.
Use for: untrusted code execution, sandboxed browser sessions.
Configure: vercel.json "sandbox" property (Pro feature).
