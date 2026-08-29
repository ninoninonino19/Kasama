# Known limitations

## Known limitation: an identity lives on one device

There are no accounts. You give a display name, and the app opens an anonymous Supabase
session — a real `auth.users` row with no email and no password, which is what keeps
`auth.uid()` and every RLS policy working without anyone registering.

The cost is that the session is the identity. Reinstall the app, clear its storage, or move
to a new phone, and there is no password to sign back in with: you rejoin with a new invite
code, as a new person. Your old profile stays in the household with its share of the bills
attached to a name nobody can log in as.

That is a fair trade for a house of flatmates splitting the electricity, and a bad one for
money you would go to court over. The upgrade path, if it stops being fair, is
`supabase.auth.updateUser({ email })` on the existing anonymous user — it keeps the same
`auth.uid()`, so nothing in the schema moves, and the account gains a way back in.

## Known limitation: a share is all-or-nothing

`bill_splits.paid` is a boolean, so a housemate's share is either settled or it isn't.
"I'll give you half now and the rest on payday" has nowhere to go — the usual workaround is
marking it paid early, which quietly makes the ledger a record of promises rather than
payments.

Fixing it properly is a schema change with a wide blast radius: either an `amount_paid`
column alongside `amount_owed` with `paid` derived from it, or a `bill_payments` table with
one row per payment. Either way every money calculation moves —
`isBillSettled`, `billOutstanding`, `billProgress`, `billFronted`, `summariseBalance`,
`summariseMonth`, `settleUp`, `fetchLedger` and `pending_reminders` — plus the tick-box on the bill detail screen becomes
an amount entry. It hasn't been done because it is a product decision, not an oversight:
plenty of split apps keep shares atomic on purpose.

## Nice-to-haves not built yet

- Partial payments (see above)
- Comments or reactions on board notes — the board is post-and-read today
