# SourceDetector Website GA4 Rollout Plan

Last updated: 2026-03-12
Owner: Rock (orchestration) + Cursor (implementation)
Scope: GitHub Pages marketing site only (`docs/`), using a new standalone GA4 property.

## 1. Decision Summary

This rollout will **create a new standalone GA4 property for the SourceDetector website** instead of reusing the extension analytics property.

Why:
- The website and extension serve different measurement goals.
- The website should stay focused on acquisition / conversion analytics.
- The extension analytics implementation already has different runtime and privacy constraints.
- A separate property reduces schema pollution, risk of cross-context data confusion, and future governance overhead.

## 2. Architecture Boundaries

### In scope
- GitHub Pages site under `docs/`
  - `docs/index.html`
  - `docs/zh/index.html`
  - `docs/ja/index.html`
  - `docs/privacy/index.html`
  - `docs/faq/index.html`
  - `docs/404.html` if appropriate
- GA4 integration for pageview + key CTA/outbound conversion-intent events
- Lightweight analytics helper for static pages
- Consent/privacy copy updates if needed
- Validation in browser + production deployment verification

### Out of scope
- Chrome extension analytics refactor
- Cross-property identity stitching
- User-level cross-device attribution
- BigQuery export / Looker dashboards
- Ads integration
- Server-side tagging

## 3. Measurement Goals

The website GA4 setup must answer:
- Which pages bring the most engaged visits?
- Which CTA placements drive Chrome Web Store intent?
- Which external destinations are clicked most (Web Store / GitHub / Docs)?
- Which language pages perform best?
- Whether site changes improve install-intent conversion rate.

## 4. Privacy / Compliance Guardrails

The website analytics layer must NOT collect:
- scanned target URLs
- source code snippets
- findings content
- API keys / secrets / tokens
- user-entered payloads
- query strings containing sensitive data
- any extension-side artifact data

The website should only collect marketing-site interaction data such as:
- page path
- language
- CTA location
- outbound destination category
- engagement events

## 5. Property Strategy

### Chosen strategy
- Create a **new dedicated GA4 property** for the website.
- Use a **single Web Data Stream** for GitHub Pages production site.
- Keep extension analytics completely separate.

### Environment strategy
- Production measurement ID only in production-facing pages.
- If local preview tracking is needed, gate it behind an explicit opt-in or use a debug-safe toggle.
- Avoid polluting production analytics with local/dev traffic.

## 6. Event Design

### 6.1 Standard events
- `page_view`
- `session_start` (GA4 auto)
- `user_engagement` (GA4 auto when available)
- enhanced measurement can remain minimal if it does not create noisy data

### 6.2 Recommended custom events
- `cta_click`
- `outbound_click`
- `install_intent`
- `language_switch`
- `faq_expand` (only if FAQ interactions are meaningful)
- `privacy_link_click` (optional)

### 6.3 Event parameters
Common parameters:
- `page_language`: `en` | `zh-CN` | `ja`
- `page_type`: `home` | `privacy` | `faq` | `not_found`
- `cta_name`: semantic name of the clicked CTA
- `cta_location`: `hero` | `nav` | `footer` | `body`
- `destination_type`: `chrome_web_store` | `github` | `docs` | `privacy` | `faq` | `roadmap`
- `destination_url`: optional but should be normalized and low-risk

### 6.4 Naming constraints
- use snake_case only
- no dynamic event names
- keep parameter values enumerable where possible
- avoid freeform text except normalized URLs when strictly necessary

## 7. Technical Design

### Option preference
Preferred implementation: a small standalone analytics module injected into static pages.

Implementation characteristics:
- async GA script load
- helper function for custom event dispatch
- click delegation for CTA/outbound links via `data-*` attributes
- graceful no-op if GA fails or is blocked
- no impact on page rendering if analytics is unavailable

### Suggested structure
Possible additions:
- `docs/assets/analytics.js`
- optional shared snippet include pattern across pages
- `data-analytics-*` attributes on tracked links/buttons

### Data attribute examples
- `data-analytics-event="install_intent"`
- `data-analytics-cta-name="install_chrome"`
- `data-analytics-cta-location="hero"`
- `data-analytics-destination-type="chrome_web_store"`

## 8. Pages / Flows to Track

### High-priority pages
- `/`
- `/zh/`
- `/ja/`
- `/privacy/`
- `/faq/`

### High-priority clicks
- Hero install CTA
- Nav Chrome Web Store link
- Footer Chrome Web Store link
- GitHub links
- Docs link
- FAQ / Privacy link
- Language switch links

## 9. Acceptance Criteria

### 9.1 Technical acceptance
- GA script loads only for website pages in scope
- No JS errors introduced on tracked pages
- Site still works when GA is blocked
- Events visible in GA4 DebugView during validation
- No duplicate firing on single click
- Pageview fires correctly on each static page

### 9.2 Data acceptance
- `page_view` visible for all primary pages
- `install_intent` visible when install CTA is clicked
- `outbound_click` captures normalized destination taxonomy
- Language dimension is correct for EN / ZH / JA pages
- No sensitive parameters observed in emitted payloads

### 9.3 Product acceptance
After launch, the property can answer:
- top landing page by engaged sessions
- top install-intent CTA by placement
- top outbound destination by clicks
- language page performance comparison

### 9.4 Governance acceptance
- measurement ID storage location is documented
- event dictionary exists in repo
- privacy copy reflects website analytics usage if required
- future event additions must follow the same schema

## 10. Validation Plan

### Local / preview validation
- open each page in browser
- inspect network requests to `googletagmanager.com` and `google-analytics.com`
- verify no console errors
- verify click events emit expected payload structure
- verify blocked-script mode does not break UI

### GA validation
- validate events in DebugView / Realtime
- verify one test pass per tracked page and CTA
- confirm parameter names match schema exactly

### Production validation
- deploy via existing GitHub Pages workflow
- verify live pages contain analytics snippet
- verify realtime pageviews from production URL
- verify install CTA clicks reach GA4
- verify multilingual pages emit correct `page_language`

## 11. Deployment Plan

1. Create new GA4 property and web stream
2. Obtain measurement ID
3. Implement shared analytics helper for static site
4. Tag priority links/buttons with analytics metadata
5. Update privacy text if needed
6. Validate locally / preview
7. Commit and push to `main`
8. Wait for GitHub Pages deployment success
9. Validate production realtime events
10. Record rollout result and any follow-up items

## 12. Risks / Notes

### Key risk already observed in repo
The extension codebase currently contains an analytics helper at `src/utils/analytics.ts` with a hardcoded measurement ID and API secret. This website rollout must NOT blindly reuse that implementation.

Risks:
- API secret exposure pattern is unsafe for website usage
- Extension analytics semantics differ from website analytics needs
- Reusing it would blur privacy boundaries and governance

### Mitigations
- Create a separate website-only analytics layer
- Use the standard GA4 web snippet for the site
- Keep website property isolated
- Do not expose any Measurement Protocol secret in website code

## 13. Cursor Execution Package

Cursor should:
1. Review `docs/` website structure
2. Implement standalone website GA4 integration for static pages only
3. Add event instrumentation for priority links
4. Keep implementation minimal, readable, and privacy-safe
5. Avoid touching extension analytics unless strictly necessary for isolation/documentation
6. Add or update docs for event schema and measurement-ID configuration
7. Validate via build/deploy-safe checks and provide explicit evidence

## 14. Manual Inputs Potentially Needed From Stone

Only if unavailable in repo/environment:
- new website GA4 measurement ID
- access to GA4 Realtime / DebugView for final confirmation
- any desired privacy-policy wording approval if legal tone changes are sensitive

## 15. Definition of Done

Done means:
- plan documented
- implementation merged in repo working tree
- production deploy successful
- live site emits expected pageview + CTA events to the new GA4 property
- validation evidence captured
- any remaining manual-only dependency clearly listed
