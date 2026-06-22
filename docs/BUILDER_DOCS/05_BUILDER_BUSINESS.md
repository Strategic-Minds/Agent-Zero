# BUILDER DOC 05 — BUSINESS LAYER
# Fixes: Business Value (41→88)
# Score impact: +5 points
# Deploy: Vercel Workflow → single push

## XPS INTELLIGENCE + STRATEGIC MINDS ADVISORY

### LEAD DISCOVERY SOURCES (Real Data)
Google Maps Places API → Contractors in AZ searching "epoxy flooring" "concrete coating" "garage floor"
Yelp Fusion API → Home services category, Phoenix/Scottsdale/Tucson
BBB API → Flooring contractors, active listings
AZ Corp Commission → Direct registry scrape (public)
Angi/HomeAdvisor → Public contractor listings

### lib/scraper.ts — FULL IMPLEMENTATION SPEC
```typescript
interface Lead {
  company_name: string; phone: string; email?: string; website?: string
  address: string; city: string; state: string; zip: string
  source: string; category: string; rating?: number; reviews?: number
}

// Google Maps Places API
async function scrapeGoogleMaps(query: string, location: string, radius = 50000): Promise<Lead[]> {
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query + " " + location)}&key=${GOOGLE_MAPS_API_KEY}`
  // Parse results → Lead[]
}

// Yelp Fusion
async function scrapeYelp(term: string, location: string, limit = 50): Promise<Lead[]> {
  const url = `https://api.yelp.com/v3/businesses/search?term=${term}&location=${location}&limit=${limit}`
  // Headers: { Authorization: "Bearer " + YELP_API_KEY }
}

// BBB (public scrape — no auth needed)
async function scrapeBBB(category: string, city: string): Promise<Lead[]> {
  const url = `https://www.bbb.org/search?find_text=${category}&find_loc=${city}`
  // Use Playwright browser for JS-rendered page
}
```

### WHATSAPP BUSINESS API — COMPLIANT SEQUENCE
```
NOT cold outbound. Compliant inbound-first flow:
1. Lead clicks "Get Quote" on XPS website → enters phone
2. System sends WhatsApp opt-in confirmation
3. Lead replies YES → enters 5-message nurture sequence
4. Day 1: Welcome + portfolio images
5. Day 2: Before/after gallery
6. Day 3: Pricing overview  
7. Day 5: Special offer + CTA
8. Day 7: Direct close attempt
```

### app/api/webhook/whatsapp/route.ts (CREATE)
Handles inbound WhatsApp messages from Meta webhook.
Routes to ARIA for intelligent response.

### app/api/whatsapp/route.ts (CREATE)
Sends outbound messages via Meta Cloud API.

### HUBSPOT SYNC — TWO-WAY
lib/hubspot.ts already exists (read-only).
ADD write operations:
- createContact() when lead discovered
- updateContactStage() when lead scored
- logActivity() after call/outreach

### PROPOSAL GENERATOR
agents/proposal-agent.ts (CREATE)
Generates AI-written, branded proposals.
Output: HTML template → PDF via Playwright print-to-PDF.

### ENV VARS NEEDED
WHATSAPP_BUSINESS_TOKEN
WHATSAPP_PHONE_NUMBER_ID  
WHATSAPP_VERIFY_TOKEN (for webhook verification)
GOOGLE_MAPS_API_KEY
YELP_API_KEY
HUBSPOT_API_KEY (update to write-capable token)

## EXPECTED SCORE AFTER THIS DOC
Business Value: 41 → 85 (+44)
AI Intelligence: 90 → 93 (+3)
Overall: 95 → 97 (+2)
