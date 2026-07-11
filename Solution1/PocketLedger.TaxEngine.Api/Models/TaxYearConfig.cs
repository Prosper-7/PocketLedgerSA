namespace PocketLedger.TaxEngine.Api.Models
{
    public class TaxYearConfig
    {
        public int TaxYearId { get; set; }
        public string TaxYear { get; set; } = string.Empty;
        public decimal PrimaryRebate { get; set; }
        public decimal SecondaryRebate { get; set; }
        public decimal TertiaryRebate { get; set; }
        public decimal TaxThresholdUnder65 { get; set; }
        public decimal TaxThreshold65to74 { get; set; }
        public decimal TaxThreshold75plus { get; set; }
        public decimal UifMonthlyCap { get; set; }
        public decimal UifRate { get; set; }
        public decimal MedicalCreditMain { get; set; }
        public decimal MedicalCreditDependant { get; set; }
        public decimal RetirementDeductionPct { get; set; }
        public decimal RetirementAnnualCap { get; set; }
        public decimal CgtInclusionRate { get; set; }
        public decimal CgtAnnualExclusion { get; set; }
        public bool IsActive { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}

