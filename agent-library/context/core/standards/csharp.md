---
id: csharp
name: C# Standards
description: "Universal C# best practices for naming, async, LINQ, error handling, and testing"
category: core
type: standard
version: 1.1.0
author: community
---

<!-- Context: core/standards | Priority: critical | Version: 1.1 | Updated: 2026-03-15 -->

# Universal C# Standards

**Purpose**: Universal C# best practices for AI agents working on .NET projects  
**Scope**: Language-level patterns, not framework-specific  
**Last Updated**: 2026-03-15

---

## Table of Contents

1. [Naming Conventions](#1-naming-conventions)
2. [Type Safety & Nullability](#2-type-safety--nullability)
3. [Async/Await Patterns](#3-asyncawait-patterns)
4. [LINQ](#4-linq)
5. [Error Handling](#5-error-handling)
6. [Pattern Matching](#6-pattern-matching)
7. [Code Organization](#7-code-organization)
8. [Records & Immutability](#8-records--immutability)
9. [Dependency Injection](#9-dependency-injection)
10. [Testing](#10-testing)

---

## 1. Naming Conventions

### 1.1 General Rules

| Element | Convention | Example |
|---------|-----------|---------|
| Classes, structs, records | PascalCase | `UserService`, `OrderItem` |
| Interfaces | `I` + PascalCase | `IUserRepository`, `IOrderService` |
| Methods | PascalCase | `GetUserById`, `ProcessOrder` |
| Properties | PascalCase | `FirstName`, `CreatedAt` |
| Fields (private) | `_` + camelCase | `_logger`, `_repository` |
| Local variables | camelCase | `userId`, `orderTotal` |
| Parameters | camelCase | `userId`, `cancellationToken` |
| Constants | PascalCase | `MaxRetryCount`, `DefaultTimeout` |
| Enums | PascalCase (type and members) | `OrderStatus.Pending` |
| Async methods | `Async` suffix | `GetUserAsync`, `SaveOrderAsync` |

### 1.2 Method Naming

```csharp
// ✅ GOOD - Verb + noun, PascalCase
public async Task<User> GetUserByIdAsync(Guid userId) { }
public async Task<IReadOnlyList<Order>> ListOrdersAsync(Guid userId) { }
public async Task DeleteUserAsync(Guid userId) { }
public bool IsEligibleForDiscount(Order order) { }
public bool HasPermission(string action) { }

// ❌ AVOID - Ambiguous or wrong case
public async Task<User> fetchuser(Guid id) { }
public async Task<User> DoUserGet(Guid id) { }
```

### 1.3 Interface Naming

```csharp
// ✅ GOOD - Always prefix with I
public interface IUserRepository { }
public interface IOrderService { }
public interface INotificationSender { }

// ❌ AVOID - No prefix, or wrong prefix
public interface UserRepository { }
public interface TUserRepository { }
```

### 1.4 Private Fields

```csharp
// ✅ GOOD - Underscore prefix, camelCase
public class OrderService
{
    private readonly IOrderRepository _orderRepository;
    private readonly ILogger<OrderService> _logger;
    private int _retryCount;
}

// ❌ AVOID - No prefix, or m_ prefix
private IOrderRepository orderRepository;
private IOrderRepository m_orderRepository;
```

---

## 2. Type Safety & Nullability

### 2.1 Enable Nullable Reference Types

**Rule: Always enable nullable reference types in all projects**

```xml
<!-- .csproj -->
<PropertyGroup>
  <Nullable>enable</Nullable>
  <WarningsAsErrors>nullable</WarningsAsErrors>
</PropertyGroup>
```

```csharp
// ✅ GOOD - Explicit nullability
public string Name { get; set; }          // Non-nullable: must be assigned
public string? MiddleName { get; set; }   // Nullable: may be null

public User? FindUser(Guid id) { }        // Returns null if not found
public User GetUser(Guid id) { }          // Never returns null (throws if not found)
```

### 2.2 Null Handling

```csharp
// ✅ GOOD - Null-coalescing and conditional operators
var name = user?.Name ?? "Unknown";
var city = user?.Address?.City ?? string.Empty;
user?.Notify("Welcome");

// ✅ GOOD - Null guard at method entry
public void ProcessOrder(Order order)
{
    ArgumentNullException.ThrowIfNull(order);
    // ...
}

// ✅ GOOD - Null-coalescing assignment
_cache ??= new Dictionary<string, User>();

// ❌ AVOID - Manual null checks where operators suffice
if (user != null && user.Address != null)
    city = user.Address.City;
```

### 2.3 Avoid Primitive Obsession

```csharp
// ✅ GOOD - Strongly typed IDs prevent mixing up parameters
public readonly record struct UserId(Guid Value);
public readonly record struct OrderId(Guid Value);

public Task<Order> GetOrderAsync(OrderId orderId, UserId userId) { }

// ❌ AVOID - Raw Guids are easy to mix up
public Task<Order> GetOrderAsync(Guid orderId, Guid userId) { }
```

---

## 3. Async/Await Patterns

### 3.1 Always Use CancellationToken

**Rule: Every public async method must accept a CancellationToken**

```csharp
// ✅ GOOD - CancellationToken flows through all async calls
public async Task<User> GetUserAsync(Guid userId, CancellationToken cancellationToken = default)
{
    var user = await _repository.FindAsync(userId, cancellationToken);
    return user ?? throw new NotFoundException($"User {userId} not found");
}

// ❌ AVOID - No way to cancel long-running operations
public async Task<User> GetUserAsync(Guid userId)
{
    return await _repository.FindAsync(userId);
}
```

### 10.6 When to Use Moq Instead of NSubstitute

While **NSubstitute is the default**, use **Moq** for:

```csharp
// Use Moq when you need MockBehavior.Strict (fail on unexpected calls)
var mockRepository = new Mock<IOrderRepository>(MockBehavior.Strict);
mockRepository.Setup(r => r.GetOrderAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
    .ReturnsAsync(new Order());

// Use Moq for verifying complex call sequences
var sequence = new MockSequence();
_serviceA.InSequence(sequence).Setup(x => x.MethodA()).ReturnsAsync(true);
_serviceB.InSequence(sequence).Setup(x => x.MethodB()).ReturnsAsync(false);

// Use Moq for verifying no other calls were made
mock.VerifyNoOtherCalls();

// Use Moq for mocking protected members
mock.Protected().Setup<string>("GetName").Returns("test");
```

**Note**: NSubstitute covers ~95% of real-world test scenarios. Only reach for Moq's advanced features if NSubstitute doesn't provide what you need.

---

## 4. LINQ

### 4.1 Prefer Method Syntax for Simple Chains

```csharp
// ✅ GOOD - Method syntax for filter/project/sort
var activeUserNames = users
    .Where(u => u.IsActive)
    .OrderBy(u => u.LastName)
    .Select(u => u.FullName)
    .ToList();

// ✅ GOOD - Query syntax for complex joins (more readable)
var result =
    from order in orders
    join user in users on order.UserId equals user.Id
    where order.Status == OrderStatus.Pending
    select new { order.Id, user.Name };
```

### 4.2 Materialize at the Right Time

```csharp
// ✅ GOOD - Materialize once, use the list
var activeUsers = users.Where(u => u.IsActive).ToList();
var count = activeUsers.Count;
var first = activeUsers.FirstOrDefault();

// ❌ AVOID - Multiple enumerations of IEnumerable (re-evaluates query each time)
var activeUsers = users.Where(u => u.IsActive);
var count = activeUsers.Count();   // evaluates query
var first = activeUsers.First();   // evaluates query again
```

### 4.3 Use Appropriate Termination Methods

```csharp
// ✅ GOOD - Choose the right method for the intent
var first = items.FirstOrDefault();           // null if empty
var single = items.SingleOrDefault();         // null if empty, throws if >1
var any = items.Any(x => x.IsActive);         // bool, stops at first match
var all = items.All(x => x.IsActive);         // bool, fails fast on false
var count = items.Count(x => x.IsActive);     // full enumeration

// ❌ AVOID - Using Count() to check existence (full enumeration)
if (items.Count() > 0) { }   // Use Any() instead
```

### 4.4 Avoid LINQ in Performance-Critical Paths

```csharp
// ✅ GOOD - Direct loop when allocation matters
var total = 0m;
foreach (var item in orderItems)
    total += item.Price * item.Quantity;

// LINQ alternative (fine for most code, avoids premature optimization)
var total = orderItems.Sum(item => item.Price * item.Quantity);
```

---

## 5. Error Handling

### 5.1 Use Specific Exception Types

```csharp
// ✅ GOOD - Specific, meaningful exceptions
public async Task<User> GetUserAsync(Guid userId, CancellationToken ct = default)
{
    var user = await _repository.FindAsync(userId, ct);
    if (user is null)
        throw new NotFoundException($"User '{userId}' was not found.");
    return user;
}

// ✅ GOOD - Domain exception hierarchy
public class DomainException : Exception
{
    public DomainException(string message) : base(message) { }
    public DomainException(string message, Exception inner) : base(message, inner) { }
}

public class NotFoundException : DomainException
{
    public NotFoundException(string message) : base(message) { }
}

public class ValidationException : DomainException
{
    public IReadOnlyList<string> Errors { get; }

    public ValidationException(IReadOnlyList<string> errors)
        : base("One or more validation errors occurred.")
        => Errors = errors;
}

// ❌ AVOID - Generic exceptions with no context
throw new Exception("Not found");
throw new ApplicationException("Something went wrong");
```

### 5.2 Validate at Entry Points

```csharp
// ✅ GOOD - Fail fast with guard clauses
public void PlaceOrder(Order order, Guid userId)
{
    ArgumentNullException.ThrowIfNull(order);
    ArgumentNullException.ThrowIfNull(userId);

    if (order.Items.Count == 0)
        throw new ValidationException(["Order must contain at least one item."]);

    if (order.TotalAmount <= 0)
        throw new ValidationException(["Order total must be greater than zero."]);

    // proceed with valid input
}
```

### 5.3 Result Pattern (for Expected Failures)

```csharp
// ✅ GOOD - Use Result<T> when failure is a normal outcome (not exceptional)
public readonly record struct Result<T>
{
    public bool IsSuccess { get; }
    public T? Value { get; }
    public string? Error { get; }

    private Result(bool isSuccess, T? value, string? error)
    {
        IsSuccess = isSuccess;
        Value = value;
        Error = error;
    }

    public static Result<T> Success(T value) => new(true, value, null);
    public static Result<T> Failure(string error) => new(false, default, error);
}

// Usage
public Result<Order> SubmitOrder(Cart cart)
{
    if (!cart.HasItems)
        return Result<Order>.Failure("Cart is empty.");

    var order = CreateOrderFromCart(cart);
    return Result<Order>.Success(order);
}

var result = SubmitOrder(cart);
if (result.IsSuccess)
    Console.WriteLine($"Order created: {result.Value!.Id}");
else
    Console.WriteLine($"Failed: {result.Error}");

// Reserve exceptions for truly exceptional, unexpected conditions.
// Use Result<T> for expected business failures (validation, not found in context of search, etc.)
```

### 5.4 Catch Specific Exceptions

```csharp
// ✅ GOOD - Catch what you can handle
try
{
    await _paymentGateway.ChargeAsync(amount, ct);
}
catch (PaymentDeclinedException ex)
{
    _logger.LogWarning(ex, "Payment declined for amount {Amount}", amount);
    return Result<Receipt>.Failure("Payment was declined.");
}
catch (TimeoutException ex)
{
    _logger.LogError(ex, "Payment gateway timed out");
    throw; // re-throw: let caller or middleware handle retries
}

// ❌ AVOID - Swallowing exceptions silently
try { await _paymentGateway.ChargeAsync(amount, ct); }
catch { }

// ❌ AVOID - Catching Exception broadly without re-throw
catch (Exception ex)
{
    _logger.LogError(ex, "Error");
    return null; // hides the real problem
}
```

---

## 6. Pattern Matching

### 6.1 Switch Expressions (Prefer over switch statements)

```csharp
// ✅ GOOD - Switch expression: concise, exhaustive
public decimal GetDiscount(CustomerTier tier) => tier switch
{
    CustomerTier.Bronze => 0.00m,
    CustomerTier.Silver => 0.05m,
    CustomerTier.Gold   => 0.10m,
    CustomerTier.Platinum => 0.20m,
    _ => throw new ArgumentOutOfRangeException(nameof(tier), tier, null)
};

// ❌ AVOID - Verbose switch statement for simple value mapping
switch (tier)
{
    case CustomerTier.Bronze: return 0.00m;
    case CustomerTier.Silver: return 0.05m;
    // ...
}
```

### 6.2 Type Patterns

```csharp
// ✅ GOOD - Type pattern with declaration
public string Describe(Shape shape) => shape switch
{
    Circle c    => $"Circle with radius {c.Radius}",
    Rectangle r => $"Rectangle {r.Width}x{r.Height}",
    Triangle t  => $"Triangle with base {t.Base}",
    _           => "Unknown shape"
};

// ✅ GOOD - is pattern for type checking with binding
if (notification is EmailNotification email)
{
    await SendEmailAsync(email.Address, email.Body, ct);
}
```

### 6.3 Property Patterns

```csharp
// ✅ GOOD - Property pattern for readable conditionals
public decimal CalculateShipping(Order order) => order switch
{
    { TotalAmount: >= 100 }            => 0m,           // free shipping
    { IsExpressDelivery: true }        => 15m,          // express
    { ShippingAddress.Country: "FI" }  => 5m,           // domestic
    _                                  => 10m           // international
};
```

### 6.4 Deconstruction

```csharp
// ✅ GOOD - Deconstruct tuples and records
var (firstName, lastName) = GetFullName(userId);
var (lat, lon) = location;

// ✅ GOOD - Discard unused parts
var (id, _, createdAt) = GetOrderSummary(orderId);
```

---

## 7. Code Organization

### 7.1 Namespace Per Feature (not per type)

```csharp
// ✅ GOOD - Feature-based namespaces
namespace MyApp.Orders;          // all order-related types together
namespace MyApp.Users;           // all user-related types together
namespace MyApp.Notifications;

// ❌ AVOID - Layer-based namespaces that scatter a feature across the codebase
namespace MyApp.Repositories;
namespace MyApp.Services;
namespace MyApp.Controllers;
```

### 7.2 File-Scoped Namespaces

```csharp
// ✅ GOOD - File-scoped namespace (C# 10+): less indentation
namespace MyApp.Orders;

public class OrderService { }

// ❌ AVOID - Block-scoped namespace adds unnecessary indentation
namespace MyApp.Orders
{
    public class OrderService { }
}
```

### 7.3 One Type Per File

```csharp
// ✅ GOOD - OrderService.cs contains only OrderService
// ✅ ACCEPTABLE - Small, closely related types in one file (e.g., value objects + their exceptions)

// ❌ AVOID - Multiple unrelated types in one file
// OrderService.cs containing OrderService + UserService + ProductRepository
```

### 7.4 Using Directives

```csharp
// ✅ GOOD - Global usings for commonly used namespaces (in a GlobalUsings.cs file)
global using System;
global using System.Collections.Generic;
global using System.Threading;
global using System.Threading.Tasks;
global using Microsoft.Extensions.Logging;

// ✅ GOOD - File-level usings at the top, outside namespace
using System.Text.Json;
using MyApp.Common;

namespace MyApp.Orders;
```

### 7.5 Class Structure Order

Follow this order within a class:

```csharp
public class OrderService : IOrderService
{
    // 1. Constants
    private const int MaxRetryCount = 3;

    // 2. Static fields
    private static readonly JsonSerializerOptions JsonOptions = new();

    // 3. Instance fields (private)
    private readonly IOrderRepository _repository;
    private readonly ILogger<OrderService> _logger;

    // 4. Constructor(s)
    public OrderService(IOrderRepository repository, ILogger<OrderService> logger)
    {
        _repository = repository;
        _logger = logger;
    }

    // 5. Properties

    // 6. Public methods

    // 7. Private methods
}
```

---

## 8. Records & Immutability

### 8.1 Use Records for Value Objects and DTOs

```csharp
// ✅ GOOD - Record for immutable data (value semantics, built-in equality)
public record UserDto(Guid Id, string Name, string Email);

public record Address(string Street, string City, string PostalCode, string Country);

// ✅ GOOD - Readonly record struct for small value objects (stack allocated)
public readonly record struct Money(decimal Amount, string Currency);
public readonly record struct Coordinates(double Latitude, double Longitude);

// Non-destructive mutation via 'with'
var updated = originalUser with { Email = "new@example.com" };
```

### 8.2 Immutable Collections

```csharp
// ✅ GOOD - Expose immutable views
public class Order
{
    private readonly List<OrderItem> _items = new();

    public IReadOnlyList<OrderItem> Items => _items.AsReadOnly();

    public void AddItem(OrderItem item)
    {
        ArgumentNullException.ThrowIfNull(item);
        _items.Add(item);
    }
}

// ✅ GOOD - ImmutableList for truly immutable scenarios
using System.Collections.Immutable;

public record ShoppingCart(ImmutableList<CartItem> Items)
{
    public ShoppingCart AddItem(CartItem item) =>
        this with { Items = Items.Add(item) };

    public ShoppingCart RemoveItem(Guid itemId) =>
        this with { Items = Items.RemoveAll(i => i.Id == itemId) };
}
```

### 8.3 init-only Properties

```csharp
// ✅ GOOD - init allows construction but prevents later mutation
public class OrderConfiguration
{
    public Guid OrderId { get; init; }
    public string Currency { get; init; } = "EUR";
    public int MaxItems { get; init; } = 100;
}

// Can set during object initializer, but not after
var config = new OrderConfiguration { OrderId = Guid.NewGuid(), Currency = "USD" };
// config.Currency = "EUR"; // ❌ compile error
```

---

## 9. Dependency Injection

### 9.1 Constructor Injection (Preferred)

```csharp
// ✅ GOOD - All dependencies injected through constructor, stored readonly
public class OrderService : IOrderService
{
    private readonly IOrderRepository _repository;
    private readonly IPaymentGateway _paymentGateway;
    private readonly ILogger<OrderService> _logger;

    public OrderService(
        IOrderRepository repository,
        IPaymentGateway paymentGateway,
        ILogger<OrderService> logger)
    {
        _repository = repository;
        _paymentGateway = paymentGateway;
        _logger = logger;
    }
}

// ❌ AVOID - Service locator pattern (hidden dependencies)
public class OrderService
{
    public async Task ProcessAsync()
    {
        var repo = ServiceLocator.Get<IOrderRepository>(); // hidden dependency
    }
}
```

### 9.2 Lifetime Registration

```csharp
// Registration in Program.cs or an extension method
services.AddScoped<IOrderService, OrderService>();      // per HTTP request
services.AddTransient<IEmailSender, SmtpEmailSender>(); // new instance each time
services.AddSingleton<ICacheService, MemoryCacheService>(); // single instance

// ✅ GOOD - Extension method groups related registrations
public static class OrdersServiceCollectionExtensions
{
    public static IServiceCollection AddOrders(this IServiceCollection services)
    {
        services.AddScoped<IOrderService, OrderService>();
        services.AddScoped<IOrderRepository, OrderRepository>();
        return services;
    }
}

// In Program.cs
builder.Services.AddOrders();
```

### 9.3 Options Pattern for Configuration

```csharp
// ✅ GOOD - Strongly-typed configuration
public class PaymentOptions
{
    public const string SectionName = "Payment";

    public string ApiKey { get; set; } = string.Empty;
    public string BaseUrl { get; set; } = string.Empty;
    public int TimeoutSeconds { get; set; } = 30;
}

// Registration
builder.Services.Configure<PaymentOptions>(
    builder.Configuration.GetSection(PaymentOptions.SectionName));

// Usage
public class PaymentGateway
{
    private readonly PaymentOptions _options;

    public PaymentGateway(IOptions<PaymentOptions> options)
    {
        _options = options.Value;
    }
}
```

---

## 10. Testing

### 10.1 Framework & Structure

**Use xUnit** as the default test framework. Use **Shouldly** for readable assertions. Use **NSubstitute** for mocking (pragmatic, readable syntax). Use **Moq** only for scenarios requiring strict mock behavior or complex verification.

```csharp
// ✅ GOOD - xUnit test class structure with NSubstitute
public class OrderServiceTests
{
    // Arrange shared fixtures in constructor or use class fixtures
    private readonly IOrderRepository _repositorySubstitute = Substitute.For<IOrderRepository>();
    private readonly ILogger<OrderService> _loggerSubstitute = Substitute.For<ILogger<OrderService>>();
    private readonly OrderService _sut;

    public OrderServiceTests()
    {
        _sut = new OrderService(_repositorySubstitute, _loggerSubstitute);
    }

    [Fact]
    public async Task GetOrderAsync_WhenOrderExists_ReturnsOrder()
    {
        // Arrange
        var orderId = Guid.NewGuid();
        var expected = new Order { Id = orderId };
        _repositorySubstitute
            .FindAsync(orderId, Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<Order?>(expected));

        // Act
        var result = await _sut.GetOrderAsync(orderId);

        // Assert
        result.ShouldBeEquivalentTo(expected);
    }

    [Fact]
    public async Task GetOrderAsync_WhenOrderNotFound_ThrowsNotFoundException()
    {
        // Arrange
        var orderId = Guid.NewGuid();
        _repositorySubstitute
            .FindAsync(orderId, Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<Order?>(null));

        // Act
        var act = () => _sut.GetOrderAsync(orderId);

        // Assert
        await act.ShouldThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task SaveOrderAsync_CallsRepository_VerifiesInteraction()
    {
        // Arrange
        var order = new Order { Id = Guid.NewGuid() };

        // Act
        await _sut.SaveOrderAsync(order);

        // Assert
        await _repositorySubstitute.Received(1).SaveAsync(order, Arg.Any<CancellationToken>());
    }
}
```

**Why NSubstitute?**
- ✅ Fluent, readable syntax — substitutes ARE the interfaces, no `.Object` indirection
- ✅ Lower ceremony, less noise in tests
- ✅ `Arg.Any<T>()` is cleaner than `It.IsAny<T>()`
- ✅ `Received()` reads naturally as "verify it received this call"
- ✅ Faster to write and understand, even for complex scenarios

### 10.2 Parameterized Tests

```csharp
// ✅ GOOD - Theory with InlineData for multiple cases
[Theory]
[InlineData(CustomerTier.Bronze, 0.00)]
[InlineData(CustomerTier.Silver, 0.05)]
[InlineData(CustomerTier.Gold, 0.10)]
[InlineData(CustomerTier.Platinum, 0.20)]
public void GetDiscount_ReturnsCorrectRate(CustomerTier tier, decimal expected)
{
    var result = _sut.GetDiscount(tier);
    result.ShouldBe(expected);
}

// ✅ GOOD - MemberData for complex input objects
public static IEnumerable<object[]> InvalidOrders =>
[
    [new Order { Items = [] }, "Order must contain at least one item."],
    [new Order { Items = [item], TotalAmount = -1 }, "Order total must be greater than zero."],
];

[Theory]
[MemberData(nameof(InvalidOrders))]
public void PlaceOrder_WithInvalidOrder_ThrowsValidationException(Order order, string expectedError)
{
    var act = () => _sut.PlaceOrder(order, Guid.NewGuid());
    act.ShouldThrow<ValidationException>()
        .Errors.ShouldContain(expectedError);
}
```

### 10.3 Test Naming

```csharp
// ✅ GOOD - MethodName_StateUnderTest_ExpectedBehavior
public async Task GetOrderAsync_WhenOrderExists_ReturnsOrder() { }
public async Task GetOrderAsync_WhenOrderNotFound_ThrowsNotFoundException() { }
public void PlaceOrder_WithEmptyCart_ThrowsValidationException() { }
public void CalculateDiscount_ForPlatinumCustomer_Returns20Percent() { }
```

### 10.4 Avoid Logic in Tests

```csharp
// ✅ GOOD - Direct, no conditionals or loops
[Fact]
public void FormatName_ReturnsFullName()
{
    var user = new User { FirstName = "John", LastName = "Doe" };
    var result = _sut.FormatName(user);
    result.ShouldBe("John Doe");
}

// ❌ AVOID - Logic in tests (makes failures hard to diagnose)
[Fact]
public void FormatNames_ReturnsFullNames()
{
    var users = GetTestUsers();
    foreach (var user in users)
    {
        if (user.FirstName != null)
            _sut.FormatName(user).ShouldContain(user.FirstName);
    }
}
```

### 10.5 Integration Tests

```csharp
// ✅ GOOD - Use WebApplicationFactory for ASP.NET Core integration tests
public class OrdersApiTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public OrdersApiTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                // Replace real DB with in-memory for tests
                services.RemoveAll<DbContext>();
                services.AddDbContext<AppDbContext>(o => o.UseInMemoryDatabase("TestDb"));
            });
        }).CreateClient();
    }

    [Fact]
    public async Task GetOrder_ReturnsOk()
    {
        var response = await _client.GetAsync("/api/orders/123");
        response.StatusCode.ShouldBe(HttpStatusCode.OK);
    }
}
```

---

## Quick Reference

| Topic | Key Rule |
|-------|---------|
| Naming | PascalCase methods/properties, `_camelCase` fields, `I`-prefix interfaces, `Async` suffix |
| Nullability | Enable `<Nullable>enable</Nullable>`, use `?` explicitly, guard with `ArgumentNullException.ThrowIfNull` |
| Async | Always pass `CancellationToken`, avoid `async void`, prefer `Task.WhenAll` for parallel ops |
| LINQ | Materialize with `ToList()` once, use `Any()` not `Count() > 0` |
| Errors | Specific exception types, validate at entry, `Result<T>` for expected failures |
| Pattern matching | Switch expressions over switch statements, property patterns for readable conditionals |
| Organization | File-scoped namespaces, feature-based folders, one type per file |
| Immutability | Records for value objects/DTOs, `IReadOnlyList` for exposed collections |
| DI | Constructor injection, `readonly` fields, Options pattern for config |
| Testing | xUnit + Shouldly, `[Fact]`/`[Theory]`, Arrange-Act-Assert, no logic in tests |
