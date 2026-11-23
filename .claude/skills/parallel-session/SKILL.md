---
name: parallel-session
description: Track parallel work and the person's decisions in repo files (one item file per decision, review, work item or goal under docs/agent-work/items/, dated reports), so the person can review after being away, and choose between the shared checkout and a worktree per delegate. Use before fanning out a third delegate, before leaving a session running, and for "what is open", "what needs me", "decision list", "worktree".
---

# Parallel session

Goal, work and decision data live in the repository, never in a conversation.

## One home per fact

- `docs/agent-work/items/<id>.md`: one file per item, YAML frontmatter plus a body starting with
  `# <title>`. `kind` is one of:
  - `goal`: the goal in the person's words, the limits, a hold on publishing, and one to eight
    done criteria, each checkable by someone who did none of the work and naming its proof.
    Usually `goal.md`, one per repository.
  - `work`: one open piece of work, with `owner` (whoever moves next: the person only for a
    decision or a step no agent tool reaches, else an agent) and `evidence` (a commit hash, a
    file, or "not established"). A question whether something is on the list for later asks for a
    `work` item the person owns: read-only preparation for it (an inventory, candidates, a
    decision item) is welcome, and the work itself waits.
  - `decision`: a question with at least two `options`, or an agent assumption the person may
    veto. Only for direction, money or a relationship. Every other such point an agent settles is
    `status: assumed`; a minor or reversible default is named in the report only.
  - `review`: a request to look at something, with what to look at in the body. Only for what no
    reviewer can judge for the person; a choice a blind review settled and a run shipped gets no
    review item, and the run's report names it.

  A task, even one phrased as a question ("Who fixes the jump?"), is `work`.

- `docs/agent-work/YYYY-MM-DD-<topic>.md`: one report per topic, what was measured, with evidence.
  Its images sit in `docs/agent-work/YYYY-MM-DD-<topic>/`, JPEG at most 1600 px wide.
- `docs/agent-work/items/<id>/`: the item's images, JPEG at most 1600 px wide, named in its `images`
  field by file name. The folder goes with its item.

Work that waits on a decision keeps its `work` item, whose body names the decision's `id` instead
of repeating the question. The open points for the person's return are the items in
`docs/agent-work/items/`. No second list exists: a quest stays a line in `GAME.md`.

## Item fields

Every item: `kind` and `status` (`open`, `assumed` or `decided`; `work` and `goal` are only ever
`open`). Every item but a goal: `priority` (1 to 3, 1 costs most if missed) and `owner` (who
answers, or for work who moves next: one name, with any later steps in the body). The body's
first sentence after the title states what the owner does, in under 120 characters; context
follows. Optional: `order`, `area` (free text), `due` (ISO date), `evidence`. A decision or review
may carry `options` (each `key`, `label`, optional `detail`, and `score` and `noise` from a blind
review), `recommended` (an option key; a list where `multiple: true` lets the person pick several)
and `images` (option key to an image or a list of them, each a file name or `{src, caption}`, or a
list for the item as a whole). A table, such as scores per criterion, goes in the body as Markdown.
`assumed` states `assumption` or `recommended`. `decided` means the person's own answer and states
`decision` and `by`, with `quote` for the person's words; a choice an agent made is `assumed`. An
item carries no other field.

```md
---
kind: decision
status: open
priority: 2
owner: <the person's name>
recommended: a
options:
  - key: a
    label: Variant A
    detail: What choosing it changes.
  - key: b
    label: Variant B
---

# Which variant ships?

The question's context, in Markdown.
```

Items are written in English; a quotation keeps its original words. The open items fill every
priority from 1 to 3. Give a new item the priority and `order` of what it costs if missed against
the open items, and when a level empties, move the costliest items up.

## Steps

1. At start, read `docs/agent-work/items/`. Where no goal item exists and the work spans sessions
   or delegates, create `goal.md` with the goal quoted from the person's message. A work item
   outside the session's goal waits for its own session, whoever owns it. Check: the goal item
   quotes the person.
2. Every message from the person that adds, decides or changes work gets its item in the same
   turn. Write each answer into its item (step 4) and commit. Report an id that is unknown or
   already decided. Check: `git diff` shows the item.
3. A delegate's brief names the items it owns by `id`, quotes the item format, and says whether
   the delegate works in the shared checkout or a worktree. A delegate writes only its own item
   files and commits them with their paths named. After merging another session's work, read
   back the fields you wrote: a commit made from a copy older than yours reverts them without a
   conflict. Each delegate gets one batch with its write paths and a completion check, and ends
   when that batch is committed. Further work goes to a fresh delegate briefed from paths,
   commits and open findings, never to a running one. A delegate messages only a result, a
   blocker or a question.
4. A finished work item is deleted in the commit that finishes it. An item the person decided
   takes `status: decided`, `decision` and `by`, then is deleted: in the commit that carries the
   decision out, or, where work remains, replaced by a `work` item naming the `id`.
   `git log --all -- docs/agent-work/items/<id>.md` finds a deleted item.
   A goal criterion counts as verified only after a delegate that built none of it checks it
   against the real result and writes PASS or FAIL with its reason under the criterion; until then
   report it as "reported met".
5. A report and an item state the current state only. A later batch on the same topic edits that
   report and deletes what it superseded. Earlier rounds and raw reviews go to the scratch folder.
   A clock time an item or report carries is the value a command printed in the tool call that
   writes it (`NOW=$(date '+%H:%M')`); an event no command timed gets no time, or 'after <the
   timed event>'. A batch that changes an asset an item's images show re-renders those images in
   that batch.
6. When the person returns, put the open `decision` items to them in one question, each with its
   background and the full text of every option read from the item, and report the rest from the
   items, all ordered by what each costs if missed. Before ending the session, read the transcript
   from its first message: every item of the first report, every question put and its answer,
   every promise. Check: each unfinished one has an item.

## While the person is away

When the person says they are away, the session works unattended until they return: every
question for the person becomes an item (step 2), never a chat message. The session steers: it
writes briefs, reads reports, keeps items current, and hands every ready batch to a
delegate. When a delegate finishes, stop the servers and browsers it started and delete its
scratch then, not at session end. Check: no process or scratch folder of a finished delegate
remains.

## Shared checkout or worktree

The shared checkout is the default. Give a delegate a worktree only where the shared index costs
more than the worktree: several delegates committing at once, or a long run changing game code
that the full check plays. Short document edits stay in the shared checkout.

The check's lock (`node_modules/.cache/game-factory.lock`) serialises runs within one checkout
only, so each worktree's full check runs beside the others.

- Before the fan-out, commit and push everything the delegates need: a worktree starts from
  `origin/main`.
- `isolation: worktree` creates `.claude/worktrees/<name>/` on a local branch `worktree-<name>`.
  Where `git check-ignore -q .claude/worktrees/x` fails, add `.claude/worktrees/` to
  `.gitignore` first. A linter run over the whole tree also lints a worktree there unless its
  config ignores the path.
- A hand-made worktree goes outside the repository with no branch:
  `git worktree add --detach <scratch folder>/<run>-wt origin/main`.
- The delegate runs `bun install --frozen-lockfile` in its worktree, commits there, then runs
  `git fetch`, `git rebase origin/main` and `git push origin HEAD:main`, repeating on rejection,
  before its run ends. After a rebase that changed `bun.lock`, install again before a
  measurement or the check. Check: `git log origin/main..HEAD` prints nothing.
- As soon as a delegate's work is on `main`, while the session goes on, fast-forward the shared
  checkout with `git merge --ff-only origin/main` there, since a server the person starts in it
  serves the old state until then, and remove the worktree so none outlives it:
  `git worktree remove <path>` once, inside it, `git log origin/main..HEAD` and
  `git status --porcelain` both print nothing. Delete a `worktree-<name>` branch with
  `git branch -D` once `git log origin/main..worktree-<name>` prints nothing. `git worktree remove`
  drops a clean worktree's unpushed commits without a warning.
