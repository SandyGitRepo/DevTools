---
title: Git
owner: DevToolkit maintainers
reviewed: 2026-10-04
version: Git 2.46
tags: [vcs, git, workflow]
sources: [git-scm.com/docs]
---

Commands for daily work, fixing mistakes and keeping history clean.

## Setup

- Set your identity once per machine
- Use `main` as the default branch
- `pull.rebase true` avoids noisy merge commits

```bash
git config --global user.name "Asha Verma"
git config --global user.email "asha.verma@company.example"
git config --global init.defaultBranch main
git config --global pull.rebase true
git config --global core.autocrlf input     # Windows: true
```

## Daily workflow

- Commit small, focused changes with clear messages
- `git add -p` stages hunks interactively
- Check `git status` and `git diff --staged` before committing

```bash
git switch main && git pull
git switch -c feature/LOAN-123-emi-rounding
git add -p
git commit -m "Round EMI with HALF_EVEN to match core banking"
git push -u origin feature/LOAN-123-emi-rounding
```

## Branches

- `git switch` changes branches; `git restore` changes files (clearer than `checkout`)
- Delete merged branches locally and remotely
- `git branch -vv` shows tracking and ahead/behind

```bash
git branch -vv
git switch -                        # previous branch
git branch -d feature/old           # only if merged
git push origin --delete feature/old
git fetch --prune                   # drop deleted remote branches
```

## Rebase

- Rebase replays your commits on top of the latest `main`
- Never rebase commits that others have already pulled
- Interactive rebase squashes and rewords before a PR

```bash
git fetch origin
git rebase origin/main
# resolve conflicts, then:
git add <file> && git rebase --continue
git rebase --abort                  # give up and go back

git rebase -i HEAD~3                # squash / reword last 3 commits
git push --force-with-lease         # safe force push of your own branch
```

## Undo

- `restore` discards working-tree changes; `--staged` unstages
- `reset --soft` undoes a commit but keeps changes staged
- `revert` creates a new commit that undoes an old one — safe on shared branches

```bash
git restore file.txt                # discard local edits
git restore --staged file.txt       # unstage
git commit --amend                  # fix the last commit message/content
git reset --soft HEAD~1             # undo last commit, keep changes
git revert 3f2a1bc                  # undo a pushed commit safely
git reflog                          # find "lost" commits
```

## Stash

- Park unfinished work without committing
- Name stashes so you can find them later
- `pop` applies and drops; `apply` keeps the stash

```bash
git stash push -m "wip: emi rounding"
git stash list
git stash pop
git stash apply stash@{1}
git stash drop stash@{1}
```

## Inspect history

- `log --oneline --graph` gives a compact branch view
- `blame` shows who last changed each line
- `bisect` binary-searches for the commit that broke something

```bash
git log --oneline --graph --decorate -20
git log -p --follow -- src/Emi.java
git blame -L 40,60 src/Emi.java
git show 3f2a1bc
git bisect start; git bisect bad; git bisect good v1.4.0
```

## Tags and releases

- Annotated tags carry a message and author
- Push tags explicitly
- Use semantic versions: `vMAJOR.MINOR.PATCH`

```bash
git tag -a v1.5.0 -m "Release 1.5.0"
git push origin v1.5.0
git tag --list "v1.*"
git describe --tags
```

## Clean up

- `clean -n` previews what would be deleted
- `.gitignore` keeps build output and secrets out
- If a secret was committed, rotate it first — history rewrites are not enough

```bash
git clean -n                        # dry run
git clean -fd                       # delete untracked files and folders
git rm --cached .env                # stop tracking, keep the file
echo ".env" >> .gitignore
```
