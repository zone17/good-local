---
title: A comment describing a consumer is a hypothesis, not evidence
date: 2026-08-12
tags: [verification, tooling, vendored-code, code-review, documentation-drift]
---

## Symptom

A commit message, a PR body, and a `.gitignore` comment all asserted that the
idea-to-delivery workflow's "step 0" read `tools/pipeline-status.sh --check` to
skip completed phases — used to justify the urgency of a glob fix ("otherwise a
foundation run writes a second, competing PR/FAQ"). A reviewer checked and found
no such wiring:

```
$ grep -rn "pipeline-status" .specify/workflows/     # no matches
$ grep -n "id: foundation" -A 3 .specify/workflows/idea-to-delivery.yml
    condition: "{{ inputs.skip_foundation == false }}"   # a static input
```

The fix was still correct; the stated consequence was false. The claim reached
three durable artifacts before anyone opened the file it described.

## Cause

The claim was true *of the upstream template's design* and was written in the
tool's own header comment:

```sh
# The idea-to-delivery workflow's step 0 reads this file to skip phases whose
# artifact already exists, so this scanner is the source of truth for ...
```

`README-pipeline.md` repeated it. That comment describes an **intended
consumer**, and a vendored copy can lag its template by any amount — the wiring
genuinely did not exist here yet (it landed days later in a separate sync).
Reading a confident sentence in the code and repeating it *is* verification's
failure mode: the sentence looks like evidence because it lives next to the code
it describes.

The same shape appeared twice more in the same work, which is what makes it a
pattern rather than a slip:

- The scanner's own `--next-slug` block promised `deterministic; exit 0 always`
  two lines above code that exited 5 on the most common input.
- The scanner's phase glob was narrower than the workflow gate that consumes it
  (`docs/prfaq.md` vs the gate's `docs/prfaq*.md`), so the two disagreed about
  the same artifact while each looked self-consistent.

## Fix

Before repeating a claim about who consumes a thing, grep for the consumer. It
is one command, and it either produces a file:line citation or it refutes the
claim:

```sh
grep -rn "<tool-or-artifact-name>" <consumer-dir>/    # cite or drop the claim
```

Applied to writing, the rule is: **a comment about a consumer may be quoted as a
comment, never asserted as behavior.** "The tool's header says step 0 reads it"
is honest; "step 0 reads it" needs the grep.

For the inverse — a comment promising behavior *of the code it sits in* — the
check is a test, not a grep. Those three promises (`exit 0 always`, the glob
pair, the BLOCKED-never-masquerades contract) became fixture cases asserting
exit codes, which is why they can no longer drift silently.

## When this applies

- Vendored or synced code (`tools/`, templates, plugin caches): the copy's
  comments describe the *upstream* world, which may be ahead of yours.
- Any claim of the form "X reads this / X calls this / X depends on this" that
  is about to enter a commit message, PR body, ADR, or code comment.
- Doc lines that survived a sync: they describe the version they shipped with.

## What it cost

The false premise reached a commit message, a PR body, and a repo comment, and
was caught by a reviewer rather than by me. Correcting it meant an amended
commit, a force-push, and a rewritten PR description. The grep would have taken
about three seconds.

## Related

- [[fail-closed-dev-affordances]] — the sibling failure: a guard that looks
  correct while defaulting to the dangerous branch. Both are "the safe-looking
  thing is the unverified thing."
- `DECISIONS.md` D-035 — vendored `tools/` is fixed upstream and re-vendored,
  never patched in place; a local patch is reverted by the next sync exactly the
  way a local doc edit is.
