namespace SmartMenu.Application.Exceptions;

public abstract class DomainException : Exception
{
    protected DomainException(string message) : base(message) { }
    protected DomainException(string message, Exception inner) : base(message, inner) { }
}

public class NotFoundException : DomainException
{
    public NotFoundException(string message) : base(message) { }
    public static NotFoundException For<T>(object id) => new($"{typeof(T).Name} {id} no encontrado.");
}

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

public class ConflictException : DomainException
{
    public ConflictException(string message) : base(message) { }
}

public class ForbiddenException : DomainException
{
    public ForbiddenException(string message = "Acción no autorizada.") : base(message) { }
}
