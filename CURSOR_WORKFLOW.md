# Cursor IDE Workflow Guide - BSS Magic Runtime

## Quick Start

**Before ANY coding session in Cursor:**

```bash
# 1. Open terminal in Cursor (Cmd/Ctrl + `)
# 2. Check your branch
git branch --show-current

# 3. If on main, create feature branch
git checkout main
git pull origin main
git checkout -b feature/your-work-name
```

✅ **Now you're safe to code!**

## Cursor Features & BSS Magic Best Practices

### 1. Cursor Chat (Cmd/Ctrl + L)

**Use for:**
- Asking questions about the codebase
- Understanding existing implementations
- Getting suggestions for approaches
- Debugging issues

**Best Practices:**

#### ✅ GOOD - Specific, contextual questions
```
"How does the OE enrichment chain work in oe_executor.py?"

"Show me examples of how we handle ServiceProblem lifecycle in this codebase"

"What's the pattern for adding a new TMF view? Show me an existing view as reference"
```

#### ❌ BAD - Vague, no context
```
"How do I add validation?"

"Fix the bug"

"Make it better"
```

### 2. Cursor Composer (Cmd/Ctrl + I)

**Use for:**
- Multi-file changes
- Refactoring across files
- Adding new features
- Large-scale updates

**Workflow:**

#### Step 1: Verify Branch
```bash
# In Cursor terminal
git branch --show-current
# Must be on feature/*, not main
```

#### Step 2: Give Clear Instructions

**Template:**
```
I need to [high-level goal].

Files to modify:
- [file1]
- [file2]

Requirements:
- [requirement 1]
- [requirement 2]

Please:
1. Read existing implementations first
2. Follow the patterns in [similar feature]
3. Add tests
4. Update documentation
```

**Example:**
```
I need to add retry logic with exponential backoff to OE remediation.

Files to modify:
- batch-orchestrator/app/services/oe_executor.py
- batch-orchestrator/app/config.py (add retry config)

Requirements:
- Max 3 retries
- Backoff: 1s, 2s, 4s
- Only retry on network errors (500, 502, 503, 504)
- Don't retry on 404 or 400 (client errors)
- Log each retry attempt

Please:
1. Check how retry is implemented in async_tmf_client.py
2. Follow the same pattern
3. Add unit tests for retry behavior
```

#### Step 3: Review Before Accepting

Cursor Composer will show a diff. **ALWAYS review:**

- [ ] Changes make sense
- [ ] Follows existing patterns
- [ ] No unintended changes
- [ ] No debugging code left behind
- [ ] No secrets or hardcoded values

#### Step 4: Accept and Test
- Click "Accept" or press Cmd/Ctrl + Enter
- Run tests: `npm test` or `pytest`
- Manually test if needed

#### Step 5: Commit
```bash
git add path/to/changed/files
git commit -m "feat(scope): add retry logic to OE executor"
```

### 3. Cursor Tab (Autocomplete)

**Smart usage:**

- Use for repetitive patterns
- Accept with Tab when it's correct
- Ignore (keep typing) when it's wrong
- Works best when you have similar code in the file

**Example - Cursor will autocomplete:**
```typescript
// After you write the first one:
const { mutate: fixSolution } = useFixSolution();

// Cursor suggests:
const { mutate: remediateOE } = useRemediateOE(); // ✅ Accept with Tab
```

### 4. Codebase Indexing

**Cursor indexes your entire codebase for context.**

**To leverage this:**

1. **Reference existing code in questions:**
   ```
   "I see we use TanStack Query in ServiceProblemsModule.tsx.
    Should I follow the same pattern for the new OE Checker module?"
   ```

2. **Ask about patterns:**
   ```
   "How do we typically handle loading states in our dashboard modules?"
   ```

3. **Find similar implementations:**
   ```
   "Show me all TMF API client functions that use retry logic"
   ```

## Common Workflows

### Workflow 1: Adding a New Dashboard Module

```bash
# 1. Branch check
git checkout -b feature/add-oe-rules-editor

# 2. In Cursor Composer (Cmd+I):
```

**Prompt:**
```
I need to create a new dashboard module for editing OE patching rules.

Create new file:
- docs/bss-magic-app-template/src/components/Modules/OERulesEditor.tsx

Requirements:
- Follow the pattern in OEPatcherModule.tsx
- Use TanStack Query for data fetching
- Include loading and error states
- Use shadcn/ui components (Button, Card, Input, etc.)
- Add TypeScript types in the component file

Features:
- Display list of current rules
- Allow editing rule values
- Save button with confirmation
- Toast notifications on success/error

Please read OEPatcherModule.tsx first to understand our patterns.
```

```bash
# 3. After Cursor implements, review and test
npm run dev

# 4. If looks good, commit
git add docs/bss-magic-app-template/src/components/Modules/OERulesEditor.tsx
git commit -m "feat(dashboard): add OE rules editor module

- Display and edit OE patching rules
- Form validation with error messages
- Toast notifications for user feedback
- Follows OEPatcherModule patterns

Related: MCBDIR-XX"

# 5. Push and create PR
git push -u origin feature/add-oe-rules-editor
gh pr create
```

### Workflow 2: Fixing a Bug

```bash
# 1. Branch check
git checkout -b fix/service-problem-timeline-display

# 2. In Cursor Chat (Cmd+L):
```

**Prompt:**
```
I'm investigating a bug where the ServiceProblem timeline doesn't display
correctly in ServiceProblemsModule.tsx.

Can you:
1. Show me how the timeline data is fetched
2. Check how it's parsed from the ServiceProblem characteristics
3. Look for any issues in the RemediationTimeline component

I think the issue might be in the parseRemediationTimeline function.
```

*Cursor will analyze and suggest fixes*

```bash
# 3. After fix is identified, use Composer to implement
# (Cmd+I in the affected files)

# 4. Test the fix
npm run dev
# Verify timeline displays correctly

# 5. Commit
git add docs/bss-magic-app-template/src/components/Modules/ServiceProblemsModule.tsx
git commit -m "fix(dashboard): correct ServiceProblem timeline parsing

The parseRemediationTimeline function wasn't handling the case where
timeline data is stored as a JSON string. Added JSON.parse with
error handling.

Fixes: MCBDIR-XX"

# 6. Push and create PR
git push -u origin fix/service-problem-timeline-display
gh pr create
```

### Workflow 3: Adding a New SQL View

```bash
# 1. Branch check
git checkout -b feature/add-product-detail-view

# 2. In Cursor Chat (Cmd+L):
```

**Prompt:**
```
I need to create a new TMF view for product details with enhanced filtering.

Please show me:
1. How product.sql is currently structured
2. What fields are available in the CloudSense Product object
3. The pattern for creating filterable custom fields (x_* convention)

I want to add filtering by product family and product type.
```

*Cursor will show examples*

```bash
# 3. Create new view file using Composer (Cmd+I)
```

**Prompt:**
```
Create a new SQL view file: runtime/views/product_detail.sql

Requirements:
- Based on product.sql but optimized for filtering
- Add x_productFamily field (direct reference to ProductFamily__c)
- Add x_productType field (direct reference to ProductType__c)
- Use direct column references (no COALESCE) for filterable fields
- Include standard TMF fields (id, href, name, productSerialNumber)
- Use ROW constructors for complex types
- Add comments explaining the x_* fields

Follow the exact pattern from product.sql and service.sql.
```

```bash
# 4. Review the generated SQL carefully
# ⚠️ CRITICAL: SQL views affect production TMF APIs

# 5. Test in sandbox first (don't commit yet)
./runtime/views/apply_all_views.sh

# 6. After testing, commit
git add runtime/views/product_detail.sql
git commit -m "feat(runtime): add product detail view with enhanced filtering

- Add x_productFamily and x_productType for efficient filtering
- Use direct column references (FDW pushes to SOQL)
- Follow TMF638 product specification
- Tested in sandbox environment

Related: MCBDIR-XX"
```

### Workflow 4: Refactoring Across Multiple Files

```bash
# 1. Branch check
git checkout -b refactor/consolidate-tmf-clients

# 2. Use Composer for multi-file refactoring (Cmd+I)
```

**Prompt:**
```
I need to consolidate TMF client functions across multiple files.

Context:
- We have duplicate TMF API calls in multiple service files
- Want to centralize in src/services/tmf/client.ts
- Need to update all imports

Files to modify:
- docs/bss-magic-app-template/src/services/tmf/client.ts (consolidate here)
- docs/bss-magic-app-template/src/services/salesforce/client.ts (remove duplicates)
- docs/bss-magic-app-template/src/services/gateways/hooks.ts (update imports)

Please:
1. Read all three files first
2. Identify duplicate TMF API calls
3. Move duplicates to tmf/client.ts
4. Update all imports
5. Ensure no functionality breaks
6. Keep the same function signatures
```

*Review the changes carefully*

```bash
# 3. Run tests to verify nothing broke
npm test

# 4. Manual testing
npm run dev

# 5. Commit
git add docs/bss-magic-app-template/src/services/tmf/client.ts \
        docs/bss-magic-app-template/src/services/salesforce/client.ts \
        docs/bss-magic-app-template/src/services/gateways/hooks.ts

git commit -m "refactor(dashboard): consolidate TMF client functions

- Moved duplicate TMF API calls to tmf/client.ts
- Updated imports across 3 files
- No functional changes
- All tests passing

Related: MCBDIR-XX"
```

## Cursor + Git Integration

### Built-in Git Features in Cursor

**1. Source Control Panel (Cmd/Ctrl + Shift + G):**
- See changed files
- Stage/unstage files
- Write commit messages
- View diffs

**2. Inline Diff View:**
- See changes highlighted in editor
- Accept/reject changes
- Navigate between changes

**3. Branch Indicator:**
- Bottom-left corner shows current branch
- Click to switch branches
- Create new branches

### Best Practice Workflow

```
┌─────────────────────────────────────────────┐
│ 1. Switch Branch (Bottom-left click)       │
│    → Create new feature/xxx branch          │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│ 2. Use Cursor Chat/Composer                 │
│    → Make code changes                      │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│ 3. Source Control Panel                     │
│    → Review changes (click files for diff) │
│    → Stage specific files                   │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│ 4. Commit Message                           │
│    → Write clear message                    │
│    → Click ✓ or Cmd+Enter to commit        │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│ 5. Terminal (Cmd + `)                       │
│    → git push -u origin feature/xxx         │
│    → gh pr create                           │
└─────────────────────────────────────────────┘
```

## Cursor Settings for BSS Magic

**Recommended Cursor Settings:**

### Editor Settings (settings.json)

```json
{
  // Git
  "git.autofetch": true,
  "git.confirmSync": false,
  "git.enableSmartCommit": false,

  // Python
  "python.linting.enabled": true,
  "python.linting.pylintEnabled": true,
  "python.formatting.provider": "black",
  "python.formatting.blackArgs": ["--line-length", "100"],

  // TypeScript/React
  "typescript.updateImportsOnFileMove.enabled": "always",
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.codeActionsOnSave": {
    "source.organizeImports": true
  },

  // Cursor AI
  "cursor.aiReview": true,
  "cursor.chat.commandSuggest": true,

  // Files
  "files.exclude": {
    "**/__pycache__": true,
    "**/.venv": true,
    "**/node_modules": true,
    "**/.next": true,
    "**/dist": true
  }
}
```

### .vscode/extensions.json (Recommended Extensions)

```json
{
  "recommendations": [
    "ms-python.python",
    "ms-python.vscode-pylance",
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "prisma.prisma",
    "mtxr.sqltools",
    "eamodio.gitlens"
  ]
}
```

## Common Pitfalls & Solutions

### Pitfall 1: Cursor Suggests Changes to Multiple Files When You Only Want One

**Solution:**
```
In Composer, be explicit:
"Only modify batch-orchestrator/app/services/oe_executor.py.
Do not change any other files."
```

### Pitfall 2: Cursor Doesn't Have Context About Recent Changes

**Solution:**
```
Provide context in your prompt:
"I just added retry logic to async_tmf_client.py (in this conversation).
Now apply the same pattern to oe_executor.py."
```

### Pitfall 3: Accepts Cursor's Suggestion Without Understanding It

**Solution:**
```
In Chat: "Explain the changes you just suggested line by line"
```

### Pitfall 4: Lost Track of What Branch You're On

**Solution:**
```bash
# Always check before coding
git branch --show-current

# If on main, immediately switch
git checkout -b feature/my-work
```

### Pitfall 5: Cursor Suggests Committing to Main

**Solution:**
```
Ignore the suggestion.
Always commit on feature branches.
Check branch indicator (bottom-left).
```

## Pro Tips

### Tip 1: Use Cursor's Codebase Context

```
# Instead of:
"Add a retry function"

# Say:
"Add retry logic similar to what we use in async_tmf_client.py"
```

### Tip 2: Reference Issue Numbers

```
# In commits via Cursor:
git commit -m "feat(1867): add validation

Related: MCBDIR-37"
```

### Tip 3: Use Cursor for Documentation

```
In Chat: "Generate a docstring for this function that follows
our project's documentation style (see oe_executor.py for examples)"
```

### Tip 4: Quick Branch Switch with Cursor

```
1. Click branch name (bottom-left)
2. Type to search branches
3. Enter to switch
4. Faster than terminal commands
```

### Tip 5: Use Cursor for Code Reviews

```
Before committing, ask:
"Review the changes I made to this file. Check for:
- Type safety issues
- Security concerns
- Performance problems
- Style inconsistencies"
```

## Emergency Recovery

### Accidentally Accepted Wrong Changes

```bash
# Undo before committing
Cmd/Ctrl + Z (repeatedly)

# Or discard changes
git checkout -- path/to/file
```

### Committed to Wrong Branch

```bash
# If committed but not pushed
git reset HEAD~1  # Undo commit, keep changes
git stash         # Save changes
git checkout correct-branch
git stash pop     # Apply changes
git add ...
git commit -m "..."
```

### Cursor Hung or Not Responding

```
1. Save all files (Cmd/Ctrl + K, then S)
2. Reload window: Cmd/Ctrl + R
3. If still stuck: Quit Cursor, restart
4. Your code is safe (auto-saves)
```

## Daily Checklist

### Start of Day:
- [ ] Open Cursor
- [ ] Terminal: `git checkout main && git pull`
- [ ] Check for any updates: `git log --oneline -5`
- [ ] Create feature branch: `git checkout -b feature/todays-work`
- [ ] ✅ Now code with Cursor!

### During Development:
- [ ] Commit frequently (every logical change)
- [ ] Write clear commit messages
- [ ] Push regularly: `git push origin feature/todays-work`

### End of Day:
- [ ] Review uncommitted changes in Source Control panel
- [ ] Commit any work in progress
- [ ] Push to remote: `git push origin feature/todays-work`
- [ ] Create PR if feature is complete: `gh pr create`

## Summary

**The Golden Rule:**
> Always work on feature branches, commit frequently, and use Cursor's AI to enhance (not replace) your understanding of the code.

**Key Shortcuts:**
- **Cmd/Ctrl + L** - Chat
- **Cmd/Ctrl + I** - Composer (multi-file)
- **Cmd/Ctrl + `** - Terminal
- **Cmd/Ctrl + Shift + G** - Source Control
- **Tab** - Accept autocomplete

**Remember:**
1. Branch before coding
2. Read before modifying
3. Review before accepting
4. Test before committing
5. Commit with clear messages

Happy coding! 🚀
