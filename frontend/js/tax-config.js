// Tax figures are data, not logic.
// New tax year after a Budget? Add a new entry to TAX_YEARS and change CURRENT_YEAR.
// Never edit a past year, so old estimates stay reproducible.
// Source: SARS. Verify every figure at sars.gov.za before relying on it.
const TAX_YEARS = {
  "2026/27": {
    // [upper limit of bracket, base tax, marginal rate]
    brackets: [
      [245100, 0, 0.18],
      [383100, 44118, 0.26],
      [530200, 79998, 0.31],
      [695800, 125599, 0.36],
      [887000, 185215, 0.39],
      [1878600, 259783, 0.41],
      [Infinity, 666339, 0.45],
    ],
    rebates: { primary: 17820, secondary: 9765, tertiary: 3249 }, // per year
    medicalCredit: { main: 376, firstDependant: 376, additional: 254 }, // per month
    uifRate: 0.01,
    uifMonthlyCap: 177.12,
    retirement: { rate: 0.275, annualCap: 430000 },
  },
};
const CURRENT_YEAR = "2026/27";
