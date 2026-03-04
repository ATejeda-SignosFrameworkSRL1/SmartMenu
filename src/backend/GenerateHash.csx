#!/usr/bin/env dotnet-script
#r "nuget: BCrypt.Net-Next, 4.0.3"

using BCrypt.Net;

// Generar hash para password "123456"
var password = "123456";
var hash = BCrypt.HashPassword(password, 11);

Console.WriteLine($"Password: {password}");
Console.WriteLine($"Hash: {hash}");
Console.WriteLine();

// Verificar que funciona
var isValid = BCrypt.Verify(password, hash);
Console.WriteLine($"Verification: {isValid}");
