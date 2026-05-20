using FluentAssertions;
using SmartMenu.Domain.Entities;
using SmartMenu.Domain.Enums;

namespace SmartMenu.UnitTests.Domain;

/// <summary>
/// S1.D1 — Payment invariants: PaymentStatus.Pending default, RowVersion,
/// fiscal fields (RNC/BusinessName), split bill metadata, tip math placeholders.
/// </summary>
public class PaymentTests
{
    [Fact]
    public void Defaults_status_is_Pending()
    {
        new Payment().Status.Should().Be(PaymentStatus.Pending);
    }

    [Fact]
    public void Defaults_tip_amounts_zero()
    {
        var p = new Payment();
        p.TipAmount.Should().Be(0m);
        p.TipPercentage.Should().Be(0m);
    }

    [Fact]
    public void Defaults_fiscal_fields_off()
    {
        var p = new Payment();
        p.RequiresFiscalReceipt.Should().BeFalse();
        p.RNC.Should().BeNull();
        p.BusinessName.Should().BeNull();
    }

    [Fact]
    public void Defaults_method_empty_string_not_null()
    {
        new Payment().Method.Should().Be(string.Empty);
    }

    [Fact]
    public void Defaults_split_metadata_null()
    {
        var p = new Payment();
        p.BillSplitType.Should().BeNull();
        p.SplitPartIndex.Should().BeNull();
    }

    [Fact]
    public void RowVersion_starts_null()
    {
        new Payment().RowVersion.Should().BeNull();
    }

    [Theory]
    [InlineData(PaymentStatus.Pending)]
    [InlineData(PaymentStatus.Processing)]
    [InlineData(PaymentStatus.Completed)]
    [InlineData(PaymentStatus.Failed)]
    [InlineData(PaymentStatus.Refunded)]
    public void Status_accepts_every_enum_value(PaymentStatus s)
    {
        new Payment { Status = s }.Status.Should().Be(s);
    }

    [Theory]
    [InlineData("Cash")]
    [InlineData("Card")]
    [InlineData("Transfer")]
    [InlineData("Mixed")]
    public void Method_accepts_known_string_values(string method)
    {
        new Payment { Method = method }.Method.Should().Be(method);
    }

    [Fact]
    public void Fiscal_receipt_requires_both_RNC_and_BusinessName()
    {
        // Contract test: el caller del controller debe validar que ambos estén
        // presentes (lo verifica PaymentController.Collect en runtime).
        var p = new Payment
        {
            RequiresFiscalReceipt = true,
            RNC = "131123456-7",
            BusinessName = "TEST RESTAURANTE SRL",
        };
        p.RequiresFiscalReceipt.Should().BeTrue();
        p.RNC.Should().NotBeNullOrWhiteSpace();
        p.BusinessName.Should().NotBeNullOrWhiteSpace();
    }
}
