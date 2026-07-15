using System.Data;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;

namespace PocketLedger.TaxEngine.Api.Data
{
    public class AppDbContext
    {
        private readonly string _connectionString;

        public AppDbContext(IConfiguration configuration)
        {
            _connectionString = configuration.GetConnectionString("TaxEngineDb")
                ?? throw new InvalidOperationException("Connection string 'TaxEngineDb' not found.");
        }

        /// <summary>
        /// Creates and returns an initialized SQL Server connection ready for Dapper execution.
        /// </summary>
        public IDbConnection CreateConnection()
        {
            return new SqlConnection(_connectionString);
        }
    }
}
