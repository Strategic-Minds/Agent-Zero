# BUILDER DOC 02 — BROWSER LAYER
# Fixes: FAANG Parity (60→80), AI Intelligence (82→90)
# Score impact: +10 points
# Deploy: Vercel Workflow → single push

## WHAT NEEDS TO EXIST

Playwright-core + Chromium running inside Vercel serverless functions.
Vercel Pro allows 1024MB memory functions — enough for Chromium.

## FILES TO CREATE/MODIFY

### agents/browser-real.ts (CREATE — replaces browser.ts stub)

```typescript
import chromium from "@sparticuz/chromium-min"
import { chromium as pw } from "playwright-core"

export interface BrowserResult {
  url: string
  title: string
  content: string
  screenshot_base64?: string
  links: string[]
  forms: Array<{ name: string; fields: string[] }>
  error?: string
}

export async function launchBrowser(): Promise<Browser>
export async function navigateTo(browser: Browser, url: string): Promise<Page>
export async function extractPageContent(page: Page): Promise<BrowserResult>
export async function clickElement(page: Page, selector: string): Promise<void>
export async function typeIntoField(page: Page, selector: string, text: string): Promise<void>
export async function submitForm(page: Page, selector: string): Promise<void>
export async function takeScreenshot(page: Page): Promise<string>  // base64
export async function searchWeb(query: string): Promise<BrowserResult[]>
export async function scrapeLeadsFromPage(url: string): Promise<Lead[]>
```

### app/api/browser/route.ts (CREATE)
```typescript
POST /api/browser
Body: { action: "navigate" | "click" | "type" | "screenshot" | "scrape", url: string, selector?: string, value?: string }
Auth: BRIDGE_SECRET header
maxDuration: 60
memory: 1024 (set in vercel.json)
```

### next.config.js (MODIFY)
```javascript
experimental: {
  serverComponentsExternalPackages: ["playwright-core", "@sparticuz/chromium-min"]
}
```

### vercel.json (MODIFY — add function memory override)
```json
{
  "functions": {
    "app/api/browser/**": { "memory": 1024 }
  }
}
```

## NPM PACKAGES
playwright-core
@sparticuz/chromium-min

## HEADFUL vs HEADLESS
- Headless (default): production scraping, validation, automation
- Headful: set PLAYWRIGHT_HEADFUL=true for debug/dev mode only
- Both handled by same browser-real.ts with env flag

## VALIDATOR INTEGRATION
headless-validator.ts gets upgraded:
- CF_01 (ARIA chat): use real browser, type into chat input, read response
- UF_01 (full flow): navigate → click → type → submit → read
- New test: BRW_01 "Browser navigates and extracts content"
- New test: BRW_02 "Browser fills and submits a form"
- New test: BRW_03 "Browser takes screenshot of homepage"

## EXPECTED SCORE AFTER THIS DOC
FAANG Parity: 60 → 80 (+20)
AI Intelligence: 82 → 90 (+8)
Overall: 74 → 82 (+8)
