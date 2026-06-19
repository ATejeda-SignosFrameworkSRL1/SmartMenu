namespace SmartMenu.IntegrationTests.Fixtures;

/// <summary>
/// xUnit collection que serializa todos los tests integrationes contra UN SOLO container
/// SQL Server compartido. Sin esta colección, cada clase tendría su propio container ⇒
/// mucho más lento.
/// </summary>
[CollectionDefinition("Integration")]
public class IntegrationCollection : ICollectionFixture<SqlServerContainerFixture>
{
}
