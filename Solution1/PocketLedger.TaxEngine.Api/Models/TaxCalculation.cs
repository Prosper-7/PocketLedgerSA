namespace PocketLedger.TaxEngine.Api.Models
{
    public class TaxCalculation
    {
        public long CalculationId { get; set; }
        public int UserId { get; set; }
        public int TaxYearId { get; set; }
        public decimal TaxableIncome { get; set; }
        public decimal FinalTaxOwed { get; set; }
        public DateTime CalculatedAt { get; set; }
    }
}

