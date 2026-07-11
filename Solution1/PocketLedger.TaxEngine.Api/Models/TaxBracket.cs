namespace PocketLedger.TaxEngine.Api.Models
{
    public class TaxBracket
    {
        public int BracketId { get; set; }
        public int TaxYearId { get; set; }
        public int BracketOrder { get; set; }
        public decimal LowerBound { get; set; }
        public decimal? UpperBound { get; set; }
        public decimal BaseAmount { get; set; }
        public decimal Rate { get; set; }
    }
}

