Read SPEC.md fully before doing anything else — it's the source of
truth for architecture, schema, and scope.

We're building this phase by phase, in order, in one continuous session.
For each phase I ask for:

1. Build only what that phase's row in SPEC.md §13 describes. Don't
   touch files outside that phase's scope, and don't get ahead of the
   spec (no "while I was at it" additions from later phases).
2. When you think the phase is done, before telling me it's finished:
   run `git diff`, then explicitly check your own work against SPEC.md —
   does it match the relevant section's design decision, did you stay
   inside scope, does it respect the deterministic-code/LLM boundary in
   §11. Report anything that deviates, even minor, rather than silently
   fixing it.
3. Wait for my go-ahead before starting the next phase.

Confirm you've read SPEC.md and summarize the phase 0 scope back to me
before starting.