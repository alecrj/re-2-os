# ResellerOS - Autopilot Rules

> This document defines automation rules, guardrails, and safety mechanisms.
> Updated in Phase 2: Planning (SUBTASK-205).

---

## Core Philosophy

**Automation with guardrails, not blind automation.**

Every autopilot action must:
1. Be reversible (undo within 24 hours)
2. Be logged with full context
3. Respect user-set floors and caps
4. Have a confidence threshold
5. Allow user override at any time

**The user is always in control.** Autopilot is a helpful assistant, not an autonomous agent.

---

## Confidence Thresholds

All autopilot actions are gated by confidence levels. Actions with low confidence pause and request human review.

| Confidence Level | Threshold | Behavior |
|------------------|-----------|----------|
| HIGH | >= 90% | Auto-execute, log only |
| MEDIUM | 70-89% | Auto-execute, notify user |
| LOW | 50-69% | Queue for approval, notify user |
| VERY_LOW | < 50% | Block, require manual action |

**What affects confidence:**
- Item value (higher value = lower confidence)
- Pattern match quality
- Historical accuracy of similar actions
- Time since last user activity

---

## 1. Offer Automation

### Overview
Automatically respond to buyer offers based on user-defined rules.

### Triggers
| Trigger | Description | Platform |
|---------|-------------|----------|
| `OFFER_RECEIVED` | Buyer submits offer | eBay, Poshmark |
| `OFFER_EXPIRING` | Offer expires in < 2 hours | eBay |
| `COUNTER_RECEIVED` | Buyer responds to counter | eBay, Poshmark |

### Rules

#### Auto-Accept Rules
| Rule | Default | User-Configurable | Example |
|------|---------|-------------------|---------|
| Accept if >= X% of asking | 90% | Yes (50-100%) | Accept $45 on $50 item |
| Accept if >= floor price | Always | Floor is required | Accept if >= $35 floor |
| Accept if profit margin >= X% | 20% | Yes (0-50%) | Accept if net profit >= 20% |

**Logic (all must pass):**
```
IF offer_amount >= (asking_price * auto_accept_threshold)
AND offer_amount >= floor_price
AND calculated_profit_margin >= min_profit_margin
AND confidence >= 70%
THEN auto_accept
```

#### Auto-Decline Rules
| Rule | Default | User-Configurable | Example |
|------|---------|-------------------|---------|
| Decline if < X% of asking | 50% | Yes (30-80%) | Decline $20 on $50 item |
| Decline if < floor price | Always | Floor is required | Decline if < $35 floor |
| Decline if profit margin < X% | 0% | Yes (-10% to 20%) | Decline if losing money |

**Logic (any triggers decline):**
```
IF offer_amount < (asking_price * auto_decline_threshold)
OR offer_amount < floor_price
OR calculated_profit_margin < min_profit_margin
THEN auto_decline
```

#### Auto-Counter Rules
| Rule | Default | User-Configurable | Example |
|------|---------|-------------------|---------|
| Counter if between decline/accept | Enabled | Yes | Offer $30, counter at $40 |
| Counter amount strategy | Midpoint | floor/midpoint/asking-5% | Various |
| Max counter rounds | 2 | Yes (1-5) | Stop after 2 counters |

**Counter Strategies:**
1. **floor**: Counter at floor price
2. **midpoint**: Counter at midpoint between offer and asking
3. **asking-5%**: Counter at 5% below current asking
4. **custom**: User-defined formula

**Logic:**
```
IF offer_amount > auto_decline_threshold
AND offer_amount < auto_accept_threshold
AND counter_rounds < max_counter_rounds
THEN auto_counter(strategy)
```

### Offer Guardrails

| Guardrail | Limit | Reason |
|-----------|-------|--------|
| Max auto-accepts/day | 50 | Prevent runaway sales at low margins |
| Max auto-counters/day | 100 | Platform rate limits |
| High-value item threshold | $200 | Items above require manual review |
| New listing grace period | 48 hours | No auto-accept on items < 48 hours old |
| Offer history check | 3 offers/buyer/item | Flag repeat lowballers |

### Offer Flow Diagram
```
OFFER_RECEIVED
    |
    v
[Check floor_price]
    |
    +-- Below floor --> AUTO_DECLINE
    |
    v
[Check auto_decline_threshold]
    |
    +-- Below threshold --> AUTO_DECLINE
    |
    v
[Check auto_accept_threshold]
    |
    +-- Above threshold --> [Check confidence]
    |                           |
    |                           +-- HIGH/MEDIUM --> AUTO_ACCEPT
    |                           +-- LOW --> QUEUE_FOR_REVIEW
    |
    v
[Between thresholds] --> AUTO_COUNTER (if enabled)
                              |
                              +-- Max rounds exceeded --> QUEUE_FOR_REVIEW
```

---

## 2. Repricing Automation

### Overview
Automatically adjust prices based on market conditions, time on market, and performance metrics.

### Triggers
| Trigger | Description | Check Frequency |
|---------|-------------|-----------------|
| `TIME_BASED` | Daily repricing window | Once/day (user-configurable) |
| `VIEWS_DROP` | Views decline by X% week-over-week | Daily |
| `COMPETITOR_PRICE` | Similar item listed lower (eBay only) | Daily |
| `STALE_THRESHOLD` | Item reaches X days without sale | Daily |
| `DEMAND_SIGNAL` | Multiple watchers/likes/offers | Real-time |

### Repricing Strategies

#### 1. Time-Decay Strategy (Default)
Gradually reduce price based on days listed.

| Days Listed | Price Adjustment | Example ($50 item) |
|-------------|------------------|-------------------|
| 0-14 | 0% (hold) | $50 |
| 15-30 | -5% | $47.50 |
| 31-45 | -10% (cumulative) | $45 |
| 46-60 | -15% (cumulative) | $42.50 |
| 61-90 | -20% (cumulative) | $40 |
| 90+ | Flag for review | Manual decision |

#### 2. Performance-Based Strategy
Adjust based on listing performance metrics.

| Condition | Action | Cooldown |
|-----------|--------|----------|
| Views < 10 in 7 days | -5% price | 7 days |
| Views > 50, no offers | -3% price | 7 days |
| Multiple watchers (3+) | Hold price | - |
| Offer received | Hold price 48 hours | 48 hours |

#### 3. Competitive Strategy (eBay Only)
Match or beat similar listings.

| Condition | Action | Limit |
|-----------|--------|-------|
| 3+ similar items priced 10%+ lower | Match lowest + $1 | Floor price |
| Average sold price < asking | Reduce to avg + 5% | Floor price |
| No similar items available | Hold price | - |

### Repricing Rules

**Price Change Limits:**
| Limit Type | Default | User-Configurable | Reason |
|------------|---------|-------------------|--------|
| Max daily drop per item | 10% | Yes (5-20%) | Prevent price collapse |
| Max weekly drop per item | 20% | Yes (10-40%) | Gradual reductions |
| Max monthly drop per item | 35% | Yes (20-50%) | Preserve value |
| Minimum price (floor) | Required | User-set | Protect margins |
| Price increase cap | +5%/week | Yes | Prevent gouging signals |

**Floor Price Calculation:**
Users can set floors manually or use calculated floors:
```
suggested_floor = cost_basis + shipping_cost + platform_fees + min_profit_margin
```

| Component | Source |
|-----------|--------|
| cost_basis | User-entered purchase price |
| shipping_cost | Estimated or user-entered |
| platform_fees | Calculated per platform (eBay ~13%, Poshmark 20%, etc.) |
| min_profit_margin | User-set (default: $5 or 10%, whichever is higher) |

### Repricing Guardrails

| Guardrail | Limit | Reason |
|-----------|-------|--------|
| Max reprices/day/listing | 2 | Prevent manipulation appearance |
| Max reprices/day (eBay) | 200 | Stay well under 250 revision limit |
| High-value item threshold | $100 | Items above require manual approval |
| Recent sale cooldown | 24 hours | Don't reprice item types that just sold |
| Price below floor | BLOCKED | Never allowed, even manually |
| Price below $5 | REQUIRE_CONFIRMATION | Likely liquidation |

### Platform-Specific Limits

| Platform | API Limit | ResellerOS Safe Limit | Notes |
|----------|-----------|----------------------|-------|
| eBay | 250 revisions/listing/day | 200 revisions/day (total) | Calendar day resets at midnight PT |
| Poshmark | None (no API) | N/A | Manual or cross-list tool only |
| Mercari | None (limited API) | N/A | Use integrated cross-list tools |
| Depop | None (no API) | N/A | Cross-list tools only |

---

## 3. Stale Inventory Recovery

### Overview
Identify and take action on items that have not sold within expected timeframes.

### Stale Definitions
| Status | Days Listed | Action |
|--------|-------------|--------|
| FRESH | 0-14 | No action needed |
| AGING | 15-30 | Enable time-decay repricing |
| STALE | 31-60 | Suggest relist, aggressive repricing |
| DEAD_STOCK | 61-90 | Recommend liquidation or donation |
| ARCHIVE | 90+ | Auto-archive (optional), remove from active |

### Recovery Actions

#### Automatic Actions (User Must Opt-In)
| Action | Trigger | Default State |
|--------|---------|---------------|
| Enable time-decay repricing | AGING (15+ days) | ON |
| Send user daily stale report | STALE (31+ days) | ON |
| Auto-relist suggestion | STALE (31+ days) | NOTIFY_ONLY |
| Liquidation recommendation | DEAD_STOCK (61+ days) | NOTIFY_ONLY |
| Auto-archive | ARCHIVE (90+ days) | OFF |

#### Relist Recommendations
When an item reaches STALE status, system recommends:
1. **Refresh listing** - End and relist (resets search ranking)
2. **Update photos** - Flag if photos are poor quality
3. **Revise title/description** - AI suggests improvements
4. **Adjust price** - Suggest competitive price based on comps
5. **Bundle opportunity** - Suggest related items to bundle

### Stale Recovery Guardrails
| Guardrail | Limit | Reason |
|-----------|-------|--------|
| Max auto-relists/day | 10 | Prevent spam behavior |
| Relist cooldown | 30 days | Platform best practices |
| Archive threshold | 90 days | User preference |
| Never auto-delete | BLOCKED | User must manually delete |

---

## 4. Relist/Refresh Rules

### Overview
Refresh or relist items to improve search visibility and sales velocity.

### Triggers
| Trigger | Description | Recommended Action |
|---------|-------------|-------------------|
| `STALE_THRESHOLD` | Item reaches 30+ days | Suggest relist |
| `SEASONAL_OPPORTUNITY` | Season change approaching | Suggest refresh seasonal items |
| `PRICE_DROP_COMPLETE` | Max price drops reached | Suggest relist at new price |
| `MANUAL_REQUEST` | User requests refresh | Execute immediately |

### Relist Strategies

#### 1. Smart Relist (Default)
End listing, update metadata, relist as new.

**What gets updated:**
- Reset "days listed" counter
- Refresh search indexing
- AI-suggested title improvements (optional)
- AI-suggested description improvements (optional)
- Updated pricing (if price floor allows)

#### 2. Refresh Only
Update listing without ending (eBay revision).

**What gets updated:**
- Minor text changes
- Photo reorder
- Category update

**Note:** Counts toward eBay 250 revision limit.

### Relist Rules
| Rule | Default | User-Configurable |
|------|---------|-------------------|
| Auto-suggest relist after X days | 30 days | Yes (14-90 days) |
| Require user approval for relist | Yes | No (always required) |
| AI title optimization | Suggest only | Yes |
| AI description optimization | Suggest only | Yes |
| Preserve original photos | Yes | Yes |
| Copy to draft first | Yes | No (always) |

### Relist Guardrails
| Guardrail | Limit | Reason |
|-----------|-------|--------|
| Max relists/day | 25 | Platform limits, spam prevention |
| Min days between relists | 14 | Platform best practices |
| Relist without changes | BLOCKED | Must update something |
| Auto-relist high-value items | BLOCKED | >$100 requires manual |

---

## 5. Delist on Sale (Critical)

### Overview
Immediately delist/end listings on other platforms when an item sells. This prevents double-selling, refunds, and account damage.

### Priority: CRITICAL
Double-selling is the most damaging automation failure. This feature must be:
- Fast (< 30 seconds for eBay native)
- Reliable (99.9%+ success rate)
- Redundant (multiple retry mechanisms)

### Triggers
| Trigger | Source | Latency Target |
|---------|--------|----------------|
| `ORDER_CONFIRMATION` webhook | eBay Notification API | Real-time (< 5 seconds) |
| Order polling | eBay Fulfillment API | Every 60 seconds |
| Cross-list tool webhook | Vendoo/List Perfectly/etc. | Tool-dependent |
| Manual mark-as-sold | User action | Immediate |

### Delist Flow
```
SALE_DETECTED
    |
    v
[Identify all platform listings for this item]
    |
    v
[Queue delist tasks for each platform]
    |
    +-- eBay (native) --> Call Inventory API DELETE
    |                         |
    |                         +-- Success --> Log, notify user
    |                         +-- Failure --> RETRY (3x), then ALERT
    |
    +-- Poshmark (assisted) --> Notify user to delist
    |                              OR
    |                           Trigger cross-list tool delist
    |
    +-- Mercari (assisted) --> Trigger cross-list tool delist
    |
    +-- Depop (assisted) --> Trigger cross-list tool delist
    |
    v
[Verify delists completed]
    |
    +-- All confirmed --> Mark item SOLD in system
    +-- Any failed --> ALERT USER IMMEDIATELY
```

### Delist Retry Logic
| Attempt | Delay | Action on Failure |
|---------|-------|-------------------|
| 1 | Immediate | Retry |
| 2 | 30 seconds | Retry |
| 3 | 5 minutes | Retry |
| 4 | N/A | ALERT user, mark as DELIST_FAILED |

### Delist Guardrails
| Guardrail | Behavior | Reason |
|-----------|----------|--------|
| Delist before confirming sale | Always delist on ORDER_CONFIRMATION | Speed matters |
| Verify delist success | Poll listing status after delist | Confirm removal |
| User alert on failure | Push notification + email | Critical failure |
| Never auto-delist without sale | BLOCKED | Prevent accidental removal |

### Delist Failure Modes
| Failure | Impact | Recovery |
|---------|--------|----------|
| eBay API timeout | Item still live | Auto-retry 3x |
| Cross-list tool failure | Item still live on platform | Alert user for manual action |
| Network failure | All platforms affected | Queue for retry, alert user |
| Rate limit hit | Delayed delist | Queue, process when available |

---

## 6. Human-in-the-Loop Triggers

### Overview
Certain situations require human judgment. Autopilot stops and escalates to the user.

### Escalation Triggers

#### Always Escalate (Never Auto-Execute)
| Situation | Reason |
|-----------|--------|
| High-value items (>$200) | Financial risk too high |
| Price would drop below floor | Violates user constraint |
| Delete/archive item | Irreversible action |
| First-time rule execution | User should verify rules work |
| Account-level actions | Policies, settings changes |
| Dispute/refund request | Requires judgment |

#### Escalate on Low Confidence
| Situation | Confidence Threshold |
|-----------|---------------------|
| Unusual offer pattern | < 70% |
| Price recommendation outside historical range | < 70% |
| Item without cost basis | < 50% |
| New item category | < 60% |

#### Escalate on Anomaly Detection
| Anomaly | Detection Method |
|---------|------------------|
| Sudden spike in offers | 3+ offers in 1 hour |
| Price war detected | 3+ competitors dropped price in 24 hours |
| Unusual buyer behavior | Multiple rapid offers from same buyer |
| Platform rate limit warning | 80% of daily limit reached |

### Escalation Flow
```
AUTOPILOT_ACTION_PROPOSED
    |
    v
[Check escalation triggers]
    |
    +-- Trigger matched --> PAUSE action
    |                           |
    |                           v
    |                       [Notify user]
    |                           |
    |                           v
    |                       [Wait for approval/rejection]
    |                           |
    |                           +-- APPROVED --> Execute action
    |                           +-- REJECTED --> Cancel, log reason
    |                           +-- TIMEOUT (24h) --> Cancel, log
    |
    +-- No trigger --> Execute action
```

### User Notification Preferences
| Priority | Channels | Example |
|----------|----------|---------|
| CRITICAL | Push + Email + SMS | Delist failure |
| HIGH | Push + Email | High-value offer |
| MEDIUM | Push | Daily summary |
| LOW | In-app only | Routine actions |

---

## 7. Audit & Undo System

### Audit Log Requirements

Every autopilot action MUST log:

| Field | Description | Example |
|-------|-------------|---------|
| `action_id` | Unique identifier | `act_abc123` |
| `action_type` | Type of action | `OFFER_ACCEPT`, `REPRICE`, `DELIST` |
| `timestamp` | When action occurred | `2026-02-03T14:30:00Z` |
| `item_id` | Affected item | `item_xyz789` |
| `platform` | Target platform | `EBAY`, `POSHMARK` |
| `rule_id` | Which rule triggered | `rule_offer_auto_accept` |
| `confidence` | Confidence level | `0.92` |
| `before_state` | State before action | `{price: 50.00}` |
| `after_state` | State after action | `{price: 45.00}` |
| `reversible` | Can be undone | `true` |
| `reversed` | Was it undone | `false` |
| `user_id` | Account owner | `user_123` |
| `source` | What initiated | `AUTOPILOT`, `USER`, `SYSTEM` |

### Audit Log Retention
| Log Type | Retention | Reason |
|----------|-----------|--------|
| Action logs | 1 year | User reference, debugging |
| Error logs | 2 years | Compliance, debugging |
| Financial actions | 7 years | Tax/legal requirements |

### Undo Mechanisms

#### Reversible Actions
| Action | Undo Method | Time Limit |
|--------|-------------|------------|
| Price change | Restore previous price | 24 hours |
| Offer accept | N/A (cannot undo sale) | N/A |
| Offer decline | N/A (buyer must resubmit) | N/A |
| Offer counter | N/A (counter sent) | N/A |
| Delist | Relist item | 30 days |
| Relist | End new listing | 24 hours |
| Archive | Unarchive | Unlimited |

#### Non-Reversible Actions
| Action | Reason |
|--------|--------|
| Offer accept | Binding sale |
| Offer decline | Buyer notified |
| Offer counter | Counter sent |
| Delete item | Data removed |

### Undo Flow
```
USER_REQUESTS_UNDO(action_id)
    |
    v
[Lookup action in audit log]
    |
    +-- Not found --> ERROR: Action not found
    |
    v
[Check if reversible]
    |
    +-- Not reversible --> ERROR: Cannot undo this action type
    |
    v
[Check time limit]
    |
    +-- Expired --> ERROR: Undo window expired
    |
    v
[Check current state]
    |
    +-- State changed --> WARN: State has changed, confirm override
    |
    v
[Execute undo]
    |
    +-- Success --> Log undo, notify user
    +-- Failure --> Retry or escalate
```

### Bulk Undo
For situations where multiple actions need reversal:

| Scenario | Capability |
|----------|------------|
| Undo all actions in last X hours | Supported |
| Undo all actions by rule ID | Supported |
| Undo all price changes today | Supported |
| Selective undo from list | Supported |

---

## 8. Rate Limits and Quotas

### Platform API Rate Limits

| Platform | API | Daily Limit | ResellerOS Buffer | Safe Limit |
|----------|-----|-------------|-------------------|------------|
| eBay | Inventory API | 2,000,000 | 10% | 1,800,000 |
| eBay | Fulfillment API | 100,000 | 10% | 90,000 |
| eBay | Notification API | 10,000 | 10% | 9,000 |
| eBay | Listing revisions | 250/listing/day | 20% | 200/day total |

### ResellerOS Action Limits

| Action | Default Limit | User Tier Multiplier | Reason |
|--------|--------------|---------------------|--------|
| Reprices/day | 100 | 1x-4x by tier | Platform limits |
| Auto-accepts/day | 50 | 1x-2x by tier | Prevent runaway |
| Auto-declines/day | 100 | 1x-2x by tier | Rate limiting |
| Auto-counters/day | 100 | 1x-2x by tier | Rate limiting |
| Relists/day | 25 | 1x-2x by tier | Platform limits |
| Delists/day | Unlimited | - | Critical function |

### Rate Limit Behavior
```
ACTION_REQUESTED
    |
    v
[Check daily limit]
    |
    +-- Under limit --> Execute action
    |
    +-- At 80% limit --> Execute + WARN user
    |
    +-- At limit --> QUEUE for tomorrow
    |
    +-- Critical action (delist) --> Execute regardless
```

---

## 9. Rule Configuration

### Default Rules (Out-of-Box)

All users start with conservative defaults:

```yaml
offer_rules:
  auto_accept_threshold: 0.90  # 90% of asking
  auto_decline_threshold: 0.50  # 50% of asking
  auto_counter_enabled: true
  counter_strategy: midpoint
  max_counter_rounds: 2
  require_floor: true

reprice_rules:
  strategy: time_decay
  enabled: false  # User must opt-in
  max_daily_drop: 0.10  # 10%
  max_weekly_drop: 0.20  # 20%
  high_value_threshold: 100

stale_rules:
  aging_days: 15
  stale_days: 30
  dead_stock_days: 60
  archive_days: 90
  auto_archive: false

delist_rules:
  on_sale: true  # Always on
  retry_attempts: 3
  alert_on_failure: true

human_in_loop:
  high_value_threshold: 200
  require_approval_first_time: true
  escalate_low_confidence: true
```

### Rule Validation

Before saving user rules, validate:

| Validation | Rule |
|------------|------|
| Accept threshold > decline threshold | Prevent impossible ranges |
| Floor price >= 0 | No negative floors |
| Max daily drop <= 30% | Prevent catastrophic drops |
| Counter rounds 1-5 | Reasonable limits |
| Thresholds are percentages | 0.0 - 1.0 range |

---

## 10. Failure Modes and Recovery

### Failure Categories

| Category | Severity | Example |
|----------|----------|---------|
| CRITICAL | Immediate alert | Delist failed, double-sell risk |
| HIGH | Alert within 1 hour | Rate limit exceeded |
| MEDIUM | Daily digest | Rule execution failed |
| LOW | Weekly summary | Suboptimal outcome |

### Recovery Procedures

#### Critical: Delist Failure
```
1. Retry 3x with exponential backoff
2. If still failing, send PUSH + EMAIL + SMS
3. Mark item as DELIST_FAILED in system
4. Add to user's urgent action queue
5. If using cross-list tool, trigger their delist API
6. If all else fails, provide manual delist instructions
```

#### High: Rate Limit Exceeded
```
1. Stop all non-critical actions for platform
2. Queue pending actions for next day
3. Notify user of delayed actions
4. Allow user to prioritize queue
5. Resume at midnight (platform time)
```

#### Medium: Rule Execution Failed
```
1. Log failure with full context
2. Skip to next action in queue
3. Include in daily digest
4. Suggest rule adjustment if pattern detected
```

#### Low: Suboptimal Outcome
```
1. Log outcome
2. Use for ML model improvement
3. Include in weekly insights
```

### System Health Monitoring

| Metric | Alert Threshold |
|--------|-----------------|
| Action success rate | < 95% |
| Delist success rate | < 99% |
| API error rate | > 1% |
| Queue depth | > 1000 actions |
| Undo requests/day | > 10 (per user) |

---

## 11. Autopilot Dashboard

### User-Facing Metrics

| Metric | Description |
|--------|-------------|
| Actions today | Total autopilot actions executed |
| Actions pending | Queued for approval or rate limited |
| Success rate | % of actions completed successfully |
| Offers handled | Auto-accept, decline, counter breakdown |
| Price adjustments | Repricing actions taken |
| Items saved from double-sell | Successful delists |

### Action History View

Users can view:
- All actions (filterable by type, date, platform)
- Pending actions (awaiting approval)
- Failed actions (with retry option)
- Undone actions (with re-execute option)

### Rule Performance Analytics

| Insight | Calculation |
|---------|-------------|
| Offer acceptance rate | Accepted offers / total offers |
| Avg sale vs. asking | Sold price / original asking |
| Time-to-sale by strategy | Days listed by repricing strategy |
| Revenue impact | $$ from autopilot actions |

---

## Status
- **Current**: Complete (Phase 2 - SUBTASK-205)
- **Updated**: 2026-02-03
- **Owner**: autopilot-engineer
- **Next Review**: Phase 3 (Architecture) - Implementation design
