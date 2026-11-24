---
id: csharp-project-structure
name: C# Project Structure
description: "ASP.NET Core project structure with Minimal APIs, CQRS, EF Core, and PostgreSQL patterns"
category: core
type: standard
version: 1.4.0
author: community
---

<!-- Context: core/standards | Priority: critical | Version: 1.3 | Updated: 2026-03-15 -->

# C# Project Structure Standards

**Purpose**: Standard project structure for ASP.NET Core APIs using Minimal APIs, CQRS (MediatR), Vertical Slice Architecture, and EF Core with PostgreSQL  
**Scope**: Project layout, wiring patterns, and conventions — not language-level rules (see `csharp.md`)  
**Last Updated**: 2026-03-15

---

## Design Principles

- **`Features/`** contains only business logic — Commands, Queries, Validators, Handlers. No HTTP or framework code.
- **`Features/Common/`** contains shared feature-level concerns — pipeline behaviors, shared exceptions.
- **`Infrastructure/`** contains all technical wiring — endpoint registration, DB context, external services.
- **Command/Query records are the API contract** — they are sent directly from endpoints. No separate DTO mapping layer.

---

## Table of Contents

1. [Project Initialization](#1-project-initialization)
2. [Project Layout](#2-project-layout)
3. [Program.cs](#3-programcs)
4. [Features — Vertical Slices](#4-features--vertical-slices)
5. [Infrastructure](#5-infrastructure)
6. [EF Core & PostgreSQL](#6-ef-core--postgresql)
7. [Migrations](#7-migrations)
8. [NuGet Packages](#8-nuget-packages)

---

## 1. Project Initialization

**Always run these commands FIRST when creating a new ASP.NET Core project:**

```bash
# Create .gitignore (C# patterns)
dotnet new gitignore

# Create .gitattributes (normalize line endings)
dotnet new gitattributes

# Create the project
dotnet new web -n MyApi
cd MyApi
```

**Why this order?**
- `.gitignore` must exist before any build artifacts are created (prevents committing `bin/`, `obj/`, etc.)
- `.gitattributes` ensures consistent line endings across team members
- Projects created after these are in place benefit from proper version control setup

---

## 2. Project Layout

```
MyApi/
├── Program.cs                          # DI wiring + endpoint mapping only
├── MyApi.csproj
│
├── Api/                                # Endpoint entry points — discover processes here
│   ├── OrderEndpoints.cs               # IEndpointRouteBuilder extension — all /orders routes
│   ├── UserEndpoints.cs
│   └── ProductEndpoints.cs
│
├── Features/                           # Pure business logic — no HTTP/framework code
│   ├── Orders/
│   │   ├── CreateOrder.cs              # Command + Validator + Handler (co-located)
│   │   ├── GetOrder.cs                 # Query + Handler
│   │   ├── GetAllOrders.cs             # Query + Handler
│   │   └── CancelOrder.cs             # Command + Handler + Domain Event
│   │
│   ├── Users/
│   │   ├── CreateUser.cs
│   │   └── GetUser.cs
│   │
│   ├── Products/
│   │   └── CreateProduct.cs
│   │
│   └── Common/                         # Shared feature-level concerns
│       ├── Behaviors/
│       │   ├── LoggingBehavior.cs
│       │   └── ValidationBehavior.cs
│       └── Exceptions/
│           ├── NotFoundException.cs
│           └── ValidationException.cs
│
├── Infrastructure/                     # All framework/technical wiring (non-endpoint)
│   ├── Persistence/
│   │   ├── AppDbContext.cs
│   │   ├── Configurations/             # IEntityTypeConfiguration<T> classes
│   │   │   ├── OrderConfiguration.cs
│   │   │   └── UserConfiguration.cs
│   │   └── Migrations/                 # EF Core migrations (auto-generated)
│   ├── Services/                       # External HTTP clients, email, storage, etc.
│   └── Extensions/
│       └── InfrastructureExtensions.cs # AddInfrastructure() registration
│
├── Domain/                             # Optional: rich domain model (for DDD projects)
│   ├── Entities/
│   └── Events/
│
├── appsettings.json
├── appsettings.Development.json
└── GlobalUsings.cs                     # global using directives
```

---

## 3. Program.cs

`Program.cs` contains **only** DI registration and endpoint mapping. No business logic.

```csharp
// Program.cs
using MyApi.Api;
using MyApi.Infrastructure.Extensions;

var builder = WebApplication.CreateBuilder(args);

// ── Infrastructure (DB, external services) ───────────────────────────────
builder.Services.AddInfrastructure(builder.Configuration);

// ── MediatR (CQRS) ───────────────────────────────────────────────────────
builder.Services.AddMediatR(cfg =>
{
    cfg.RegisterServicesFromAssembly(typeof(Program).Assembly);
    cfg.AddOpenBehavior(typeof(LoggingBehavior<,>));
    cfg.AddOpenBehavior(typeof(ValidationBehavior<,>));
});

// ── Validation ────────────────────────────────────────────────────────────
builder.Services.AddValidatorsFromAssembly(typeof(Program).Assembly);

// ── OpenAPI ───────────────────────────────────────────────────────────────
builder.Services.AddOpenApi();   // .NET 9 native; or Swashbuckle for earlier versions

// ── Auth ──────────────────────────────────────────────────────────────────
builder.Services.AddAuthentication().AddJwtBearer();
builder.Services.AddAuthorization();

// ── Build ─────────────────────────────────────────────────────────────────
var app = builder.Build();

if (app.Environment.IsDevelopment())
    app.MapOpenApi();

app.UseAuthentication();
app.UseAuthorization();

// ── Endpoint registration ─────────────────────────────────────────────────
app.MapOrderEndpoints();
app.MapUserEndpoints();
app.MapProductEndpoints();

app.Run();

public partial class Program { }   // allows WebApplicationFactory in integration tests
```

---

## 4. Features — Vertical Slices

Each use case lives in its own file: **Command or Query record + Validator + Handler — nothing else**.  
The Command/Query record is the API contract — it is bound directly from the HTTP request body/route.  
No separate DTO types, no mapping layer.

### 3.1 Command Slice (write operation)

```csharp
// Features/Orders/CreateOrder.cs
namespace MyApi.Features.Orders;

// ── Command = API request contract ───────────────────────────────────────
// Bound directly from HTTP request body. No separate DTO needed.
public record CreateOrderCommand(Guid UserId, List<OrderItem> Items) : IRequest<CreatedOrderResult>;

// Return type is also a record — represents the response shape
public record CreatedOrderResult(Guid Id, Guid UserId, DateTime CreatedAt);

// ── Validator ─────────────────────────────────────────────────────────────
public class CreateOrderValidator : AbstractValidator<CreateOrderCommand>
{
    public CreateOrderValidator()
    {
        RuleFor(x => x.UserId).NotEmpty();
        RuleFor(x => x.Items).NotEmpty().WithMessage("Order must contain at least one item.");
    }
}

// ── Handler ───────────────────────────────────────────────────────────────
public class CreateOrderHandler(AppDbContext db) : IRequestHandler<CreateOrderCommand, CreatedOrderResult>
{
    public async Task<CreatedOrderResult> Handle(CreateOrderCommand cmd, CancellationToken ct)
    {
        var order = new Order
        {
            Id = Guid.NewGuid(),
            UserId = cmd.UserId,
            Items = cmd.Items,
            CreatedAt = DateTime.UtcNow,
        };

        db.Orders.Add(order);
        await db.SaveChangesAsync(ct);

        return new CreatedOrderResult(order.Id, order.UserId, order.CreatedAt);
    }
}
```

### 3.2 Query Slice (read operation)

```csharp
// Features/Orders/GetOrder.cs
namespace MyApi.Features.Orders;

// ── Query = API request contract ──────────────────────────────────────────
// Route parameter bound directly. Return type is the response shape.
public record GetOrderQuery(Guid Id) : IRequest<OrderResult?>;

public record OrderResult(Guid Id, Guid UserId, OrderStatus Status, DateTime CreatedAt);

// ── Handler ───────────────────────────────────────────────────────────────
public class GetOrderHandler(AppDbContext db) : IRequestHandler<GetOrderQuery, OrderResult?>
{
    public async Task<OrderResult?> Handle(GetOrderQuery query, CancellationToken ct)
        => await db.Orders
            .AsNoTracking()
            .Where(o => o.Id == query.Id)
            .Select(o => new OrderResult(o.Id, o.UserId, o.Status, o.CreatedAt))
            .FirstOrDefaultAsync(ct);
}
```

### 3.3 Domain Events (INotification)

```csharp
// Features/Orders/CancelOrder.cs
namespace MyApi.Features.Orders;

public record CancelOrderCommand(Guid Id) : IRequest<bool>;

// ── Domain event ──────────────────────────────────────────────────────────
public record OrderCancelledEvent(Guid OrderId) : INotification;

// ── Handler ───────────────────────────────────────────────────────────────
public class CancelOrderHandler(AppDbContext db, IPublisher publisher)
    : IRequestHandler<CancelOrderCommand, bool>
{
    public async Task<bool> Handle(CancelOrderCommand cmd, CancellationToken ct)
    {
        var order = await db.Orders.FindAsync([cmd.Id], ct);
        if (order is null) return false;

        order.Status = OrderStatus.Cancelled;
        await db.SaveChangesAsync(ct);

        await publisher.Publish(new OrderCancelledEvent(order.Id), ct);
        return true;
    }
}

// ── Side-effect handlers (each independent, all run on Publish) ──────────
public class SendCancellationEmailHandler(IEmailService email)
    : INotificationHandler<OrderCancelledEvent>
{
    public async Task Handle(OrderCancelledEvent e, CancellationToken ct)
        => await email.SendCancellationAsync(e.OrderId, ct);
}
```

### 3.4 Features/Common — Pipeline Behaviors

```csharp
// Features/Common/Behaviors/LoggingBehavior.cs
namespace MyApi.Features.Common.Behaviors;

public class LoggingBehavior<TRequest, TResponse>(ILogger<LoggingBehavior<TRequest, TResponse>> logger)
    : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
{
    public async Task<TResponse> Handle(
        TRequest request,
        RequestHandlerDelegate<TResponse> next,
        CancellationToken ct)
    {
        var name = typeof(TRequest).Name;
        logger.LogInformation("Handling {Request}", name);
        var sw = Stopwatch.StartNew();
        try
        {
            var response = await next();
            logger.LogInformation("Handled {Request} in {ElapsedMs}ms", name, sw.ElapsedMilliseconds);
            return response;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error handling {Request} after {ElapsedMs}ms", name, sw.ElapsedMilliseconds);
            throw;
        }
    }
}
```

```csharp
// Features/Common/Behaviors/ValidationBehavior.cs
namespace MyApi.Features.Common.Behaviors;

public class ValidationBehavior<TRequest, TResponse>(IEnumerable<IValidator<TRequest>> validators)
    : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
{
    public async Task<TResponse> Handle(
        TRequest request,
        RequestHandlerDelegate<TResponse> next,
        CancellationToken ct)
    {
        if (!validators.Any()) return await next();

        var context = new ValidationContext<TRequest>(request);
        var results = await Task.WhenAll(validators.Select(v => v.ValidateAsync(context, ct)));
        var failures = results.SelectMany(r => r.Errors).Where(f => f is not null).ToList();

        if (failures.Count > 0)
            throw new ValidationException(failures);

        return await next();
    }
}
```

---

## 5. Infrastructure & API Endpoints

### 4.1 API Endpoints (Entry Points)

Endpoint files live in the `Api/` directory at the project root — they are the entry points for discovering business processes. These files handle HTTP concerns only: routing, parameter binding, response shaping, and dispatching to MediatR. No business logic here.

```csharp
// Api/OrderEndpoints.cs
namespace MyApi.Api;

public static class OrderEndpoints
{
    public static void MapOrderEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/orders")
                       .WithTags("Orders")
                       .WithOpenApi()
                       .RequireAuthorization();

        group.MapGet("/",        GetAllOrders).WithName("GetAllOrders");
        group.MapGet("/{id}",    GetOrder)    .WithName("GetOrder");
        group.MapPost("/",       CreateOrder) .WithName("CreateOrder");
        group.MapDelete("/{id}", CancelOrder) .WithName("CancelOrder");
    }

    // Command/Query records are bound directly from HTTP — no mapping needed
    // Use ISender (not IMediator) — exposes only Send/CreateStream

    private static async Task<Ok<List<OrderResult>>> GetAllOrders(
        ISender sender, CancellationToken ct)
        => TypedResults.Ok(await sender.Send(new GetAllOrdersQuery(), ct));

    private static async Task<Results<Ok<OrderResult>, NotFound>> GetOrder(
        Guid id, ISender sender, CancellationToken ct)
    {
        var result = await sender.Send(new GetOrderQuery(id), ct);
        return result is not null ? TypedResults.Ok(result) : TypedResults.NotFound();
    }

    private static async Task<Results<Created<CreatedOrderResult>, ValidationProblem>> CreateOrder(
        CreateOrderCommand command, ISender sender, CancellationToken ct)
    {
        try
        {
            var order = await sender.Send(command, ct);
            return TypedResults.Created($"/orders/{order.Id}", order);
        }
        catch (ValidationException ex)
        {
            return TypedResults.ValidationProblem(ex.ToDictionary());
        }
    }

    private static async Task<Results<NoContent, NotFound>> CancelOrder(
        Guid id, ISender sender, CancellationToken ct)
    {
        var cancelled = await sender.Send(new CancelOrderCommand(id), ct);
        return cancelled ? TypedResults.NoContent() : TypedResults.NotFound();
    }
}
```

### 4.2 InfrastructureExtensions

```csharp
// Infrastructure/Extensions/InfrastructureExtensions.cs
namespace MyApi.Infrastructure.Extensions;

public static class InfrastructureExtensions
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        // ── Database ──────────────────────────────────────────────────────
        services.AddDbContext<AppDbContext>(options =>
            options.UseNpgsql(
                configuration.GetConnectionString("DefaultConnection")
                    ?? throw new InvalidOperationException(
                        "Connection string 'DefaultConnection' not found.")));

        // ── External services ─────────────────────────────────────────────
        services.AddHttpClient<IExternalService, ExternalService>(client =>
        {
            client.BaseAddress = new Uri(
                configuration["ExternalService:BaseUrl"]
                    ?? throw new InvalidOperationException("ExternalService:BaseUrl not configured."));
        });

        services.AddScoped<IEmailService, SmtpEmailService>();

        return services;
    }
}
```

### 4.3 AppDbContext

```csharp
// Infrastructure/Persistence/AppDbContext.cs
namespace MyApi.Infrastructure.Persistence;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<User> Users => Set<User>();
    public DbSet<Product> Products => Set<Product>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Auto-discovers all IEntityTypeConfiguration<T> classes in the assembly
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
    }
}
```

### 4.4 Entity Configuration

```csharp
// Infrastructure/Persistence/Configurations/OrderConfiguration.cs
namespace MyApi.Infrastructure.Persistence.Configurations;

public sealed class OrderConfiguration : IEntityTypeConfiguration<Order>
{
    public void Configure(EntityTypeBuilder<Order> builder)
    {
        builder.ToTable("orders");

        builder.HasKey(o => o.Id);

        builder.Property(o => o.Id)
            .HasDefaultValueSql("gen_random_uuid()");

        builder.Property(o => o.Status)
            .HasConversion<string>()
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(o => o.CreatedAt)
            .HasDefaultValueSql("now()")
            .IsRequired();

        builder.HasQueryFilter(o => !o.IsDeleted);

        builder.HasOne(o => o.User)
            .WithMany(u => u.Orders)
            .HasForeignKey(o => o.UserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
```

---

## 6. EF Core & PostgreSQL

### 5.1 Connection String (appsettings.json)

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Port=5432;Database=myapp;Username=postgres;Password=yourpassword"
  }
}
```

Override in environment / Docker / Kubernetes using double-underscore notation:
```
ConnectionStrings__DefaultConnection=Host=prod-db;...
```

For local development, use `dotnet user-secrets`:
```bash
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Host=localhost;..."
```

### 5.2 Async Query Patterns

```csharp
// ✅ Always pass CancellationToken to all EF async methods
var orders = await db.Orders
    .AsNoTracking()                       // read-only queries: skip change tracking
    .Where(o => o.UserId == userId)
    .OrderByDescending(o => o.CreatedAt)
    .ToListAsync(ct);

// ✅ FindAsync for primary key lookup (uses change tracker cache first)
var order = await db.Orders.FindAsync([orderId], ct);

// ✅ Bulk update / delete without loading entities (EF 7+)
await db.Orders
    .Where(o => o.Status == OrderStatus.Pending && o.CreatedAt < cutoff)
    .ExecuteUpdateAsync(s => s.SetProperty(o => o.Status, OrderStatus.Expired), ct);

await db.Orders
    .Where(o => o.IsDeleted && o.CreatedAt < cutoff)
    .ExecuteDeleteAsync(ct);
```

### 5.3 AsNoTracking

```csharp
// ✅ Use AsNoTracking for all read/query handlers — no change tracker overhead
var result = await db.Orders
    .AsNoTracking()
    .Where(o => o.Id == id)
    .Select(o => new OrderResult(o.Id, o.UserId, o.Status, o.CreatedAt))
    .FirstOrDefaultAsync(ct);

// ✅ Omit AsNoTracking in command handlers that modify and call SaveChangesAsync
var order = await db.Orders.FindAsync([id], ct);
order!.Status = OrderStatus.Shipped;
await db.SaveChangesAsync(ct);
```

---

## 7. Migrations

### Common Commands

```bash
# Add a new migration after model changes
dotnet ef migrations add MigrationName

# Apply pending migrations to the database
dotnet ef database update

# List all migrations and their applied status
dotnet ef migrations list

# Remove the last unapplied migration
dotnet ef migrations remove

# Multi-project setup (DbContext in separate library)
dotnet ef migrations add MigrationName \
  --project src/MyApp.Data \
  --startup-project src/MyApp.Api
```

### Production Deployment

```bash
# Generate idempotent SQL script — safe to run multiple times (recommended for CI/CD)
dotnet ef migrations script --idempotent --output migrations.sql

# EF 9: self-contained migration bundle (no dotnet SDK needed at deploy time)
dotnet ef migrations bundle --output migrations-bundle
./migrations-bundle --connection "${DB_CONNECTION_STRING}"
```

> **Do not** auto-migrate in `Program.cs` (`db.Database.MigrateAsync()`) in production multi-instance deployments — use SQL scripts or migration bundles instead to avoid race conditions.

---

## 8. NuGet Packages

```xml
<ItemGroup>
  <!-- Minimal API + ASP.NET Core (included via SDK, listed for clarity) -->
  <PackageReference Include="Microsoft.AspNetCore.OpenApi" Version="9.*" />

  <!-- CQRS -->
  <PackageReference Include="MediatR" Version="12.*" />

  <!-- Validation -->
  <PackageReference Include="FluentValidation.DependencyInjectionExtensions" Version="11.*" />

  <!-- EF Core + PostgreSQL -->
  <PackageReference Include="Npgsql.EntityFrameworkCore.PostgreSQL" Version="9.*" />
  <PackageReference Include="Microsoft.EntityFrameworkCore.Design" Version="9.*" />

  <!-- Testing -->
  <PackageReference Include="xunit" Version="2.*" />
  <PackageReference Include="xunit.runner.visualstudio" Version="2.*" />
  <PackageReference Include="Shouldly" Version="4.*" />
  <PackageReference Include="NSubstitute" Version="5.*" />
  <PackageReference Include="NSubstitute.Analyzers.CSharp" Version="1.*" />
  <PackageReference Include="Microsoft.AspNetCore.Mvc.Testing" Version="9.*" />
  <PackageReference Include="Testcontainers.PostgreSql" Version="3.*" />
</ItemGroup>
```

---

## GlobalUsings.cs

```csharp
global using System;
global using System.Collections.Generic;
global using System.Linq;
global using System.Threading;
global using System.Threading.Tasks;
global using FluentValidation;
global using MediatR;
global using Microsoft.AspNetCore.Http.HttpResults;
global using Microsoft.AspNetCore.Routing;
global using Microsoft.EntityFrameworkCore;
global using Microsoft.Extensions.Configuration;
global using Microsoft.Extensions.DependencyInjection;
global using Microsoft.Extensions.Logging;
global using MyApi.Infrastructure.Persistence;
global using NSubstitute;
```

---

## Quick Reference

| Concern | Where it lives | Rule |
|---------|---------------|------|
| DI wiring + endpoint mapping | `Program.cs` | Declarative only, no logic |
| API entry points (discover processes) | `Api/{Name}Endpoints.cs` | `IEndpointRouteBuilder` extension, routing + dispatch only |
| Business use case | `Features/{Name}/{UseCase}.cs` | Command/Query + Validator + Handler only |
| API request/response contract | Command/Query record + result record | No separate DTOs, no mapping |
| Pipeline behaviors | `Features/Common/Behaviors/` | `IPipelineBehavior<TRequest, TResponse>` |
| Shared exceptions | `Features/Common/Exceptions/` | Domain exception hierarchy |
| Database context + entity configs | `Infrastructure/Persistence/` | `AppDbContext` + `IEntityTypeConfiguration<T>` |
| EF Core migrations | `Infrastructure/Persistence/Migrations/` | Auto-generated by `dotnet ef` |
| External services | `Infrastructure/Services/` | Interface + implementation |
| Infra DI registration | `Infrastructure/Extensions/InfrastructureExtensions.cs` | `AddInfrastructure()` |
| Global usings | `GlobalUsings.cs` | `global using` |
