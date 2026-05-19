using System.ComponentModel.DataAnnotations;

namespace SmartMenu.Application.DTOs;

/// <summary>
/// Envelope estándar para endpoints paginados.
/// El cliente recibe { items, page, pageSize, total, totalPages }.
/// </summary>
public class PagedResult<T>
{
    public IReadOnlyList<T> Items { get; init; } = Array.Empty<T>();
    public int Page { get; init; }
    public int PageSize { get; init; }
    public int Total { get; init; }
    public int TotalPages => PageSize > 0 ? (int)Math.Ceiling(Total / (double)PageSize) : 0;
    public bool HasNextPage => Page < TotalPages;
    public bool HasPreviousPage => Page > 1;

    public static PagedResult<T> Empty(int page, int pageSize) =>
        new() { Items = Array.Empty<T>(), Page = page, PageSize = pageSize, Total = 0 };
}

/// <summary>
/// Query string standard para endpoints paginados: <c>?page=1&pageSize=50</c>.
/// Capped a 200 para evitar DoS, default 50.
/// </summary>
public record PagedQuery
{
    [Range(1, int.MaxValue)]
    public int Page { get; init; } = 1;

    [Range(1, 200)]
    public int PageSize { get; init; } = 50;

    public int Skip => (Page - 1) * PageSize;
}
