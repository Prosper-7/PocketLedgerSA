# Adding the PocketLedger SA frontend (VS Code guide)

The frontend is plain HTML, CSS and JavaScript. It needs no build tools, no Node.js and no package installs. You edit the files and refresh the browser.

## What you are adding

```
pocketledger-sa/
├── frontend/
│   ├── index.html            # page structure
│   ├── css/
│   │   └── styles.css        # design tokens and all styling
│   └── js/
│       ├── tax-config.js     # SARS figures for each tax year (data, not logic)
│       ├── sample-data.js    # placeholder transactions, flags, categories
│       └── app.js            # calculator logic and page rendering
├── .vscode/
│   └── extensions.json       # recommends Live Server and Prettier
└── docs/
    └── FRONTEND_SETUP.md     # this guide
```

The script files must load in this order (already set in `index.html`): `tax-config.js`, then `sample-data.js`, then `app.js`.

---

## Step 1: Open your project in VS Code

1. Open VS Code.
2. Go to **File > Open Folder** and choose your project root (for example `pocketledger-sa`).
3. Open the Explorer with `Ctrl+Shift+E` (`Cmd+Shift+E` on Mac). You should see your `tax-engine`, `intelligence-service` and `database` folders.

## Step 2: Add the files

**Option A: use the zip (fastest)**

1. Download `pocketledger-frontend.zip`.
2. Extract it directly into your project root so that `frontend/`, `.vscode/` and `docs/` sit next to your existing folders.
3. If VS Code asks whether to merge folders, choose **Merge**.

**Option B: create each file by hand**

1. In the Explorer, right-click the project root and choose **New Folder**. Name it `frontend`.
2. Right-click `frontend`, choose **New Folder**, and create `css` and `js`.
3. Right-click each folder and choose **New File** to create `index.html`, `css/styles.css`, `js/tax-config.js`, `js/sample-data.js` and `js/app.js`.
4. Open each downloaded file, copy its full contents, and paste it into the matching new file. Save with `Ctrl+S`.

## Step 3: Install two extensions

1. Open the Extensions panel with `Ctrl+Shift+X`.
2. Search for **Live Server** (by Ritwick Dey) and click **Install**. It serves the page and refreshes it every time you save.
3. Search for **Prettier - Code formatter** and click **Install**. It keeps your code tidy.

If you extracted the zip, VS Code will also show a pop-up recommending these two extensions. Click **Install** there instead.

## Step 4: Run it

1. Open `frontend/index.html`.
2. Right-click anywhere in the file and choose **Open with Live Server**. You can also click **Go Live** in the bottom-right status bar.
3. Your browser opens at an address like `http://127.0.0.1:5500/frontend/index.html`.

Leave Live Server running. Every time you save a file, the page reloads by itself.

## Step 5: Check that it works

- The Overview page shows four summary figures, a transaction list, audit flags and category bars.
- Click **Dismiss** on an audit flag. It disappears and the "Needs attention" number drops.
- Click **Tax estimate** in the sidebar and drag the income slider. The tax figure and the highlighted bracket tile change as you drag.
- Switch your computer between light and dark mode. The page follows it.

## Step 6: Commit it to Git

In the VS Code terminal (`Ctrl+` `` ` ``):

```bash
git add frontend docs .vscode
git commit -m "Add frontend dashboard and tax estimate view"
git push
```

Also add this line to the repository structure in your `README.md`:

```
├── frontend/                # Static web UI (HTML, CSS, JS)
```

## Step 7: Know where to change things

| I want to change | Edit this file | Look for |
|---|---|---|
| Tax brackets, rebates, UIF, medical credits | `js/tax-config.js` | `TAX_YEARS` |
| Switch to a new tax year | `js/tax-config.js` | Add a new year entry, then update `CURRENT_YEAR` |
| Placeholder transactions and flags | `js/sample-data.js` | `TX`, `FL`, `CT` |
| Colours and dark mode | `css/styles.css` | The `:root` block at the top |
| Fonts | `index.html` and `css/styles.css` | The Google Fonts `<link>` and `font:` in `body` |
| Page layout and text | `index.html` | Sections with `id="overview"` and `id="tax"` |

Tax figures are data. When the Budget changes the numbers, add a new year entry. Do not edit a past year, so old estimates stay reproducible. Always confirm the figures at sars.gov.za first.

## Step 8: Connect it to your backend (when the APIs exist)

The frontend currently calculates tax in the browser using `calc()` in `app.js`, so it works on its own. Once your C# `POST /api/tax/paye` endpoint exists, you can make the C# engine the single source of truth.

**8a. Allow the frontend to call your C# API (CORS).** In `Program.cs`:

```csharp
builder.Services.AddCors(o => o.AddPolicy("frontend", p =>
    p.WithOrigins("http://127.0.0.1:5500", "http://localhost:5500")
     .AllowAnyHeader()
     .AllowAnyMethod()));

var app = builder.Build();
app.UseCors("frontend");
```

If your browser rejects the HTTPS certificate, run `dotnet dev-certs https --trust` once.

**8b. Allow it on the Python service.** In `app/main.py`:

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5500", "http://localhost:5500"],
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**8c. Call the API from `app.js`.** The request and response shape below is a proposal. Match it to whatever your C# controller actually accepts.

```js
async function calcFromApi() {
  const res = await fetch("https://localhost:5001/api/tax/paye", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      taxYear: CURRENT_YEAR,
      grossIncome: s.gross,
      ageGroup: s.age,
      retirementContributions: s.ret,
      medicalMembers: s.med,
    }),
  });
  if (!res.ok) throw new Error("Tax engine returned " + res.status);
  return res.json();
}
```

Then replace the `calc()` call inside `render()` with the API result, and keep `calc()` as an offline fallback while you build.

---

## Troubleshooting

- **The page is blank or unstyled.** Press `F12`, open the **Console** tab and read the red error. The most common cause is a wrong file path or the script files being loaded out of order.
- **"Go Live" does not appear.** Reload VS Code (`Ctrl+Shift+P`, then **Developer: Reload Window**) after installing Live Server.
- **The page opens but shows a directory listing.** Click `frontend`, then `index.html`. You opened Live Server from the project root.
- **The font looks different offline.** Inter loads from Google Fonts. Offline, the page falls back to your system font. Nothing is broken.
- **A CORS error appears in the console.** The origin shown in the error must match an entry in your `WithOrigins` or `allow_origins` list exactly, including the port.
- **Edits do not show up.** Save the file (`Ctrl+S`) and check that Live Server is still running in the status bar.
