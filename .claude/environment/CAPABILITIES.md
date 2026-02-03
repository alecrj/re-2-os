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

## External APIs (To Validate in Discovery)
| API | Status | Notes |
|-----|--------|-------|
| eBay Inventory | ❓ Unknown | Research in Phase 1 |
| eBay Fulfillment | ❓ Unknown | Research in Phase 1 |
| eBay Finances | ❓ Unknown | Research in Phase 1 |
| Poshmark | ❓ Unknown | Likely no API |
| Mercari | ❓ Unknown | Likely no API |
| Depop | ❓ Unknown | Partner API? |

## Known Constraints
- Context window: ~200k tokens
- Session persistence: Via repo only
- Parallelism: Subagents or worktrees
- Platform rate limits: TBD in Discovery
