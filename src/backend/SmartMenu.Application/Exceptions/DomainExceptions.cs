namespace SmartMenu.Application.Exceptions;

/// <summary>
/// Excepciones tipadas de dominio. El <see cref="SmartMenu.API.Middleware.ExceptionHandlingMiddleware"/>
/// (en la capa API) las mapea a los códigos HTTP apropiados, evitando que cada controller/servicio
/// tenga que envolver lógica en try/catch genéricos.
/// </summary>
public abstract class DomainException : Exception
{
    protected DomainException(string message) : base(message) { }
    protected DomainException(string message, Exception inner) : base(message, inner) { }
}

/// <summary>Recurso solicitado no existe. Mapea a HTTP 404.</summary>
public class NotFoundException : DomainException
{
    public NotFoundException(string message) : base(message) { }
    public static NotFoundException For<T>(object id) => new($"{typeof(T).Name} {id} no encontrado.");
}

/// <summary>Input inválido o regla de negocio violada. Mapea a HTTP 400.</summary>
public class ValidationException : DomainException
{
    public IReadOnlyDictionary<string, string[]>? Errors { get; }

    public ValidationException(string message) : base(message)
    {
        Errors = null;
    }

    public ValidationException(string message, IReadOnlyDictionary<string, string[]> errors) : base(message)
    {
        Errors = errors;
    }
}

/// <summary>Operación en conflicto con el estado actual (ej. estado de orden inválido, duplicado, concurrency). Mapea a HTTP 409.</summary>
public class ConflictException : DomainException
{
    public ConflictException(string message) : base(message) { }
}

/// <summary>Acción no permitida para el rol/usuario. Mapea a HTTP 403.</summary>
public class ForbiddenException : DomainException
{
    public ForbiddenException(string message = "Acción no autorizada.") : base(message) { }
}
