# Quick Reference - BSS Magic Development

## 🚦 Before You Start Coding

```bash
git branch --show-current  # Check your branch
# ✅ If on feature/* → Safe to code
# ❌ If on main → Create feature branch!
```

**If on main:**
```bash
git checkout main
git pull origin main
git checkout -b feature/your-work-name
```

## 📝 Cursor Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + L` | Open Chat |
| `Cmd/Ctrl + I` | Open Composer (multi-file) |
| `Cmd/Ctrl + `` | Toggle Terminal |
| `Cmd/Ctrl + Shift + G` | Source Control |
| `Tab` | Accept autocomplete |

## 🎯 Common Tasks

### Start New Feature
```bash
git checkout main && git pull
git checkout -b feature/my-feature
# Now code in Cursor!
```

### Commit Changes
```bash
git status                    # See what changed
git add path/to/file          # Stage specific files
git commit -m "type: msg"     # Commit with message
```

### Push & Create PR
```bash
git push -u origin feature/my-feature
gh pr create
```

### After PR Merged
```bash
git checkout main && git pull
```

## 📋 Commit Message Format

```
type(scope): short description

Details if needed

Related: MCBDIR-XX
```

**Types:** `feat`, `fix`, `docs`, `refactor`, `test`, `chore`

**Examples:**
```bash
git commit -m "feat(1867): add email validation"
git commit -m "fix(batch): correct retry logic"
git commit -m "docs: update API documentation"
```

## 🛡️ Safety Checks

### Before Committing
- [ ] Check branch: `git branch --show-current`
- [ ] Review changes: `git diff`
- [ ] No secrets: `git diff | grep -i password`
- [ ] Run tests if applicable

### Never Commit
- ❌ Credentials (*.pem, *.key, .env)
- ❌ Large files (*.jar, *.pdf, *.mp4)
- ❌ Dependencies (node_modules, venv)
- ❌ Build outputs (.next, dist)

## 🎨 Code Style

### Python
```python
# ✅ GOOD
async def process_service(service_id: str) -> Result:
    """Process service with proper error handling."""
    try:
        return await api.process(service_id)
    except TimeoutError:
        raise ServiceTimeoutError(f"Timeout: {service_id}")
```

### TypeScript
```typescript
// ✅ GOOD
interface Props {
  serviceId: string;
  onSuccess?: (result: Result) => void;
}

export function Component({ serviceId, onSuccess }: Props) {
  const { mutate, isPending } = useApi();
  // ...
}
```

### SQL (TMF Views)
```sql
-- ✅ GOOD - Direct reference (pushes to SOQL)
SELECT
    t0."Id"::text AS "id",
    t0."Status__c"::text AS "status"
FROM salesforce_server."Service__c" t0
WHERE t0."Status__c" = 'Active';  -- Efficient!

-- ❌ BAD - COALESCE (client-side filter, slow!)
SELECT COALESCE(t0."Status__c", 'Unknown')::text AS "status"
```

## 🆘 Quick Fixes

### Wrong Branch
```bash
git checkout main            # Switch to main
git pull                     # Update
git checkout -b feature/fix  # New branch
```

### Undo Last Commit (Not Pushed)
```bash
git reset HEAD~1  # Keep changes
# OR
git reset --hard HEAD~1  # Discard changes
```

### Discard Local Changes
```bash
git checkout -- path/to/file
```

### See Recent Commits
```bash
git log --oneline -10
```

## 📚 Documentation Files

- **`.cursorrules`** - AI behavior rules
- **`CURSOR_WORKFLOW.md`** - Detailed Cursor guide
- **`GIT_WORKFLOW.md`** - Git best practices
- **`CLAUDE.md`** - Project instructions
- **`QUICK_REFERENCE.md`** - This file!

## 🔗 Important Links

- **Repository**: https://github.com/trilogy-group/maxis-data-remediation-bssmagic
- **Pull Requests**: https://github.com/trilogy-group/maxis-data-remediation-bssmagic/pulls
- **Jira**: [Your Jira Board]

## 💡 Pro Tips

1. **Always check your branch** before coding
2. **Commit early, commit often**
3. **Write clear commit messages**
4. **Push regularly** (don't lose work!)
5. **Ask Cursor for help** when unsure
6. **Review before accepting** Cursor's suggestions
7. **Test before committing**

## 🎯 Module-Specific

### Module 1867 (OE Patching)
- Files: `batch-orchestrator/app/services/oe_*.py`
- UI: `docs/bss-magic-app-template/src/components/Modules/OE*.tsx`
- SQL: `runtime/views/service1867*.sql`

### Module 1147 (Solution Empty)
- Files: `batch-orchestrator/app/services/remediation_engine.py`
- UI: `docs/bss-magic-app-template/src/components/Modules/SolutionEmptyModule.tsx`

### Dashboard
- Main: `docs/bss-magic-app-template/src/*`
- Use TanStack Query for API calls
- Use shadcn/ui components

### Runtime Views
- Location: `runtime/views/*.sql`
- ⚠️ Always test in sandbox first
- Use direct column references for filtering

## ✅ Daily Checklist

**Start:**
- [ ] `git checkout main && git pull`
- [ ] `git checkout -b feature/todays-work`

**During:**
- [ ] Commit frequently
- [ ] Push regularly

**End:**
- [ ] Commit any WIP
- [ ] Push to remote
- [ ] Create PR if ready

---

**Need more details?** Check the full guides:
- **Cursor**: `CURSOR_WORKFLOW.md`
- **Git**: `GIT_WORKFLOW.md`
- **Project**: `CLAUDE.md`
