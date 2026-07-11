namespace PocketLedger.TaxEngine.Api.Models
{
    public record TaxCalculationRequest(
        int UserId,
        string TaxYear,
        decimal GrossSalary,
        decimal FreelanceNetIncome,
        decimal TotalRetirementContributions,
        int MedicalSchemeDependants,
        int Age
    );

    public record TaxCalculationResult(
        string TaxYear,
        decimal GrossTaxableIncome,
        decimal TotalDeductionsAllowed,
        decimal NetTaxableIncome,
        decimal BaseTaxBeforeCredits,
        decimal TotalRebatesApplied,
        decimal TotalMedicalCredits,
        decimal FinalTaxOwed
    );
}

