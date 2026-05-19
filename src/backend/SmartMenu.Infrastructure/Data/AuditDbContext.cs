using Microsoft.EntityFrameworkCore;
using SmartMenu.Domain.Entities;

namespace SmartMenu.Infrastructure.Data;

/// <summary>
/// S4.1 — DbContext separado para auditoría. Tabla AuditLogs vive en DbNewMenuAudit.
/// Solo escritura (append-only); no se borra ni actualiza nunca.
/// </summary>
public class AuditDbContext : DbContext
{
    public AuditDbContext(DbContextOptions<AuditDbContext> options) : base(options) { }

    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<AuditLog>(b =>
        {
            b.Property(a => a.EntityName).HasMaxLength(128).IsRequired();
            b.Property(a => a.EntityId).HasMaxLength(64).IsRequired();
            b.Property(a => a.Action).HasMaxLength(32).IsRequired();
            b.Property(a => a.UserEmail).HasMaxLength(256);
            b.Property(a => a.Endpoint).HasMaxLength(512);
            b.Property(a => a.IpAddress).HasMaxLength(64);
            b.HasIndex(a => new { a.EntityName, a.EntityId });
            b.HasIndex(a => a.Timestamp);
            b.HasIndex(a => a.UserId);
        });
    }
}
