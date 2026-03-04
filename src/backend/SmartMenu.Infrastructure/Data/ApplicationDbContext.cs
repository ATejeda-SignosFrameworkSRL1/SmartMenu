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
    public DbSet<TableSession> TableSessions => Set<TableSession>();
    public DbSet<TableReservation> TableReservations => Set<TableReservation>();
    public DbSet<VirtualTable> VirtualTables => Set<VirtualTable>();
    public DbSet<VirtualTableTable> VirtualTableTables => Set<VirtualTableTable>();
    public DbSet<TableTransferRequest> TableTransferRequests => Set<TableTransferRequest>();
    public DbSet<DishTag> DishTags => Set<DishTag>();
    public DbSet<DishDishTag> DishDishTags => Set<DishDishTag>();

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

        modelBuilder.Entity<OrderItem>()
            .HasOne(oi => oi.Order)
            .WithMany(o => o.Items)
            .HasForeignKey(oi => oi.OrderId)
            .OnDelete(DeleteBehavior.Cascade);

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
            .HasOne(tr => tr.CreatedByHost)
            .WithMany()
            .HasForeignKey(tr => tr.CreatedByHostId)
            .OnDelete(DeleteBehavior.NoAction);

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
