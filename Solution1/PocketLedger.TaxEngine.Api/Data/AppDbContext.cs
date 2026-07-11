using System.Data;
using Microsoft.Extensions.Configuration;
using MySqlConnector;

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
        /// Creates and returns an initialized MySQL connection ready for Dapper execution.
        /// </summary>
        public IDbConnection CreateConnection()
        {
            return new MySqlConnection(_connectionString);
        }
    }
}

