---
name: agent-feedback
description: >-
  Improve the skill, rule or agent definition that owns a behaviour, when authoring, reviewing,
  trimming or splitting one, or after the person corrects, refines or externally edits agent work or
  answers what the system should have resolved, never for feedback on people.
---

# Agent feedback

Feedback and review never authorize an external action: detecting, reading or comparing an edited
draft is not approval to act on it.

## After a correction

Change an artifact only where, with the information the initial run had, a general change would
have produced the corrected result.

Output blamed on an existing rule is measured against that rule's stated threshold. Output that
passes means the rule is missing, not violated: author the missing one instead of enforcing the
one that already held.

Before citing a rule against a proposed run, name the artifact the run produces in one noun and
check that the rule takes that noun as its object: a read run that emits material fires no
write-time formula. A rule that does not fire is a boundary to propose, not one to enforce.

Exactly one owner, and only for a reusable gap: a skill or rule for behaviour shared across tasks,
`CLAUDE.md` for what binds every task in this repository, the game's own `CLAUDE.md` for a decision
the next session needs rather than a rule, an agent definition in `.claude/agents/` for one
subagent. An agent definition governs only the runs that load it: where the top-level session
reaches the same hazard, the owner is an always-on rule.

Edit the artifact under `.claude/`, never a plugin cache. Add only a new reusable invariant. Never
add the concrete work product, wording, answer, or outcome. Forward-test only when it cannot
mutate live systems or require new approval.

## Without a correction

A failure that costs a second time in one session names its owner:

- The same command or tool fails twice: fix the tool, or record the working route in its skill.
- You re-derive what a file or earlier run already held: the owner of that fact.
- Turns pass without progress on the stated goal: the skill the run follows, else `CLAUDE.md`.
- You repeat the same sequence of three or more steps by hand: a script or a skill step.
- You work around a failing script instead of fixing it: the script.
- A shortcut visible in the run was used by no artifact: whichever artifact owns that work.

## Write for a literal reader

- Cut the history that produced the rule: version changes, vendor incidents, and the date it was
  decided. Keep a measured number, a verbatim phrasing, and the observed failure mode.
- An artifact may state a rule or a measurement. It may not state a status.
- A terminal phrase stops everything rather than the half it was scoped to. Name the half it
  governs, or a run parks its finding in whatever escape hatch sits beside it.
- Where one meaning is spelled out at several sites, name it with one existing word and repeat the
  word, never the description.

## Shape

- A section-scoped rule already misread once earns a file of its own. Check what the first gate in
  a body does to each occasion the description names: the mode that gate locks out is the cut.
- An invariant goes in the file where it fires, never in the router. A caller stating a caveat
  about another file's behaviour that the other file does not state itself means the owner is
  wrong, not the caller.
- Finish a split by having an agent with no context walk one whole job through the new files,
  given the skill directory rather than one file: a walker confined to one file reports as missing
  what sits next door by design.
- A rule that fires on a minority of turns gets `paths:` frontmatter or becomes a skill. Reference
  material is never always-on. A `paths:` rule loads on a Read, `cat` or Write of a matching file,
  never on a grep or the Skill tool, so a clause that must fire before any Read stays always-on.
- A rule rising into a router is re-scoped per mode as a list of what each mode may write, never
  universalized into one sentence. A surface several operations share is its own file, and a step
  whose mechanics contradict the shared ones is a surface, not an operation. Pair a prohibition
  with a route to the owner of the excluded work. Freeze the text before dispatching a cold walker.

## Adding or cutting a line

A new or changed line rests on a person's message or an observed failure, named in the commit
message. A line with neither is not written.

For a change the person orders, draft the one-sentence target text, read the whole file for the
line it folds into, and show the wordings before committing, or name them in the report on an
unattended run; a delegate brief carries that text or a length cap and asks for the removal-first
diff. The remedy for an agent behaviour is a line in the artifact that owns it, never a hook, a
validator or other automated block. A correction about a property of the code, such as a forbidden
import or a misused API, is no agent behaviour: its remedy is a lint rule whose message says what to
do instead. Before reporting a fix, walk the person's own example through it with today's state: no
marker, no record, the run that starts tomorrow.

A cleanup of skills and rules has three equal goals: cut what another owner states or what only
narrates history, collapse special cases, and leave no two passages contradicting each other,
reported in their own section. A skill checked into a repository stays on there: one machine's
usage measures only one person's sessions. One the person does not run is switched off for them
alone, in the git-ignored `.claude/settings.local.json` (`skillOverrides`).

A line obliging an agent to report a value is incomplete until it names the field the consumer
joins on. Open the consuming artifact and carry its key back into the line.

A gate deciding whether to produce an artifact answers two questions separately: what makes this
possible, and what makes it wanted. Every suppressing condition ships with its trace, naming the
item it dropped and the reason in the run report, or a wrong suppression leaves no evidence
anywhere.

Cutting a skill's reference to another artifact is a deletion, never a substitution: a description
in place of the name ("the skill that owns the page mechanics") is the same reference, and a shorter
file is the success criterion. Inline the fact only where that pointer was its sole carrier and the
skill cannot run without it. Check the target's frontmatter: an always-on rule is already in the
reader's context, so the citation goes. A `paths:`-scoped rule loads only after the skill has
fired, so its clause is inlined. A name appearing as data, a field value or an area, is not a
reference and stays.

Before building or changing Claude Code artifacts (skills, rules, subagents, hooks, settings, MCP),
consult the official docs, or the `claude-code-guide` agent where the session's agent list offers
it. A rule asserting how the system behaves is checked against the system before it is written and
before it is leaned on. Add an MCP server, permission or hook at project scope (`.mcp.json` or
`.claude/settings.json`, and `.codex/config.toml` for Codex), never `settings.local.json` or user
scope, unless the person names that scope. A new skill gets its `agents/openai.yaml` beside its
`SKILL.md`, the manifest Codex lists it by.
