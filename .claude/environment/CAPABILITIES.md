# Environment Capabilities

## Claude Code Tools
| Tool | Available | Notes |
|------|-----------|-------|
| Read | ✅ | Read any file |
| Write | ✅ | Create/overwrite files |
| Edit | ✅ | Edit existing files |
| Bash | ✅ | Run shell commands |
| Glob | ✅ | Find files by pattern |
| Grep | ✅ | Search file contents |
| WebFetch | ✅ | Fetch web content |
| WebSearch | ✅ | Search the web |
| Task (subagents) | ✅ | Delegate to agents |

## Validation Capabilities
| Check | Method | Status |
|-------|--------|--------|
| Docs complete | Read + verify sections | ✅ Ready |
| No contradictions | Cross-reference | ✅ Ready |
| Subtask criteria | Check acceptance list | ✅ Ready |
| Code compiles | npm run build | ⏳ After setup |
| Tests pass | npm run test | ⏳ After setup |
| Types check | npm run typecheck | ⏳ After setup |

## External APIs (Validated in Phase 1)
| API | Status | Notes |
|-----|--------|-------|
| eBay Inventory | ✅ Available | 2M calls/day, full listing management |
| eBay Fulfillment | ✅ Available | 100K-2.5M calls/day, order management |
| eBay Finances | ✅ Available | Fee tracking, profit calculation |
| eBay Notification | ✅ Available | 17 webhook topics for real-time sync |
| Poshmark | ⚠️ No API | ToS prohibits automation; use cross-list tools |
| Mercari | ⚠️ Limited | Official cross-list import only |
| Depop | ⚠️ No API | ToS allows cross-listing platforms |

## Known Constraints
- Context window: ~200k tokens
- Session persistence: Via repo only
- Parallelism: Subagents or worktrees
- **eBay**: 250 revisions/listing/day limit
- **eBay**: API-created listings locked to API management
- **Poshmark/Mercari**: Must use assisted mode, not direct automation
