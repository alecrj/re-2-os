# ResellerOS - Channel Integrations

> This document defines marketplace integration strategy.
> Updated in Phase 1: Discovery and Phase 2: Planning.

## Channel Strategy
| Channel | Mode | Status | Notes |
|---------|------|--------|-------|
| eBay | Native API | Researched | Primary channel - comprehensive API, low risk |
| Poshmark | Assisted (Cross-list) | Researched | No official API, use cross-listing tools |
| Mercari | Assisted (Cross-list) | Researched | Official import feature, API-integrated tools |
| Depop | Assisted (Cross-list) | Researched | Cross-listing allowed, bots prohibited |

---

## eBay Integration

### Overview
eBay provides a comprehensive REST API ecosystem for selling automation. The APIs use OAuth 2.0 authentication and support all major eBay marketplaces (20+ sites including US, UK, DE, AU, CA, FR).

**Integration Mode**: Native API (fully supported, official)

### Core APIs for ResellerOS

#### 1. Inventory API
**Purpose**: Create and manage inventory items, then publish as eBay listings.

**Key Endpoints**:
| Method | Endpoint | Description |
|--------|----------|-------------|
| PUT | `/inventory_item/{sku}` | Create/update inventory item |
| GET | `/inventory_item/{sku}` | Retrieve single item |
| GET | `/inventory_item` | List all items (paginated) |
| DELETE | `/inventory_item/{sku}` | Delete inventory item |
| POST | `/bulk_create_or_replace_inventory_item` | Bulk create (up to 25 items) |
| POST | `/bulk_update_price_quantity` | Bulk update prices/quantities |
| POST | `/offer` | Create offer (stage for listing) |
| POST | `/offer/{offerId}/publish` | Publish offer as live listing |
| POST | `/bulk_publish_offer` | Bulk publish (up to 25 offers) |

**Inventory Item Required Fields** (for publishing):
- `sku` - Seller-defined, max 50 chars, must be unique
- `condition` - NEW, LIKE_NEW, NEW_OTHER, etc.
- `availability.shipToLocationAvailability.quantity`
- `product.title` - Max 80 characters
- `product.description` - Max 4000 characters
- `product.imageUrls` - Max 24 images (12 for variations)

**Offer Required Fields** (for publishing):
- `marketplaceId` - Target eBay site (e.g., EBAY_US)
- `format` - AUCTION or FIXED_PRICE
- `categoryId` - Leaf category ID
- `merchantLocationKey` - Inventory location
- `pricingSummary.price`
- `availableQuantity`
- `listingDuration`
- Payment, fulfillment, and return policy IDs

**Critical Limitations**:
- Listings created via Inventory API CANNOT be edited through Seller Hub or Trading API
- All revisions must go through the Inventory API
- **250 revision limit per listing per calendar day** - blocked until next day if exceeded
- Listings with active bids/best offers cannot be revised within 12 hours of ending

**Rate Limit**: 2,000,000 calls/day

---

#### 2. Fulfillment API
**Purpose**: Manage orders, shipping, refunds, and payment disputes.

**Key Endpoints**:
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/order/{orderId}` | Get specific order details |
| GET | `/order` | Search orders (by date, status) |
| POST | `/order/{orderId}/shipping_fulfillment` | Create shipping fulfillment |
| GET | `/order/{orderId}/shipping_fulfillment` | Get fulfillments for order |
| POST | `/order/{orderId}/issue_refund` | Issue full/partial refund |
| GET | `/payment_dispute/{payment_dispute_id}` | Get dispute details |
| POST | `/payment_dispute/{id}/contest` | Contest a dispute |
| POST | `/payment_dispute/{id}/accept` | Accept a dispute |

**Capabilities**:
- Retrieve buyer/seller info, line items, payment status
- Track fulfillment status
- Issue refunds (order or line-item level, processed async)
- Handle payment disputes from PayPal, Visa, etc.
- Upload evidence for dispute resolution

**Limitation**: Only covers completed checkout transactions (excludes pending payments)

**Rate Limits**:
- Standard apps: 100,000 calls/day
- eBay Compatible apps: 2,500,000 calls/day

---

#### 3. Finances API
**Purpose**: Track financial data, payouts, fees, and transactions.

**Key Endpoints**:
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/payout/{payout_id}` | Get specific payout |
| GET | `/payout` | List payouts with filters |
| GET | `/payout_summary` | Aggregated payout data |
| GET | `/transaction` | List transactions |
| GET | `/transaction_summary` | Aggregated transaction data |
| GET | `/seller_funds_summary` | Pending/available/held funds |
| GET | `/billing_activities` | Billing and fee records |

**Available Data**:
- Payouts to bank accounts
- Loan repayments (eBay Seller Capital)
- Shipping costs
- Sales transactions
- Refunds and returns
- eBay fees and charges
- Pending/held funds

**Limitations**:
- Data limited to last 5 years
- No Team Access support (only requesting user's data)
- EU/UK sellers require Digital Signatures

---

#### 4. Account API
**Purpose**: Manage seller business policies and account settings.

**Key Endpoints**:
| Resource | Description |
|----------|-------------|
| `fulfillment_policy` | Shipping options and carriers |
| `payment_policy` | Payment methods and terms |
| `return_policy` | Return windows and conditions |
| `custom_policy` | Product compliance (5 marketplaces only) |
| `sales_tax` | Sales tax table management |
| `rate_table` | Shipping rate tables |
| `program` | Seller program opt-in/status |

**Rate Limit**: 25,000 calls/day

---

#### 5. Marketing API
**Purpose**: Manage Promoted Listings, promotions, and store email campaigns.

**Promoted Listings Features**:
- **Cost Per Sale (CPS)**: Pay only when buyer purchases within 30 days
- **Cost Per Click (CPC)**: Pay per ad click
- Campaign types: Manual targeting, Smart targeting, Promoted Offsite
- Manage ad groups, keywords, bids

**Discounts Manager**:
- Markdown discounts (direct price reductions)
- Threshold discounts (triggered by purchase volume)
- Volume pricing

**Store Email Campaigns**: 6 email campaign types for subscribers

---

#### 6. Notification API (Webhooks)
**Purpose**: Subscribe to real-time event notifications.

**Available Topics** (17 total):
| Topic | Description |
|-------|-------------|
| `MARKETPLACE_ACCOUNT_DELETION` | User requests account closure |
| `AUTHORIZATION_REVOCATION` | User revokes app permissions |
| `ORDER_CONFIRMATION` | Checkout completes |
| `ITEM_AVAILABILITY` | Fixed-price item availability changes |
| `ITEM_PRICE_REVISION` | Item prices change |
| `ITEM_MARKED_SHIPPED` | Seller marks item shipped |
| `BUYER_QUESTION` | Buyer asks about listing |
| `NEW_MESSAGE` | User receives message |
| `FEEDBACK_LEFT` | User leaves feedback |
| `FEEDBACK_RECEIVED` | User receives feedback |
| `SELLER_STANDARDS_PROFILE_METRICS` | Seller level changes |
| `SELLER_CUSTOMER_SERVICE_METRIC_RATING` | Performance metrics change |

**Implementation**:
- Configure HTTPS webhook endpoints
- eBay sends challenge code for verification
- Notifications include X-EBAY-SIGNATURE header
- SDKs available: Java, .NET, Node.js, PHP, Go
- Supports JSON Schema filtering

**Rate Limit**: 10,000 calls/day

---

#### 7. Feed API (Bulk Operations)
**Purpose**: Upload/download bulk feed files for large-scale operations.

**Capabilities**:
- Bulk listing creation and management
- Supports CSV, XML, JSON formats (compressed .gz available)
- Scheduled automated report generation
- Async processing with task tracking

**File Retention**:
- Order reports: 30 days
- Active inventory reports: 90 days
- Other LMS types: 3 days (requests), 90 days (responses)

**Rate Limit**: 100,000 calls/day

---

#### 8. Taxonomy API
**Purpose**: Navigate eBay category structure and item specifics.

**Capabilities**:
- Retrieve category trees by marketplace
- Find optimal categories for listings
- Get required/recommended item aspects (specifics)
- Map expired categories to active replacements

**Rate Limit**: 5,000 calls/day (Tier 1)

---

#### 9. Metadata API
**Purpose**: Retrieve marketplace configuration and policy requirements.

**Available Data**:
- Category policies and listing requirements
- Item condition metadata
- Variation support by category
- Return policy requirements
- Best Offer capabilities
- Shipping carriers and handling times
- Parts compatibility specifications

**Supports**: 19 eBay marketplaces

---

#### 10. Browse API
**Purpose**: Search eBay items and retrieve product data.

**Capabilities**:
- Search by keyword, image (Base64), category, GTIN, product ID
- Filter by aspects (color, size, brand), price, condition, location
- Get item details: description, pricing, shipping, return policies
- Compatibility checking for auto parts

**Limitations**:
- Max 10,000 items per result set
- No wildcard searches
- Default returns FIXED_PRICE items only

**Rate Limit**: 5,000 calls/day

---

#### 11. Compliance API (DEPRECATED - decommissioned March 30, 2026)
**Purpose**: Identify listing policy violations.

**Tracked Violations**:
- Missing/invalid item specifics (aspects adoption)
- HTTP links instead of HTTPS
- External links/contact info in descriptions
- Unsupported return periods (many sites require 30+ days)

---

### Authentication

#### OAuth 2.0 Flow
eBay uses OAuth 2.0 exclusively for REST APIs.

**Token Types**:
1. **Application Access Token** (Client Credentials Grant)
   - Access resources owned by the application
   - No user interaction required

2. **User Access Token** (Authorization Code Grant)
   - Access resources owned by the user (seller account)
   - Requires user consent flow
   - Needed for: Inventory, Fulfillment, Finances, Account APIs

**Client Libraries Available**:
- Android, C#, Java, Node.js, Python

**Required Headers**:
- `Authorization: Bearer <access_token>`
- `Content-Type: application/json`
- `Content-Language: en-US` (for content creation)
- `X-EBAY-C-MARKETPLACE-ID: EBAY_US` (marketplace selection)

---

### Rate Limits Summary

| API | Daily Limit (Standard) | Compatible App Limit |
|-----|------------------------|---------------------|
| Inventory API | 2,000,000 | - |
| Fulfillment API | 100,000 | 2,500,000 |
| Account API | 25,000 | - |
| Feed API | 100,000 | - |
| Notification API | 10,000 | - |
| Taxonomy API | 5,000 | - |
| Browse API | 5,000 | - |
| Inventory Mapping API | 20 | - |
| Payment Dispute methods | 250,000 (combined) | - |
| Media API (POST) | 50 requests/5 seconds (user-level) | - |

**Increasing Limits**: Requires Application Growth Check - verify compliance with API License Agreement and efficient API usage.

---

### Sandbox vs Production

| Aspect | Sandbox | Production |
|--------|---------|------------|
| URL Base | `api.sandbox.ebay.com` | `api.ebay.com` |
| Site | sandbox.ebay.com | ebay.com |
| Users | Virtual test users only | Real eBay accounts |
| Transactions | Simulated | Real money |
| Data | Isolated, no production impact | Live marketplace |
| Rate Limits | May differ | Full limits apply |
| Credentials | Separate keyset | Separate keyset |

**Test User Features**:
- Usernames prefixed with `TESTUSER_`
- Customizable feedback scores, registration dates
- Multiple roles (buyer, seller)
- Cross-border testing supported

---

### Key Constraints and Failure Modes

#### Listing Constraints
1. **250 revisions/day limit** - Cannot exceed; blocks until next calendar day
2. **Inventory API lock-in** - Listings created via Inventory API must be managed via Inventory API only
3. **12-hour freeze** - Cannot revise listings with active bids/offers within 12 hours of ending
4. **Title limit**: 80 characters
5. **Description limit**: 4000 characters
6. **Image limits**: 24 per listing, 12 for multi-variation

#### Policy Requirements
- Must opt into business policies (fulfillment, payment, returns)
- At least one inventory location required before creating offers
- Category-specific item specifics may be required

#### Compliance Risks
- HTTP links (must use HTTPS)
- External links in descriptions (prohibited except product videos, freight info, legal disclosures)
- Personal contact info in listings
- Return policies below marketplace minimum (often 30 days)

#### API Failure Modes
| Scenario | Impact | Mitigation |
|----------|--------|------------|
| Rate limit exceeded | 429 errors, blocked calls | Implement backoff, use Analytics API to monitor |
| Token expired | 401 errors | Implement refresh token flow |
| Revision limit hit | Cannot update listing | Queue updates for next day |
| Invalid category | Listing rejected | Use Taxonomy API to validate |
| Missing required aspects | Listing rejected or compliance violation | Use Metadata API to get requirements |
| Sandbox/Prod mismatch | Unexpected behavior | Separate config per environment |

---

### ResellerOS Integration Recommendations

#### Phase 1: Core Features
1. **Inventory Management**: Use Inventory API for all listing creation/updates
2. **Order Sync**: Fulfillment API for order retrieval and shipping updates
3. **Webhook Setup**: Notification API for ORDER_CONFIRMATION, ITEM_AVAILABILITY

#### Phase 2: Enhanced Features
1. **Financial Tracking**: Finances API for profit calculations (real fees)
2. **Bulk Operations**: Feed API for large inventory syncs
3. **Marketing**: Marketing API for Promoted Listings automation

#### Autopilot Considerations
- Price adjustments: Must respect 250/day revision limit
- Quantity sync: Bulk update endpoint available
- Listing optimization: Can update titles, descriptions, images programmatically
- Repricing: Implement rate limiting to avoid revision cap

---

## ToS Constraints

> **CRITICAL**: Getting banned from marketplaces would be catastrophic for users.
> This section documents what is allowed vs prohibited on each platform.

### Summary: Integration Risk Matrix

| Platform | Official API | Third-Party Tools Allowed | Automation Risk Level | Safe Path |
|----------|-------------|---------------------------|----------------------|-----------|
| eBay | Yes (comprehensive) | Yes (with certification) | LOW | Native API + Compatible App certification |
| Poshmark | No | Technically prohibited, rarely enforced | MEDIUM | Cross-listing tools, human-speed actions |
| Mercari | Limited (import only) | Cross-listing allowed | MEDIUM-LOW | Official cross-list import, API-integrated tools |
| Depop | No | Cross-listing allowed, bots prohibited | MEDIUM | Cross-listing platforms only |

---

### eBay ToS Constraints

#### User Agreement (Effective February 20, 2026)

**Prohibited Activities** (Section 3 - Using eBay):
> "use any robot, spider, scraper, data mining tools, data gathering and extraction tools, or other automated means (including, without limitation buy-for-me agents, LLM-driven bots, or any end-to-end flow that attempts to place orders without human review) to access our Services for any purpose, except with the prior express permission of eBay."

**What This Means for ResellerOS**:
- Scraping eBay is prohibited
- AI purchasing agents are explicitly banned
- Automated checkout flows require eBay permission
- **Exception**: Official API access is explicitly permitted

**AI-Specific Restrictions (January 2026 Update)**:
- LLM-driven bots blocked in robots.txt
- Buy-for-me agents explicitly prohibited
- Third-party AI agents (Perplexity, Anthropic, Amazon) blocked
- Google Shopping bot is the only exception for cart access
- OpenAI Operator has special testing arrangement with eBay

#### API License Agreement (Updated September 2025)

**Permitted Uses**:
- Seller tools for inventory management, listing, order management
- Pricing tools (with eBay written consent for Restricted APIs)
- Cross-listing to eBay from other platforms

**Prohibited Uses**:
- Seller arbitrage (auto-repricing based on third-party prices)
- Dropshipping automation (ordering from third-party sites)
- Using eBay data to train third-party AI models
- Building services competitive to eBay
- Sharing API credentials or data with non-customers

**Restricted APIs** (require special consent):
- Market trends data
- Pricing strategies data
- Sales volume data
- User behavior data

#### eBay Compatible Application Certification

**Benefits of Certification**:
- Unlimited API access (no call limits)
- Higher rate limits (e.g., 2.5M vs 100K for Fulfillment API)
- Official partner status
- Listed in eBay's third-party provider directory

**Requirements**:
- Pass eBay's Compatible Application Check
- Comply with API License Agreement
- Meet security and reliability standards

#### eBay Risk Assessment

| Activity | Risk Level | Notes |
|----------|------------|-------|
| Using official APIs | SAFE | Explicitly supported |
| Certified third-party tools | SAFE | eBay partner ecosystem |
| Non-certified API tools | LOW | Must follow API agreement |
| Scraping listings | HIGH | Explicitly prohibited |
| Automated purchasing | CRITICAL | Banned, may result in legal action |
| Training AI on eBay data | HIGH | Prohibited without consent |

**Recommendation**: Use Native API integration. Consider eBay Compatible Application certification for production.

---

### Poshmark ToS Constraints

#### Terms of Service (Section 4.b)

**Prohibited Activities**:
> "copy, scrape, harvest, crawl or use any technology, software or automated systems to collect any information or data"

**Additional Prohibitions**:
- Creating multiple accounts to evade restrictions
- Interfering with service infrastructure through overloading
- Reverse engineering any service components
- Violating anti-spam regulations

**Community Guidelines Statement**:
> "Do not use programs or other forms of automation to participate on Poshmark. This includes, but is not limited to liking, sharing, following, and unfollowing."

#### Enforcement Reality

**Important Context**:
Despite explicit ToS prohibition, Poshmark has a unique enforcement pattern:
- No known history of accounts being banned solely for using bots
- High-performing sellers using automation are financially valuable to Poshmark
- Enforcement focuses on: scamming, counterfeit items, harassment, order issues

**"Share Jail" Mechanism**:
- Temporary 24-hour sharing block triggered by excessive activity
- Not a ban - just rate limiting
- Indicates Poshmark monitors for bot-like behavior patterns
- Affects: sharing, liking, commenting

**November 2025 Incident**:
- Mass listing deletions and account suspensions occurred
- Poshmark blamed "third party apps"
- Affected sellers had to change passwords
- Deleted listings were eventually recovered
- Suspensions were lifted

#### Third-Party Tool Landscape

Popular tools in the Poshmark ecosystem:
- Vendoo (cross-listing)
- Closet Assistant (sharing automation)
- Poshmark Pro Tools (various automation)
- List Perfectly (cross-listing)
- Nifty (automation + analytics)

These tools operate in a gray area - technically against ToS but widely used.

#### Poshmark Risk Assessment

| Activity | Risk Level | Notes |
|----------|------------|-------|
| Manual cross-listing | SAFE | No automation involved |
| Cross-listing tools (Vendoo, etc.) | LOW-MEDIUM | Widely used, API-integrated preferred |
| Sharing bots (moderate speed) | MEDIUM | Share jail possible, no permanent bans known |
| Aggressive automation (fast bots) | HIGH | Share jail, potential scrutiny |
| Scraping user data | HIGH | Explicitly prohibited |
| Multiple accounts | HIGH | Grounds for termination |

**Recommendation**: Use established cross-listing platforms with API integrations. Avoid aggressive automation. Keep activity patterns human-like.

---

### Mercari ToS Constraints

#### Prohibited Conduct Policy

**Explicit Prohibition**:
> "use any robot, spambot, spider, crawler, scraper or other automated means or interface not provided by us to access the Service or to extract data"

**Additional Prohibited Activities**:
- Disabling or circumventing copy protection features
- Reverse engineering source code
- Interfering with network/equipment/servers
- Multiple accounts
- Duplicate listings
- Misleading product information

#### Official Cross-Listing Support

**Key Finding**: Mercari officially supports cross-listing tool imports.

**Mercari Cross-Listing Import Feature**:
- Desktop-only feature
- Supported source platforms: eBay, Poshmark, Depop
- Items import as drafts (require activation)
- No automatic sync - listings are independent after import
- Price range: $1-$2,000

**API Integration Status (August 2024 Change)**:
- Mercari changed its API structure
- Manual cross-listings experienced deisting failures
- Verified automation tools with official Mercari integration are recommended
- Tools like Vendoo and Closo have OAuth connections with Mercari

#### Mercari Risk Assessment

| Activity | Risk Level | Notes |
|----------|------------|-------|
| Official cross-list import | SAFE | Mercari-provided feature |
| API-integrated cross-listing tools | LOW | OAuth-authenticated, legitimate |
| Browser extensions mimicking clicks | HIGH | Violates ToS, detectable |
| Scraping listings | HIGH | Explicitly prohibited |
| Multiple accounts | CRITICAL | Permanent ban risk |
| Data extraction | HIGH | Explicitly prohibited |

**Recommendation**: Use Mercari's official cross-listing import or API-integrated tools (Vendoo, Closo, Nifty). Avoid browser automation extensions.

---

### Depop ToS Constraints

#### Terms of Service

**Cross-Listing Explicitly Allowed**:
> "You may simultaneously list your items for sale on other platforms and/or marketplaces (each an Alternative Platform) via third party cross-listing platforms, as long as you: Fully comply with our Terms of Service."

**Prohibited Activities**:
- Unauthorized automation bots
- Spamming
- Direct API access without authorization

#### Bot Detection (2025 Status)

**Current State**:
- Depop has increased bot detection sophistication
- Algorithms detect unusual behavior patterns faster
- Focus is on behavior patterns, not specific tools
- No official API for third-party sellers

**What Gets Detected**:
- Auto-following patterns
- Auto-liking patterns
- Mass refreshing
- Inhuman action speeds

#### Depop Risk Assessment

| Activity | Risk Level | Notes |
|----------|------------|-------|
| Cross-listing platforms | SAFE | Explicitly allowed in ToS |
| Manual listing management | SAFE | Normal user behavior |
| Following/liking bots | HIGH | Against ToS, detectable |
| Refresh/bump bots | HIGH | Pattern detection in 2025 |
| Scraping | HIGH | Prohibited |

**Recommendation**: Use cross-listing platforms only. Avoid engagement automation (follow/like/refresh bots).

---

### Cross-Platform Safe Practices

#### Recommended Architecture for ResellerOS

1. **eBay**: Native API integration (primary channel)
   - Full automation capability
   - Official support
   - Lowest risk

2. **Poshmark/Mercari/Depop**: Assisted mode via established cross-listing platforms
   - Leverage existing OAuth integrations
   - Benefit from platform relationships
   - Avoid direct automation

#### Integration Partner Ecosystem

**Established Cross-Listing Platforms** (sorted by Mercari/Poshmark safety):

| Platform | eBay | Poshmark | Mercari | Depop | OAuth/API |
|----------|------|----------|---------|-------|-----------|
| Vendoo | Yes | Yes | Yes | Yes | Yes |
| List Perfectly | Yes | Yes | Yes | Yes | Yes |
| Nifty | Yes | Yes | Yes | Yes | Yes |
| Closo | Yes | Yes | Yes | Yes | Yes |
| Crosslist | Yes | Yes | Yes | Yes | Yes |

These platforms have:
- Established relationships with marketplaces
- Proper OAuth authentication where available
- Years of operation without mass bans
- Auto-delist on sale (prevents overselling)

#### Automation Guardrails

**For Any Platform**:
1. Rate limit all actions to human-plausible speeds
2. Add randomization to timing patterns
3. Implement exponential backoff on errors
4. Monitor for "jail" or throttling signals
5. Never attempt to circumvent security measures
6. Keep activity within platform norms

**Activity Speed Guidelines**:
| Action | Safe Rate | Aggressive (Risky) |
|--------|-----------|-------------------|
| Sharing (Poshmark) | 1-2 per minute | 10+ per minute |
| Following | 20-30 per hour | 100+ per hour |
| Listing creation | 10-20 per hour | 50+ per hour |
| Price updates | Per platform limits | Bulk rapid changes |

---

### Failure Modes and Recovery

#### Account Suspension Scenarios

| Platform | Trigger | Recovery Path | Timeline |
|----------|---------|---------------|----------|
| eBay | API abuse | Contact developer support, fix compliance | Days to weeks |
| eBay | ToS violation | Appeal process | Weeks |
| Poshmark | Share jail | Wait 24 hours | 24 hours |
| Poshmark | Account suspension | Contact support, explain | Days to weeks |
| Mercari | Policy violation | Appeal via support | Days |
| Mercari | Permanent ban | New account prohibited, rarely reversed | Permanent |
| Depop | Bot detection | Account warning or suspension | Varies |

#### Catastrophic Failure Scenarios

1. **Platform-wide third-party tool crackdown**
   - Mitigation: Use only established, API-integrated tools
   - Mitigation: Have manual fallback procedures

2. **API terms change**
   - Mitigation: Monitor developer communications
   - Mitigation: Maintain compliance documentation

3. **Mass account bans**
   - Mitigation: Keep activity conservative
   - Mitigation: Diversify across platforms
   - Mitigation: Document compliance efforts

---

### Legal Considerations

**Terms of Service are Contracts**:
- Violation can result in account termination
- Platforms have discretion in enforcement
- "Failure to enforce... does not constitute a waiver"

**Computer Fraud and Abuse Act (CFAA)**:
- Unauthorized access to computer systems
- eBay has explicitly warned of legal action for unauthorized automation
- Scraping against ToS may have legal implications

**Recommendation**: Stay within official channels. When in doubt, use platforms with official API access or partner relationships.

---

---

## Channel Strategy

> **Decision Owner**: integrations-lead
> **Decided**: 2026-02-03 (SUBTASK-204)
> **ADR**: docs/decisions/ADR-0001-channel-strategy.md

### Strategic Principles

1. **Safety First**: User account safety is paramount. We will not implement features that create meaningful ban risk.
2. **API-Native When Possible**: Official APIs are the only truly safe integration path.
3. **Honest About Limitations**: We will clearly communicate what we can and cannot automate per channel.
4. **Assisted Over Sketchy**: Where automation is risky, we provide assisted workflows, not hidden automation.

---

### Integration Mode Definitions

| Mode | Definition | User Experience | Risk Level |
|------|------------|-----------------|------------|
| **Native** | Direct API integration with official marketplace APIs | Fully automated listing, orders, repricing | SAFE |
| **Assisted** | Integration via established cross-listing partners OR manual-assist workflows | Semi-automated, may require user action | LOW-MEDIUM |
| **Manual** | No automation; ResellerOS tracks data only | User lists manually, we track inventory/sales | SAFE |

---

### Channel Decisions (MVP vs Future)

#### MVP Channels (Phase 1 Launch)

| Channel | Mode | Rationale |
|---------|------|-----------|
| **eBay** | Native | Comprehensive API, 2M calls/day, official support, lowest risk, largest resale market |
| **Poshmark** | Assisted | No API, but high volume channel for fashion. Use cross-listing partner integration OR manual tracking with assisted workflows |
| **Mercari** | Assisted | Has official cross-list import feature. Use Mercari's import OR cross-listing partner integration |

**Why These Three?**
- eBay: Largest market, best API, safest. Must-have.
- Poshmark: #2 fashion marketplace. 80M users. Too important to skip despite API limitations.
- Mercari: Growing fast, official cross-listing support makes it lower risk than Poshmark.

#### Phase 2 Expansion

| Channel | Mode | Rationale |
|---------|------|-----------|
| **Depop** | Assisted | ToS explicitly allows cross-listing. Add after core channels stable. |
| **Facebook Marketplace** | Manual | No reliable API, automation heavily restricted. Track-only. |

#### Phase 3 / Future Consideration

| Channel | Mode | Rationale |
|---------|------|-----------|
| **Etsy** | Native | Has official API. Add when we expand beyond fashion/general resale. |
| **Grailed** | Assisted | Niche (high-end menswear). Evaluate demand. |
| **Whatnot** | TBD | Live selling platform. Different model. Evaluate. |
| **International** | TBD | eBay UK/DE/AU via same API. Evaluate demand. |

---

### Channel-Specific Strategies

#### eBay (Native - MVP)

**Integration Approach**:
- Full Inventory API integration for listing creation/management
- Fulfillment API for order sync and shipping updates
- Finances API for real fee tracking (profit truth)
- Notification API webhooks for real-time order/listing events
- Consider eBay Compatible Application certification for higher rate limits

**Automation Capabilities**:
- Create listings from ResellerOS
- Sync inventory quantities
- Reprice within guardrails (respect 250 revisions/day limit)
- Auto-pull orders
- Track actual fees for profit calculation

**Failure Modes and Mitigations**:
| Risk | Mitigation |
|------|------------|
| 250 revision/day limit hit | Queue updates for next day, warn user |
| Token expiration | Implement refresh token flow, alert user if refresh fails |
| Rate limit exceeded | Exponential backoff, queue requests |
| Listing compliance violation | Use Taxonomy/Metadata APIs to validate before publish |

---

#### Poshmark (Assisted - MVP)

**Why Assisted, Not Native**:
- No official API exists
- ToS explicitly prohibits automation
- However: Cross-listing tools are widely used without bans
- Risk is real but manageable with conservative approach

**Integration Options** (in order of preference):

1. **Cross-Listing Partner Integration**
   - Partner with Vendoo, List Perfectly, or similar via their API
   - User connects their Poshmark via partner tool
   - We push listings to partner, they handle Poshmark
   - Pros: Liability on partner, established relationship with Poshmark
   - Cons: Dependency, cost pass-through, UX complexity

2. **Manual-Assist Mode**
   - User lists on Poshmark manually
   - ResellerOS provides listing template (copy-paste title, description, price)
   - User reports sale, we update inventory
   - Pros: Zero risk, simple
   - Cons: Manual effort, delays in sync

**Recommendation**: Start with Manual-Assist for MVP, explore partner integration for v1.1.

**What We Will NOT Do**:
- Direct browser automation (bot-like behavior)
- Auto-sharing, auto-following, auto-liking
- Any automation that could trigger "share jail" or worse

**User Communication**:
- Clear messaging: "Poshmark does not provide an API. We help you list efficiently, but you complete the final steps."
- Provide one-click copy for all listing fields
- Track Poshmark inventory and sales manually entered by user

---

#### Mercari (Assisted - MVP)

**Why Assisted, Not Native**:
- Mercari has no public API for sellers
- However: Has official cross-listing import feature
- API-integrated cross-listing tools (Vendoo, etc.) work reliably

**Integration Options** (in order of preference):

1. **Mercari Official Import**
   - Mercari allows importing from eBay, Poshmark, Depop
   - ResellerOS lists to eBay first, user imports to Mercari
   - Pros: Official feature, zero risk
   - Cons: Manual step, items import as drafts

2. **Cross-Listing Partner Integration**
   - Same as Poshmark - partner with OAuth-integrated tools
   - Pros: More automated
   - Cons: Dependency, cost

3. **Manual-Assist Mode**
   - Same as Poshmark - templates and manual entry
   - Pros: Zero risk
   - Cons: Manual effort

**Recommendation**:
- MVP: Manual-Assist + guidance to use Mercari's official import from eBay
- v1.1: Evaluate cross-listing partner integration

**What We Will NOT Do**:
- Browser extensions that mimic clicks
- Any scraping or data extraction

---

#### Depop (Assisted - Phase 2)

**Why Phase 2, Not MVP**:
- Smaller market than eBay/Poshmark/Mercari
- ToS explicitly allows cross-listing (lower risk than Poshmark)
- Can add after core experience is solid

**Integration Approach**:
- Cross-listing partner integration OR manual-assist
- Same patterns as Poshmark/Mercari

---

### Risk Mitigation Framework

#### User Protections

1. **Clear Disclaimers**
   - Per-channel explanation of what is automated vs manual
   - Risk disclosure for assisted channels
   - No false promises about capabilities

2. **Conservative Defaults**
   - Human-like delays built into any automation
   - Rate limiting well below platform detection thresholds
   - No aggressive features (mass following, etc.)

3. **Audit Trail**
   - Log all actions taken on user's behalf
   - User can see what happened and when
   - Easy to explain to platform support if questioned

4. **Account Isolation**
   - ResellerOS actions should not look like coordinated bot network
   - Randomization in timing and patterns
   - Each user operates independently

#### Platform Monitoring

1. **ToS Tracking**
   - Monitor platform ToS changes quarterly
   - Alert engineering if changes affect our approach
   - Update user documentation promptly

2. **Incident Response**
   - If user reports suspension, investigate immediately
   - Document patterns, adjust features if needed
   - Never hide risk from users

---

### Rollout Plan

#### Phase 1: MVP Launch
- **eBay**: Full native integration
- **Poshmark**: Manual-assist mode (copy-paste templates, inventory tracking)
- **Mercari**: Manual-assist mode + eBay import guidance

**Success Criteria**:
- Users can list to eBay from ResellerOS
- Users can track Poshmark/Mercari inventory in ResellerOS
- Zero user account suspensions attributable to ResellerOS

#### Phase 2: Assisted Upgrade (Post-MVP)
- **Poshmark/Mercari**: Evaluate cross-listing partner integration
- **Depop**: Add manual-assist mode

**Go/No-Go Criteria**:
- MVP stable for 30+ days
- User demand validated
- Partner integration terms acceptable

#### Phase 3: Expansion
- Additional channels based on user demand
- International eBay sites
- Potential Etsy native integration

---

### Competitive Positioning

| Competitor | Channels | Our Advantage |
|------------|----------|---------------|
| Vendoo | 11 | We're honest about risk; they push ToS limits |
| List Perfectly | 11 | We have mobile-first; they open browser tabs |
| Crosslist | 11 | We auto-delist; they don't |
| Flyp | 6 | We have more channels (at MVP) |
| Nifty | 5 | We have more channels (at MVP) |

**Positioning Statement**:
"ResellerOS gives you eBay native automation and safe assisted workflows for Poshmark and Mercari. We will never risk your accounts with sketchy automation."

---

### Open Questions for Architecture Phase

1. **Cross-listing Partner API**: Do we build partner integration in Phase 1 or Phase 2?
2. **Manual Entry UX**: How do we make manual-assist mode feel fast and not tedious?
3. **Inventory Sync**: How do we handle inventory across channels when some are manual?
4. **Sale Detection**: For manual channels, do we poll eBay for sales and prompt user to check others?

---

## Status
- **Current**: Channel Strategy complete (Phase 2)
- **Updated**: 2026-02-03 (SUBTASK-204: Channel Strategy completed)
- **Completed Research**:
  - eBay: Native API (11 APIs documented) + ToS constraints
  - Poshmark: ToS constraints + enforcement reality
  - Mercari: ToS constraints + official cross-listing support
  - Depop: ToS constraints + cross-listing allowance
- **Completed Decisions**:
  - MVP channels: eBay (native), Poshmark (assisted), Mercari (assisted)
  - Phase 2 expansion: Depop (assisted), Facebook (manual)
  - Risk mitigation framework defined
- **Next Update**: Phase 3 (Architecture) - Technical integration design
