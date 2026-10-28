# How the money works

Everything is in pesos. Owners and managers see all of it; designers see only their own pay (Money is hidden from them, and the cloud rules block it).

## From inquiry to paid

1. **Inquiry** (Jobs → New inquiry): who asked, what they need, by when, their budget. It adds the client and a job in Inquiry.
2. **Quote** (Documents → Quotes): lines from the price list. Student orgs get student prices automatically; REPYOURORG15 takes 15% off. Percent add-ons (rush +25%, extra revision +15%, source files +20%, ownership +35% to +60%) are worked out on the package price. **Make the job** or **Make the contract** carries every line forward.
3. **Contract** (Documents → Contracts): one of the 13 v1.0 templates, filled from the client and the job, printed on the matching letterhead with the price, the brief, the terms, the 50% down payment and the signature lines.
4. **Invoice** (job → Money → Make an invoice): numbered JW-0032-2026 onward, never reusing a number. Its status follows the job's payments: unpaid, partly paid, paid, or overdue after the due date (15 days by default).
5. **Payment** (Record a payment): each one gets an acknowledgment receipt number, AR-0001-2026 onward. The receipt says it isn't a BIR official receipt.

## Designer pay

- Each job has a **team split** (job → Money → Team split), like the Payment Designation sheet: for example Joshua 60%, Kaye 40%.
- A **deduction** (5% by default, Settings → Money) comes off each payment first, for processing and the tax pool.
- **Shares are released as the client pays.** A ₱3,500 job with a ₱1,750 down payment releases ₱1,662.50 (₱1,750 less 5%), split 60/40. When the client pays the rest, the rest is released. The shares always add up to the peso.
- **Money → Payouts** shows what each person has earned, been paid and is owed. **Pay now** fills in the amount and where they get paid; record the GCash or bank reference. Each person can download a statement.
- Designers see the same for themselves under **My pay**, and add their own GCash, Maya or bank details there (with a QR code if they like).
- A paid job with no split shows a warning on Payouts: nobody earns its share until a split is set.

## The commission tracker

**Settings → Import the commission tracker** reads `JOSHWORK_COMMISSION_TRACKER.xlsx` on the device:

- Main Commission Tracker → jobs (COM-001…), clients, and the initial and final payments. Payments without a paid-on date use the job's start or end date; the preview says how many.
- Payment Designation → each job's split and deduction. When a job has two rows (COM-026), the later row is used and the preview says so.
- Monthly Summary → the monthly targets and the big-project line. BIR → the start date, the 8% option and the limits.
- **"Everyone has been paid for the tracker's payments"** records one payout per person for the shares of those past payments, so nobody shows as owed for work already settled outside the app. Payments recorded in the app afterwards stay owed until paid out.
- Importing again updates the same jobs instead of adding copies. New jobs continue the numbering (COM-042…).

## Booth events from JoshWorks POS

**Money → Booth events** brings in what the POS sends (Event → Report → **Send to Studio**). On the same phone or laptop, Studio reads it straight from the POS; from another device, open the file the POS saves with **Download Studio file**.

- Each event becomes a **Pop-up / Stickers** job. Its total is the event's sales, with one payment per payment method (Cash → On Hand, GCash → GCash…), and no deduction.
- **Each person's pay is their share.** The split is set so each share comes out to the POS amount exactly, to the centavo; what's left stays with the studio. Pay the POS already marked paid comes in as a payout, so Payouts shows only what's still owed.
- People not on the Studio team (a cashier friend, a partner selling their own stickers) are recorded as **expenses** on the job, with the booth fee, supplies and production cost.
- Commission orders become client jobs: the customer is added to Clients, deposits are down payments and the balance at pickup is the final payment. Set the team split on the job.
- Importing again updates the same job. When the POS numbers change after an import, the event shows **Changed in the POS**; **Update** brings it in line and removes anything that's no longer there.

## BIR (8% option)

Money → BIR estimates the 8% income tax on receipts from the registration date (16 Nov 2026): 8% of the year's receipts above ₱250,000, less tax clients withheld (Form 2307) and tax paid in earlier quarters. It lists each 1701Q and the 1701A with its due date, flags paid jobs missing an invoice or a 2307, and watches the ₱3M non-VAT ceiling. The dashboard shows the next return due. It is a planning aid; check returns with an accountant before filing.
