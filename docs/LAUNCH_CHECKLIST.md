# Launch Checklist

The three highest-value things standing between this site and its first
dollar of revenue are all Brooks-only actions (Stripe Dashboard clicks, env
vars) — no further engineering shortens any of them. This page exists so the
answer to "what do I click next?" is never "read the CLAUDE.md prose again."

Detailed rationale for each step lives in `CLAUDE.md` under "Stripe —
Shipping Checklist (Pre-Launch)"; this page is the linear, check-it-off
version of the same information.

## 1. Consulting funnel — flip Stripe from test to live keys

- [ ] In the Stripe Dashboard, go to **Products → + Add product** and create
      three products matching the service tiers on `/consulting`:
      - Strategy Session — $150 (one-time)
      - Dev Sprint — $2,400/week (deposit)
      - Fractional CTO — $4,000/month (deposit)
- [ ] Copy each product's `price_XXXX` ID and set it in Vercel → Settings →
      Environment Variables (Production) as `STRIPE_PRICE_STRATEGY`,
      `STRIPE_PRICE_SPRINT`, `STRIPE_PRICE_CTO` (see
      `src/pages/api/consulting/checkout.ts` for the exact env var names it
      reads — it already falls back to inline pricing if these are unset, so
      this step is optional but keeps pricing changes out of code).
- [ ] In Stripe Dashboard → Developers → API keys, copy the **live** secret
      key and publishable key.
- [ ] In Vercel → Settings → Environment Variables → **Production only**,
      set:
      - `STRIPE_SECRET_KEY=sk_live_...`
      - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...`
      (Leave the existing `sk_test_...` / `pk_test_...` values in
      `.env.local` for local dev — Vercel's production env vars override
      them only in production.)
- [ ] In Stripe Dashboard → Developers → Webhooks, add an endpoint pointing
      at `https://brooksroley.com/api/consulting/webhook` listening for
      `checkout.session.completed`, then copy the resulting `whsec_...`
      signing secret into Vercel as `STRIPE_WEBHOOK_SECRET` (Production).
- [ ] Redeploy (or wait for the next push) so the new env vars take effect,
      then run one real $150 Strategy Session checkout end-to-end to confirm
      `checkout_sessions.status` flips from `pending` to `paid`.

Once this is done, the tier CTAs on `/consulting` can be swapped from
"Book a Call" (Calendly) to a direct Stripe Checkout button — that swap is a
one-line, agent-doable follow-up once live keys exist (see the comment at
`src/pages/consulting.tsx:13`).

## 2. Tip jar — retired

The `/funding` tip jar was retired on 2026-10-23 at Brooks's request; nothing
to set up. The optional updates card (`src/components/UpdatesCard.tsx`) is off.

## 3. Digital Products — NBA Analytics Primer PDF

- [ ] Write the "NBA Analytics Primer" PDF content (the code-complete side —
      the email-capture waitlist on `/digital-products` — is already live).
- [ ] Upload it to Gumroad, set the $19 price, and paste the resulting
      Gumroad checkout link into `src/pages/digital-products.tsx` in place
      of the "launching soon" copy.
- [ ] Optionally: send the waitlist (visible via the new `/admin/email-signups`
      dashboard, source `nba_analytics_primer`) a launch email once live.

---

*Owner: Brooks. Nothing on this page is agent-doable — every checkbox needs
Dashboard access or content only Brooks can write. See CLAUDE.md's Open
Recommendations Ledger for the standing flag count on each of these.*
