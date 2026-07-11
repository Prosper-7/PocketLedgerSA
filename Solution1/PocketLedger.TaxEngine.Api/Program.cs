using PocketLedger.TaxEngine.Api.Data;
using PocketLedger.TaxEngine.Api.Services;
var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();

// Register the custom AppDbContext dependency as a Singleton
builder.Services.AddSingleton<AppDbContext>();

// Register the custom AppDbContext dependency as a Singleton
builder.Services.AddSingleton<AppDbContext>();

// Add the Tax Calculation Service dependency here:
builder.Services.AddScoped<TaxCalculationService>();

// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

app.UseAuthorization();

app.MapControllers();

// Health Check Endpoint for AWS Target Groups / ALB
app.MapGet("/health", () => Results.Ok(new { status = "ok", service = "tax-engine" }));

app.Run();


