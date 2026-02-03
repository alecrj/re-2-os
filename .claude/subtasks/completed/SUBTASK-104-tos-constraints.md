# SUBTASK-104: ToS Constraints

## Metadata
- **ID**: 104
- **Phase**: PHASE-1-DISCOVERY
- **Owner**: integrations-lead
- **Status**: ✅ Complete
- **Created**: 2026-02-03
- **Completed**: 2026-02-03
- **Blocked By**: None
- **Blocks**: None

## Objective
Research Terms of Service constraints for each marketplace to understand what automation is allowed/prohibited.

## Deliverables
- docs/03_CHANNELS.md (ToS section updated) - COMPLETE

## Acceptance Criteria
- [x] eBay automation ToS documented
- [x] Poshmark automation ToS documented
- [x] Mercari automation ToS documented
- [x] Per-platform limits and restrictions listed
- [x] Risk assessment for automation strategies

## Summary of Findings

### Integration Risk Matrix
| Platform | Official API | Automation Risk | Safe Path |
|----------|-------------|-----------------|-----------|
| eBay | Yes (comprehensive) | LOW | Native API + Compatible App certification |
| Poshmark | No | MEDIUM | Cross-listing tools, human-speed actions |
| Mercari | Limited (import only) | MEDIUM-LOW | Official cross-list import, API-integrated tools |
| Depop | No | MEDIUM | Cross-listing platforms only |

### Key Findings
1. **eBay**: Safest platform - comprehensive API, explicit ToS support for developer tools, Compatible App certification available
2. **Poshmark**: ToS prohibits automation but enforcement is rare; "share jail" is main risk; cross-listing tools widely used
3. **Mercari**: Official cross-listing import feature exists; API-integrated tools (Vendoo, Closo) are safe
4. **Depop**: Explicitly allows cross-listing platforms in ToS; bots for engagement (follow/like) are prohibited

### Recommended Architecture
- **eBay**: Native API integration (primary channel)
- **Poshmark/Mercari/Depop**: Assisted mode via established cross-listing platforms (Vendoo, List Perfectly, Nifty, Closo)

### Sources Consulted
- eBay User Agreement (Feb 2026 update)
- eBay API License Agreement (Sep 2025 update)
- eBay robots.txt and developer documentation
- Poshmark Terms of Service (Section 4.b)
- Poshmark Community Guidelines
- Mercari Prohibited Conduct Policy
- Mercari Cross-listing Tool Import documentation
- Depop Terms of Service
- Industry analysis from multiple sources

## Progress Log
| Date | Update |
|------|--------|
| 2026-02-03 | Created |
| 2026-02-03 | Researched eBay ToS - User Agreement and API License Agreement |
| 2026-02-03 | Researched Poshmark ToS and enforcement reality |
| 2026-02-03 | Researched Mercari ToS and official cross-listing support |
| 2026-02-03 | Researched Depop ToS and cross-listing allowance |
| 2026-02-03 | Updated docs/03_CHANNELS.md with comprehensive ToS section |
| 2026-02-03 | COMPLETED - All acceptance criteria met |
