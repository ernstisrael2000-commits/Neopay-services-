---
name: Duplicate firestore.rules files
description: This project has two near-identical firestore.rules files that must be edited together
---

# Two firestore.rules files exist

**Why:** The repo has both a root `firestore.rules` and `database/firestore.rules`.
They are near-duplicates (same collections/rules, minor comment differences) and
git history shows both being edited in the same commits historically — so
whichever one is actually deployed to Firebase, keeping them in sync avoids a
silent security-rule drift where one file says one thing and the other says
another. `replit.md`/`docs/README.md` document `database/firestore.rules` as
"the" rules file, but the root copy exists too and diverging them is confusing
for the next person who deploys.

**How to apply:** any time you change a Firestore security rule, apply the same
change to both `firestore.rules` (repo root) and `database/firestore.rules`.
There is no in-repo script that deploys either file to Firebase — deployment
is manual (Firebase console or `firebase deploy --only firestore:rules` run
outside this workflow), so after editing, remind whoever deploys that the
change still needs to be pushed to the live Firebase project.
