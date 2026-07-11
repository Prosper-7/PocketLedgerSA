using System.Data;
using Dapper;
using PocketLedger.TaxEngine.Api.Data;
using PocketLedger.TaxEngine.Api.Models;

namespace PocketLedger.TaxEngine.Api.Services
{
    public class TaxCalculationService
    {
        private readonly AppDbContext _context;

        public TaxCalculationService(AppDbContext context)
        {
            _context = context;
        }

        public async Task<TaxCalculationResult> CalculateTaxAsync(TaxCalculationRequest request)
        {
            using var connection = _context.CreateConnection();

            // 1. Fetch active SARS parameters for the targeted tax year
            const string configSql = @"
                SELECT * FROM tax_year_config 
                WHERE tax_year = @TaxYear AND is_active = TRUE 
                LIMIT 1;";

            var config = await connection.QueryFirstOrDefaultAsync<TaxYearConfig>(configSql, new { request.TaxYear });
            if (config == null)
            {
                throw new InvalidOperationException($"No active tax configuration found for tax year '{request.TaxYear}'.");
            }

            // 2. Fetch progressive marginal brackets ordered bottom-to-top
            const string bracketSql = @"
                SELECT * FROM tax_brackets 
                WHERE tax_year_id = @TaxYearId 
                ORDER BY bracket_order ASC;";

            var brackets = (await connection.QueryAsync<TaxBracket>(bracketSql, new { config.TaxYearId })).ToList();

            // 3. Calculate gross taxable income before concessions
            decimal grossTaxableIncome = request.GrossSalary + request.FreelanceNetIncome;

            // 4. Calculate Retirement Annuity (RA) deductions (Section 11F cap: 27.5% capped at R350,000)
            decimal maxRaDeduction = grossTaxableIncome * config.RetirementDeductionPct;
            if (maxRaDeduction > config.RetirementAnnualCap)
            {
                maxRaDeduction = config.RetirementAnnualCap;
            }
            decimal retirementDeductionAllowed = Math.Min(request.TotalRetirementContributions, maxRaDeduction);

            // Calculate net taxable income
            decimal netTaxableIncome = Math.Max(0, grossTaxableIncome - retirementDeductionAllowed);

            // 5. Evaluate age-based tax thresholds
            decimal statutoryThreshold = config.TaxThresholdUnder65;
            if (request.Age >= 75) statutoryThreshold = config.TaxThreshold75plus;
            else if (request.Age >= 65) statutoryThreshold = config.TaxThreshold65to74;

            if (netTaxableIncome <= statutoryThreshold)
            {
                return new TaxCalculationResult(request.TaxYear, grossTaxableIncome, retirementDeductionAllowed, netTaxableIncome, 0, 0, 0, 0);
            }

            // 6. Compute Base Tax using marginal brackets
            decimal baseTax = 0;
            TaxBracket? matchedBracket = null;

            foreach (var bracket in brackets)
            {
                if (netTaxableIncome >= bracket.LowerBound && (bracket.UpperBound == null || netTaxableIncome <= bracket.UpperBound.Value))
                {
                    matchedBracket = bracket;
                    break;
                }
            }

            if (matchedBracket != null)
            {
                decimal amountInBracket = netTaxableIncome - (matchedBracket.LowerBound - 1);
                baseTax = matchedBracket.BaseAmount + (amountInBracket * matchedBracket.Rate);
            }

            // 7. Calculate and apply age rebates (Cumulative)
            decimal totalRebates = config.PrimaryRebate;
            if (request.Age >= 65) totalRebates += config.SecondaryRebate;
            if (request.Age >= 75) totalRebates += config.TertiaryRebate;

            // 8. Calculate Medical Scheme Fees Tax Credits (Section 6A)
            // Main member credit + additional dependants (multiplied by 12 months)
            decimal monthlyMedicalCredit = config.MedicalCreditMain + (request.MedicalSchemeDependants * config.MedicalCreditDependant);
            decimal annualMedicalCredits = monthlyMedicalCredit * 12;

            // 9. Figure final liability (Tax cannot drop below zero)
            decimal finalTaxOwed = Math.Max(0, baseTax - totalRebates - annualMedicalCredits);

            // 10. Persist historical calculation as an immutable audit record
            const string insertSql = @"
                INSERT INTO tax_calculations (user_id, tax_year_id, taxable_income, final_tax_owed)
                VALUES (@UserId, @TaxYearId, @TaxableIncome, @FinalTaxOwed);";

            await connection.ExecuteAsync(insertSql, new
            {
                UserId = request.UserId,
                TaxYearId = config.TaxYearId,
                TaxableIncome = netTaxableIncome,
                FinalTaxOwed = finalTaxOwed
            });

            return new TaxCalculationResult(
                request.TaxYear,
                grossTaxableIncome,
                retirementDeductionAllowed,
                netTaxableIncome,
                baseTax,
                totalRebates,
                annualMedicalCredits,
                finalTaxOwed
            );
        }
    }
}

