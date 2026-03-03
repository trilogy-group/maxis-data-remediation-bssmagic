# Git Workflow Guide - BSS Magic Runtime

## Repository Information

- **Remote**: https://github.com/trilogy-group/maxis-data-remediation-bssmagic
- **Main Branch**: `main`
- **Current Branch**: `feature/module-1867-oe-enhancements`

## Daily Workflow

### Starting New Work

```bash
# 1. Always start from updated main
git checkout main
git pull origin main

# 2. Create feature branch
git checkout -b feature/descriptive-name

# Example branch names:
# feature/module-1867-validation-fixes
# feature/batch-orchestrator-retry-logic
# feature/dashboard-search-filters
# fix/service-problem-timeline
# hotfix/cspofa-queue-cleanup
# docs/deployment-guide-update
```

### Making Changes

```bash
# 3. Make your changes
# Edit files...

# 4. Check what changed
git status
git diff

# 5. Stage files (be selective)
git add path/to/file1.py
git add path/to/file2.tsx

# 6. Commit with descriptive message
git commit -m "feat(module): description

- Bullet point 1
- Bullet point 2

Related: MCBDIR-XXX"

# 7. Push to remote
git push -u origin feature/descriptive-name
```

### Commit Message Format

Follow conventional commits:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Formatting (no code change)
- `refactor`: Code restructuring
- `perf`: Performance improvement
- `test`: Adding tests
- `chore`: Maintenance (deps, build, etc.)

**Examples:**

```bash
git commit -m "feat(1867): add validation for PICEmail format

- Validate RFC 5322 compliant email addresses
- Show clear error messages for invalid formats
- Add unit tests for edge cases

Related: MCBDIR-37"

git commit -m "fix(batch-orchestrator): prevent 404 in POST_UPDATE step

Fixed httpx.HTTPStatusError detection by checking status_code
instead of exception message string matching.

Fixes: MCBDIR-175"

git commit -m "chore(deps): update Next.js to 16.1.6

Resolves security vulnerabilities:
- CVE-XXXX (DoS via Image Optimizer)
- CVE-YYYY (Server Components DoS)"
```

### Creating Pull Requests

```bash
# After pushing your branch
gh pr create --title "feat(scope): Short description" \
  --body "## Summary
Your detailed description here

## Changes
- Change 1
- Change 2

## Testing
- Test 1
- Test 2

Related: JIRA-XXX"
```

Or visit the GitHub URL shown after push.

## Branch Management

### Merging & Cleanup

```bash
# After PR is approved and merged

# 1. Switch to main
git checkout main

# 2. Pull latest (includes your merged changes)
git pull origin main

# 3. Delete local feature branch
git branch -d feature/descriptive-name

# 4. Delete remote branch (if not auto-deleted by GitHub)
git push origin --delete feature/descriptive-name
```

### Handling Conflicts

```bash
# If main has advanced while you were working

# 1. Update your feature branch
git checkout feature/your-branch
git fetch origin
git rebase origin/main

# 2. Resolve conflicts if any
# Edit conflicted files...
git add resolved-file.py
git rebase --continue

# 3. Force push (rebase rewrites history)
git push --force-with-lease origin feature/your-branch
```

## Best Practices

### ✅ DO:
- Commit early, commit often
- Write descriptive commit messages
- Keep commits focused (one logical change per commit)
- Test before committing
- Pull from main before starting new work
- Use feature branches for all work
- Keep branches short-lived (1-2 days max)
- Tag releases: `git tag -a v1.4.0 -m "Release notes"`

### ❌ DON'T:
- Commit directly to main
- Commit credentials or secrets (check .gitignore)
- Commit large binary files (use Git LFS if needed)
- Commit node_modules, .venv, __pycache__
- Commit build artifacts (.next, dist, out)
- Use `git add .` blindly (review what you're staging)
- Force push to main or shared branches
- Amend published commits
- Leave branches unmerged for weeks

## File Management

### What to Commit
- Source code (.py, .ts, .tsx, .sql)
- Configuration files (.json, .yaml, .md)
- Documentation
- Tests
- Build scripts
- Infrastructure as code

### What NOT to Commit
- Credentials (*.pem, *.key, .env)
- Large binaries (*.jar, *.pdf, *.mp4)
- Dependencies (node_modules, venv)
- Build outputs (.next, dist, out)
- OS files (.DS_Store)
- IDE files (.vscode, .idea)
- Log files (*.log)

**Check before committing:**
```bash
# See what's ignored
git status --ignored

# Check .gitignore is working
git check-ignore -v suspicious-file.zip
```

## Emergency Procedures

### Undo Last Commit (Not Pushed)
```bash
# Keep changes, undo commit
git reset HEAD~1

# Discard changes completely
git reset --hard HEAD~1
```

### Undo Pushed Commit
```bash
# Create new commit that reverses changes
git revert <commit-hash>
git push origin feature/branch-name
```

### Accidentally Committed Secret
```bash
# If NOT pushed yet
git reset HEAD~1
rm the-secret-file
git add .gitignore  # Add file pattern to .gitignore
git commit -m "chore: add secret to gitignore"

# If ALREADY pushed - IMMEDIATELY:
# 1. Rotate the compromised credential
# 2. Force push removal (only on feature branch, NEVER main)
git reset --hard HEAD~1
git push --force origin feature/branch-name
# 3. Consider using git-filter-repo to remove from history
```

### Recover Lost Changes
```bash
# See recent operations
git reflog

# Recover lost commit
git checkout <commit-hash>
git checkout -b recovery-branch
```

## Helpful Commands

```bash
# See commit history
git log --oneline --graph -10

# See what changed in a commit
git show <commit-hash>

# See all branches
git branch -a

# See who changed what
git blame path/to/file.py

# See changes between branches
git diff main..feature/branch-name

# Stash changes temporarily
git stash
git stash pop

# Clean untracked files
git clean -n  # Dry run
git clean -fd  # Actually delete

# Sync fork with upstream (if applicable)
git fetch upstream
git checkout main
git merge upstream/main
```

## Module-Specific Workflows

### Module 1867 (OE Data Patching)
```bash
git checkout -b feature/1867-enhancement
# Make changes to:
# - batch-orchestrator/app/services/oe_*.py
# - docs/bss-magic-app-template/src/components/Modules/OE*.tsx
# - runtime/views/service1867*.sql
git add <files>
git commit -m "feat(1867): description"
```

### Module 1147 (Solution Empty)
```bash
git checkout -b feature/1147-fix
# Make changes to:
# - batch-orchestrator/app/services/remediation_engine.py
# - docs/bss-magic-app-template/src/components/Modules/SolutionEmptyModule.tsx
git commit -m "fix(1147): description"
```

### Runtime Views
```bash
git checkout -b feature/add-view-product-detail
# Add/modify: runtime/views/*.sql
git commit -m "feat(runtime): add product detail view"
```

## Resources

- **GitHub Repo**: https://github.com/trilogy-group/maxis-data-remediation-bssmagic
- **Pull Requests**: https://github.com/trilogy-group/maxis-data-remediation-bssmagic/pulls
- **Security Alerts**: https://github.com/trilogy-group/maxis-data-remediation-bssmagic/security/dependabot
- **Git Documentation**: https://git-scm.com/doc
- **Conventional Commits**: https://www.conventionalcommits.org/

## Current Status

**Active PR**: https://github.com/trilogy-group/maxis-data-remediation-bssmagic/pull/4
- Module 1867 OE UI enhancements
- Maxis Platform application
- Security vulnerability fixes

**Next Steps**:
1. Wait for PR review
2. Address review feedback if any
3. Merge to main
4. Update local main: `git checkout main && git pull`
5. Delete feature branch: `git branch -d feature/module-1867-oe-enhancements`
