using Microsoft.AspNetCore.Mvc;
using PocketLedger.TaxEngine.Api.Models;
using PocketLedger.TaxEngine.Api.Services;

namespace PocketLedger.TaxEngine.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class TaxController : ControllerBase
    {
        private readonly TaxCalculationService _calculationService;
        private readonly ILogger<TaxController> _logger;

        public TaxController(TaxCalculationService calculationService, ILogger<TaxController> logger)
        {
            _calculationService = calculationService;
            _logger = logger;
        }

        /// <summary>
        /// Calculates the final South African income tax liability for a user and stores an audit trail.
        /// </summary>
        /// <param name="request">The incoming tax calculation parameters.</param>
        /// <returns>A detailed breakout of the tax breakdown or error details.</returns>
        [HttpPost("calculate")]
        [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(TaxCalculationResult))]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<IActionResult> CalculateTax([FromBody] TaxCalculationRequest request)
        {
            if (request == null)
            {
                return BadRequest("Calculation request payload cannot be null.");
            }

            if (request.GrossSalary < 0 || request.FreelanceNetIncome < 0)
            {
                return BadRequest("Income factors cannot be negative values.");
            }

            try
            {
                _logger.LogInformation("Initiating tax calculation routine for User {UserId}, Tax Year {TaxYear}.",
                    request.UserId, request.TaxYear);

                var result = await _calculationService.CalculateTaxAsync(request);
                return Ok(result);
            }
            catch (InvalidOperationException ex)
            {
                _logger.LogWarning(ex, "Validation or configuration failure during calculation for User {UserId}.", request.UserId);
                return BadRequest(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Critical system error executing tax calculations for User {UserId}.", request.UserId);
                return StatusCode(StatusCodes.Status500InternalServerError,
                    new { message = "A critical exception occurred while compiling your tax breakdown. Please check cloud database availability." });
            }
        }
    }
}