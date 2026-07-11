namespace PocketLedger.TaxEngine.Api.Models
{
    public class IncomeSource
    {
        public int IncomeSourceId { get; set; }
        public int UserId { get; set; }
        public string Type { get; set; } = "salary"; // Maps to ENUM('salary','freelance','rental','investment','other')
        public string? EmployerName { get; set; }
        public bool IsProvisional { get; set; }
        public DateOnly? StartDate { get; set; }
        public DateOnly? EndDate { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}

