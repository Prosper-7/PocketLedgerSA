# PocketLedger SA

*Tax and small-business accounting, in one place, for people who'd otherwise be doing it alone at a kitchen table.*

## Why we built this

This started with a queue at a SARS branch. While helping my mom register
her tax number and work through her own return, it became obvious how much
of "doing your taxes" in South Africa is just... figuring it out yourself —
one form, one queue, one spreadsheet at a time, with no single place that
pulls it together for an ordinary person.

PocketLedger SA is built for that person. Not a large company with an
in-house accountant — an individual, a freelancer, or a small business owner
who wants to know roughly what they owe, keep their records straight through
the year, and walk into tax season without dread. Small business and
individual users are the whole point of this app, not an afterthought.

## Who it's for

- **Individuals** who want a clear, ongoing picture of what they owe instead
  of a once-a-year scramble.
- **Freelancers and sole proprietors** juggling provisional tax (IRP6)
  deadlines alongside everything else.
- **Small business owners** who need their income, expenses, and receipts
  organised without hiring a full-time bookkeeper.

## The team


Brooklyn Chigozie:  Project Manager — Backend Developer — C# tax engine
 frontend & Database  enquiresbrooklyn@gmail.com   
Prosper Odoemela: Front & Backend Developer — Python intelligence service & Cloud Deployment [prosperodoemela4@gmail.com](mailto:prosperodoemela4@gmail.com) · [github.com/Prosper-7](https://github.com/Prosper-7) 

## What it does

- **Tax calculation** — PAYE, provisional tax (IRP6), UIF, medical scheme
  tax credits, retirement contribution deductions, and capital gains
  estimates, all versioned by tax year so brackets update without a code
  change.
- **Statement & receipt intelligence** — imports bank statements, OCRs
  receipt photos, auto-categorises transactions, flags duplicates and
  missing receipts, and surfaces anomalies that could draw audit attention.
- **One dashboard** — estimated tax owed, refund/shortfall position,
  category breakdowns, and deadline reminders, synced across devices.

Full feature list in `docs/PocketLedger_SA_Technical_Specification.docx`.

## Tech stack

| Layer | Technology | Owner |

| Tax engine (backend) | C# / .NET 8, ASP.NET Core Web API | Brooklyn |

| Intelligence service (backend) | Python 3.12, FastAPI | Prosper |

| Database | MySQL 8 (Amazon RDS) | Brooklyn |

| Mobile app | React Native (Expo) | Both of you |

| Cloud provider | AWS | Propser |

| Auth | JWT | Brooks (tax-engine) |

| CI | GitHub Actions | Both of You |

##

The original spec was written around Azure — `docs/ARCHITECTURE_AWS.md` maps
every Azure service it mentions to its AWS equivalent, so read that
alongside the spec rather than instead of it.

## Project structure

```
PocketLedgerSA/
├── tax-engine/      C# tax rules engine (Brooks)
├── intelligence/    Python statement & receipt intelligence (Prosper)
├── frontend/        React Native app (both of you)
├── database/        shared MySQL schema (you)
├── .github/         CI workflows, one per service
└── docs/            spec, architecture, build guide, security checklist
```

## Quick start

1. `database/` — stand up MySQL, run `schema.sql`. See `database/README.md`.
2. `tax-engine/` — `dotnet run` from `src/PocketLedger.TaxEngine.Api`. See
   `tax-engine/README.md`.
3. `intelligence/` — `uvicorn main:app --reload` from `intelligence/`. See
   `intelligence/README.md`.
4. `frontend/` — `npm install && npm start`. See `frontend/README.md`.

Full sequencing, milestones, and exit conditions for each phase are in
`docs/BUILD_GUIDE.md` — **start there**.

## Documentation

- `docs/PocketLedger_SA_Technical_Specification.docx` — full original spec
- `docs/ARCHITECTURE_AWS.md` — Azure-to-AWS service mapping and network layout
- `docs/BUILD_GUIDE.md` — phase-by-phase build plan with owners and exit conditions
- `docs/SECURITY_CHECKLIST.md` — what needs to be true before this touches a real user's data

## Status: what's real vs. a starting point

Every file in this scaffold runs conceptually and follows the shared schema,
but treat it as a skeleton: the tax calculations need real SARS figures and
real test coverage before they're trustworthy, the bank statement parser
needs a real bank's CSV format, and this hasn't been through a security
review yet. `docs/SECURITY_CHECKLIST.md` covers what's needed before this
goes anywhere near a real user's financial data — required reading before
any Play Store / App Store submission.

## License

Not yet decided — add one before making this repository public. Given it
will handle real financial data, keep the repo private until the security
checklist is complete regardless of license choice.
