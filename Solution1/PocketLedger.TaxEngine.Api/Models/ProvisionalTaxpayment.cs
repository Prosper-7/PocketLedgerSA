namespace PocketLedger.TaxEngine.Api.Models
{
    public class ProvisionalTaxPayment
    {
        public int PaymentId { get; set; }
        public int UserId { get; set; }
        public int TaxYearId { get; set; }
        public string Period { get; set; } = "first"; // Maps to ENUM('first','second','topup')
        public DateOnly DueDate { get; set; }
        public decimal? PaidAmount { get; set; }
        public DateTime? PaidAt { get; set; }
    }
}

