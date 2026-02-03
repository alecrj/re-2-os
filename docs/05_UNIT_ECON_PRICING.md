# ResellerOS - Unit Economics & Pricing

> This document defines pricing tiers and cost model.
> Researched: 2026-02-03 (SUBTASK-105)

## Cost Structure

### AI Costs (Per Listing)

| Service | Model | Cost Basis | Est. per Listing |
|---------|-------|------------|------------------|
| Image Analysis | GPT-4o Vision (low) | 85 tokens @ $2.50/1M | $0.0002 |
| Image Analysis | GPT-4o Vision (high) | 1,100 tokens @ $2.50/1M | $0.003 |
| Title/Desc Gen | GPT-4o-mini | ~500 tokens @ $0.60/1M | $0.0003 |
| Title/Desc Gen | GPT-4o | ~500 tokens @ $10/1M | $0.005 |
| Smart Pricing | GPT-4o-mini | ~200 tokens @ $0.60/1M | $0.0001 |

**Cost-optimized listing**: ~$0.001-0.002
**Full-featured listing**: ~$0.01-0.02

### Background Removal Costs

| Provider | Cost per Image | Notes |
|----------|---------------|-------|
| PhotoRoom Basic | $0.02 | $20/mo minimum |
| PhotoRoom Partner | $0.01 | $1,000/mo minimum |
| Self-hosted (rembg) | ~$0 | Compute only |

### Image Storage Costs

| Provider | Storage/GB | Egress/GB |
|----------|------------|-----------|
| **Cloudflare R2** | $0.015 | FREE |
| AWS S3 | $0.023 | $0.09 |

**Per 1,000 listings**: ~2.5GB = $0.04/month on R2

### Infrastructure (Estimated Monthly)

| Component | Service | Est. Cost |
|-----------|---------|-----------|
| Hosting | Vercel/Railway | $20-50 |
| Database | Supabase/PlanetScale | $25-50 |
| Queue/Jobs | Inngest/Trigger.dev | $0-25 |
| **Total Base** | | **$50-125** |

---

## Per-Listing Cost Scenarios

### Scenario A: Full AI Features
| Component | Cost |
|-----------|------|
| Image analysis (4 photos, high) | $0.012 |
| Title/description | $0.005 |
| Background removal (4 photos) | $0.08 |
| Storage | $0.001 |
| **Total** | **~$0.10** |

### Scenario B: Cost-Optimized
| Component | Cost |
|-----------|------|
| Image analysis (4 photos, low) | $0.001 |
| Title/description (mini) | $0.0003 |
| No background removal | $0 |
| Storage | $0.001 |
| **Total** | **~$0.003** |

### Scenario C: Hybrid (Recommended)
| Component | Cost |
|-----------|------|
| Image analysis (1 photo, high) | $0.003 |
| Title/description (GPT-4o) | $0.005 |
| Background removal (1 hero) | $0.02 |
| Storage | $0.001 |
| **Total** | **~$0.03** |

---

## Competitor Pricing Analysis

| Competitor | Entry | Mid | Pro | Power |
|------------|-------|-----|-----|-------|
| Vendoo | $8.99 (25 items) | $19.99 (125) | $49.99 (2,000) | $69.99 (4,000) |
| List Perfectly | $29 (unlimited) | $49 | $69 | $99-249 |
| Crosslist | $24.99 (~100) | $34.99 (~250) | $49.99 (500+) | - |
| Flyp | $9 (flat) | - | - | - |
| Nifty | $25 | $40 | $90 | - |

**Key insights:**
- Two models: volume-based (Vendoo) vs feature-based (List Perfectly)
- Entry: $9-29/mo
- Mid-volume: $30-50/mo
- High-volume: $50-100/mo

---

## Proposed Pricing Tiers

### Starter ($19/mo)
- **New items/month**: 50
- **AI features**: Basic (GPT-4o-mini, low-detail vision)
- **Background removals**: 10/month
- **Est. COGS**: ~$0.50 | **Margin**: 97%

### Pro ($39/mo)
- **New items/month**: 250
- **AI features**: Full (GPT-4o, high-detail vision)
- **Background removals**: 100/month
- **Autopilot rules**: 5 active
- **Est. COGS**: ~$12.50 | **Margin**: 68%

### Power ($69/mo)
- **New items/month**: 1,000
- **AI features**: Full
- **Background removals**: 500/month
- **Autopilot rules**: Unlimited
- **Priority support**
- **Est. COGS**: ~$50 | **Margin**: 28%

### Team ($149/mo)
- **New items/month**: 5,000
- **AI features**: Full
- **Background removals**: 2,500/month
- **Sub-accounts**: 3 included
- **API access**
- **Est. COGS**: ~$200 | **Margin**: -34% (loss leader)

---

## Margin Analysis

### At 100 Users (Mixed Tiers)
- Est. MRR: ~$4,000
- Est. COGS: ~$600-800
- Est. Infrastructure: ~$200
- **Gross margin: ~75-80%**

### At 1,000 Users
- Est. MRR: ~$40,000
- Est. COGS: ~$6,000-8,000
- Est. Infrastructure: ~$500-1,000
- **Gross margin: ~78-82%**

---

## Viability Assessment

### Conclusion: VIABLE

**Reasons:**
1. AI costs dropped significantly (GPT-4o-mini at $0.15-0.60/1M tokens)
2. Storage costs negligible with R2 (free egress)
3. Background removal manageable at $0.02/image
4. Competitor pricing validates $20-70/month range
5. 75-80% gross margins achievable

### Risks:
1. BG removal costs spike if users demand more
2. AI abuse (rate limit needed)
3. Team tier is loss leader (need upsells)

### Mitigations:
1. Tier BG removals explicitly
2. Rate limit AI calls per user
3. Self-hosted rembg at scale

---

## FINAL PRICING DECISIONS (Phase 2)

### Free Tier: YES
- **Listings/month**: 3
- **Platforms**: eBay only
- **AI features**: Basic
- **Background removals**: 0
- **Autopilot**: None
- **Purpose**: Trial conversion (not forever-free)

### Final Tier Structure

| Tier | Price | Listings/mo | BG Removals | Autopilot Rules |
|------|-------|-------------|-------------|-----------------|
| Free | $0 | 3 | 0 | 0 |
| Starter | $19 | 50 | 10 | 1 |
| Pro | $39 | 250 | 100 | 5 |
| Power | $79 | 1,000 | 500 | Unlimited |
| Business | $149 | 3,000 | 1,500 | Unlimited |

### Annual Discount: 17% (2 months free)

### Overage Policy
- Soft limits with upgrade prompts (no hard fees)
- BG removal add-on packs: $5/50 or $15/200

---

## Status
- **Current**: COMPLETE (Phase 2 Planning)
- **Updated**: 2026-02-03
- **Owner**: planner
