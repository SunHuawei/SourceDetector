# Source Detector blog rotation rules

## Purpose
Keep the homepage blog area representative and keep the topic backlog from repeating too quickly.

## Homepage slot mix
Maintain 4 homepage blog slots with this preferred mix:
1. 2 × `high-intent`
2. 1 × `workflow`
3. 1 × `risk-explainer`

## Fallback order
If a preferred category does not have a strong candidate, fill the slot in this order:
- `high-intent`
- `workflow`
- `risk-explainer`
- `comparison`
- `artifact-analysis`

## Selection rules
- Prefer newer posts over older ones.
- Avoid showing 2 posts with nearly identical search intent.
- Keep at least 1 practical guide on the homepage at all times.
- Only use `artifact-analysis` on the homepage when it adds a distinctive angle.

## Topic backlog consumption rules
- After a topic is used for a published article, move it from its active category to the `# used` section.
- Preserve the original `slug | title` line for auditability.
- Do not move a topic to `used` for draft-only or failed runs.
- If a previously used topic is intentionally revisited, copy it back into an active category with a materially different angle in the title.

## Cron behavior expectation
Each successful run should:
1. consume 2 topics from active categories
2. append them under `# used`
3. refresh homepage slots when stronger candidates exist

## Human override
If Stone explicitly picks a topic or homepage article, that choice overrides these defaults.
