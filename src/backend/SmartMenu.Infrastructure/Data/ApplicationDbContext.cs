using Microsoft.EntityFrameworkCore;
using SmartMenu.Domain.Entities;
using SmartMenu.Domain.Enums;

namespace SmartMenu.Infrastructure.Data;

public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options)
    {
    }

    // DbSets
    public DbSet<User> Users => Set<User>();
    public DbSet<Restaurant> Restaurants => Set<Restaurant>();
    public DbSet<Table> Tables => Set<Table>();
    public DbSet<Zone> Zones => Set<Zone>();
    public DbSet<Menu> Menus => Set<Menu>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Dish> Dishes => Set<Dish>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<OrderItem> OrderItems => Set<OrderItem>();
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<Invoice> Invoices => Set<Invoice>();
    public DbSet<TableSession> TableSessions => Set<TableSession>();
    public DbSet<TableReservation> TableReservations => Set<TableReservation>();
    public DbSet<VirtualTable> VirtualTables => Set<VirtualTable>();
    public DbSet<VirtualTableTable> VirtualTableTables => Set<VirtualTableTable>();
    public DbSet<TableTransferRequest> TableTransferRequests => Set<TableTransferRequest>();
    public DbSet<DishTag> DishTags => Set<DishTag>();
    public DbSet<DishDishTag> DishDishTags => Set<DishDishTag>();
    public DbSet<DishImage> DishImages => Set<DishImage>();
    public DbSet<WaiterShift> WaiterShifts => Set<WaiterShift>();
    public DbSet<ReservationPreOrder> ReservationPreOrders => Set<ReservationPreOrder>();
    public DbSet<PreOrderItem> PreOrderItems => Set<PreOrderItem>();
    public DbSet<TableClaimRequest> TableClaimRequests => Set<TableClaimRequest>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<LoginAttempt> LoginAttempts => Set<LoginAttempt>();
    public DbSet<AuditEvent> AuditEvents => Set<AuditEvent>();
    public DbSet<ServicePeriod> ServicePeriods => Set<ServicePeriod>();
    public DbSet<ReservationTable> ReservationTables => Set<ReservationTable>();
    public DbSet<FloorStructure> FloorStructures => Set<FloorStructure>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Configuración global de precisión decimal
        foreach (var property in modelBuilder.Model.GetEntityTypes()
            .SelectMany(t => t.GetProperties())
            .Where(p => p.ClrType == typeof(decimal) || p.ClrType == typeof(decimal?)))
        {
            property.SetColumnType("decimal(18,2)");
        }

        // Índices únicos
        modelBuilder.Entity<User>()
            .HasIndex(u => u.Email)
            .IsUnique();

        modelBuilder.Entity<Table>()
            .HasIndex(t => new { t.RestaurantId, t.TableNumber })
            .IsUnique();

        modelBuilder.Entity<Order>()
            .HasIndex(o => o.OrderNumber)
            .IsUnique();

        // Relaciones
        modelBuilder.Entity<Table>()
            .HasOne(t => t.Zone)
            .WithMany(z => z.Tables)
            .HasForeignKey(t => t.ZoneId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Order>()
            .HasOne(o => o.Table)
            .WithMany(t => t.Orders)
            .HasForeignKey(o => o.TableId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Order>()
            .HasOne(o => o.Customer)
            .WithMany(u => u.Orders)
            .HasForeignKey(o => o.CustomerId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<Order>()
            .HasOne(o => o.TableSession)
            .WithMany(ts => ts.Orders)
            .HasForeignKey(o => o.TableSessionId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<Order>()
            .HasOne(o => o.AssignedWaiter)
            .WithMany()
            .HasForeignKey(o => o.AssignedWaiterId)
            .OnDelete(DeleteBehavior.NoAction);

        // ─── Factura global multi-franquicia (agregador delivery/pickup online) ───
        // Restrict: una Invoice/Order histórica-fiscal nunca se borra en cascada.
        modelBuilder.Entity<Order>()
            .HasOne(o => o.Invoice)
            .WithMany(inv => inv.Orders)
            .HasForeignKey(o => o.InvoiceId)
            .OnDelete(DeleteBehavior.Restrict);

        // Franquicia dueña de la orden. NoAction: sin cascada (evita ciclos/borrados masivos).
        modelBuilder.Entity<Order>()
            .HasOne(o => o.Restaurant)
            .WithMany()
            .HasForeignKey(o => o.RestaurantId)
            .OnDelete(DeleteBehavior.NoAction);

        modelBuilder.Entity<Invoice>()
            .HasOne(inv => inv.Customer)
            .WithMany()
            .HasForeignKey(inv => inv.CustomerId)
            .OnDelete(DeleteBehavior.SetNull);

        // Restrict en lugar de Cascade: una Order nunca debería ser borrada en SQL
        // (los datos fiscales/históricos deben sobrevivir). Si alguien intenta DELETE en
        // una Order con items, la DB lo rechaza en vez de borrar silenciosamente todo.
        modelBuilder.Entity<OrderItem>()
            .HasOne(oi => oi.Order)
            .WithMany(o => o.Items)
            .HasForeignKey(oi => oi.OrderId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<OrderItem>()
            .HasOne(oi => oi.Dish)
            .WithMany(d => d.OrderItems)
            .HasForeignKey(oi => oi.DishId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<TableSession>()
            .HasOne(ts => ts.Table)
            .WithMany()
            .HasForeignKey(ts => ts.TableId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<TableSession>()
            .HasOne(ts => ts.AssignedWaiter)
            .WithMany()
            .HasForeignKey(ts => ts.AssignedWaiterId)
            .OnDelete(DeleteBehavior.NoAction);

        modelBuilder.Entity<TableSession>()
            .HasOne(ts => ts.AssignedByHost)
            .WithMany()
            .HasForeignKey(ts => ts.AssignedByHostId)
            .OnDelete(DeleteBehavior.NoAction);

        modelBuilder.Entity<TableReservation>()
            .HasOne(tr => tr.Table)
            .WithMany()
            .HasForeignKey(tr => tr.TableId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<TableReservation>()
            .HasOne(tr => tr.RequestedZone)
            .WithMany()
            .HasForeignKey(tr => tr.RequestedZoneId)
            .OnDelete(DeleteBehavior.NoAction);

        modelBuilder.Entity<TableReservation>()
            .HasOne(tr => tr.CreatedByHost)
            .WithMany()
            .HasForeignKey(tr => tr.CreatedByHostId)
            .OnDelete(DeleteBehavior.NoAction);

        // ─── Reservas: capacidad dinámica por intervalo ───
        modelBuilder.Entity<TableReservation>()
            .HasOne(tr => tr.TableSession)
            .WithMany()
            .HasForeignKey(tr => tr.TableSessionId)
            .OnDelete(DeleteBehavior.SetNull);
        modelBuilder.Entity<TableReservation>()
            .HasOne(tr => tr.ServicePeriod)
            .WithMany()
            .HasForeignKey(tr => tr.ServicePeriodId)
            .OnDelete(DeleteBehavior.NoAction);
        // Solape de ventana (sargable sobre EndDateTime persistido) + pacing + lookup por código.
        modelBuilder.Entity<TableReservation>()
            .HasIndex(tr => new { tr.Status, tr.ReservationDateTime, tr.EndDateTime });
        modelBuilder.Entity<TableReservation>()
            .HasIndex(tr => new { tr.ServicePeriodId, tr.ReservationDateTime });
        modelBuilder.Entity<TableReservation>()
            .HasIndex(tr => tr.ConfirmationCode);

        modelBuilder.Entity<ServicePeriod>()
            .HasOne(sp => sp.Restaurant)
            .WithMany()
            .HasForeignKey(sp => sp.RestaurantId)
            .OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<ServicePeriod>()
            .HasIndex(sp => new { sp.RestaurantId, sp.IsActive });

        modelBuilder.Entity<ReservationTable>()
            .HasKey(rt => new { rt.ReservationId, rt.TableId });
        modelBuilder.Entity<ReservationTable>()
            .HasOne(rt => rt.Reservation)
            .WithMany(r => r.AssignedTables)
            .HasForeignKey(rt => rt.ReservationId)
            .OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<ReservationTable>()
            .HasOne(rt => rt.Table)
            .WithMany()
            .HasForeignKey(rt => rt.TableId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<VirtualTable>()
            .HasOne(v => v.CreatedByWaiter)
            .WithMany()
            .HasForeignKey(v => v.CreatedByWaiterId)
            .OnDelete(DeleteBehavior.NoAction);

        modelBuilder.Entity<VirtualTableTable>()
            .HasKey(vtt => new { vtt.VirtualTableId, vtt.TableId });
        modelBuilder.Entity<VirtualTableTable>()
            .HasOne(vtt => vtt.VirtualTable)
            .WithMany(v => v.Tables)
            .HasForeignKey(vtt => vtt.VirtualTableId)
            .OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<VirtualTableTable>()
            .HasOne(vtt => vtt.Table)
            .WithMany()
            .HasForeignKey(vtt => vtt.TableId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<TableTransferRequest>()
            .HasOne(t => t.FromWaiter)
            .WithMany()
            .HasForeignKey(t => t.FromWaiterId)
            .OnDelete(DeleteBehavior.NoAction);
        modelBuilder.Entity<TableTransferRequest>()
            .HasOne(t => t.ToWaiter)
            .WithMany()
            .HasForeignKey(t => t.ToWaiterId)
            .OnDelete(DeleteBehavior.NoAction);

        modelBuilder.Entity<DishDishTag>()
            .HasKey(ddt => new { ddt.DishId, ddt.DishTagId });
        modelBuilder.Entity<DishDishTag>()
            .HasOne(ddt => ddt.Dish)
            .WithMany(d => d.DishTags)
            .HasForeignKey(ddt => ddt.DishId)
            .OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<DishDishTag>()
            .HasOne(ddt => ddt.DishTag)
            .WithMany()
            .HasForeignKey(ddt => ddt.DishTagId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Payment>()
            .HasOne(p => p.ProcessedByWaiter)
            .WithMany()
            .HasForeignKey(p => p.ProcessedByWaiterId)
            .OnDelete(DeleteBehavior.NoAction);

        // Soft delete global filter: queries de Dish excluyen los marcados como IsDeleted.
        // Para incluirlos (ej. reportes históricos / admin "ver eliminados") usar `.IgnoreQueryFilters()`.
        modelBuilder.Entity<Dish>().HasQueryFilter(d => !d.IsDeleted);

        // Índices para mejorar queries comunes (active orders, reports, dashboards)
        modelBuilder.Entity<Order>().HasIndex(o => o.Status);
        modelBuilder.Entity<Order>().HasIndex(o => o.CreatedAt);
        modelBuilder.Entity<Order>().HasIndex(o => o.AssignedWaiterId);
        modelBuilder.Entity<Order>().HasIndex(o => o.TableId);
        modelBuilder.Entity<Payment>().HasIndex(p => p.OrderId);
        modelBuilder.Entity<Payment>().HasIndex(p => p.Status);
        modelBuilder.Entity<Order>().HasIndex(o => o.InvoiceId);
        modelBuilder.Entity<Order>().HasIndex(o => o.RestaurantId);
        modelBuilder.Entity<Invoice>().HasIndex(inv => inv.DeliveryStatus);
        modelBuilder.Entity<Invoice>().HasIndex(inv => inv.CreatedAt);
        modelBuilder.Entity<Dish>().HasIndex(d => new { d.CategoryId, d.IsAvailable });
        modelBuilder.Entity<Dish>().HasIndex(d => d.IsDeleted);
        modelBuilder.Entity<TableSession>().HasIndex(ts => new { ts.TableId, ts.IsActive });

        // Refresh tokens — TokenHash indexado para lookup rápido, User cascade
        modelBuilder.Entity<RefreshToken>(b =>
        {
            b.Property(rt => rt.TokenHash).HasMaxLength(128).IsRequired();
            b.Property(rt => rt.ReplacedByTokenHash).HasMaxLength(128);
            b.Property(rt => rt.CreatedByIp).HasMaxLength(64);
            b.HasIndex(rt => rt.TokenHash).IsUnique();
            b.HasIndex(rt => rt.UserId);
            b.HasOne(rt => rt.User)
             .WithMany()
             .HasForeignKey(rt => rt.UserId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        // S4.3 — LoginAttempt para account lockout. Email + AttemptedAt indexados para
        // contar fallos en ventana de 15 min eficientemente.
        modelBuilder.Entity<LoginAttempt>(b =>
        {
            b.Property(la => la.Email).HasMaxLength(256).IsRequired();
            b.Property(la => la.IpAddress).HasMaxLength(64);
            b.HasIndex(la => new { la.Email, la.AttemptedAt });
        });
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        // Actualizar UpdatedAt automáticamente
        var entries = ChangeTracker.Entries()
            .Where(e => e.Entity is BaseEntity && 
                        (e.State == EntityState.Added || e.State == EntityState.Modified));

        foreach (var entry in entries)
        {
            ((BaseEntity)entry.Entity).UpdatedAt = DateTime.UtcNow;

            if (entry.State == EntityState.Added)
            {
                ((BaseEntity)entry.Entity).CreatedAt = DateTime.UtcNow;
            }
        }

        return base.SaveChangesAsync(cancellationToken);
    }
}
