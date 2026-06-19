#!/bin/bash
# SQL Server QA entrypoint:
# 1. Arranca sqlservr en background
# 2. Espera a que SQL esté listo
# 3. Corre init.sql para crear DbNewMenu + DbNewMenuAudit
# 4. Bloquea con `wait`

set -e

# Iniciar SQL Server en background
/opt/mssql/bin/sqlservr &
SQL_PID=$!

# Esperar a que SQL acepte conexiones (max 60s)
echo "[qa-init] esperando a que SQL Server arranque..."
for i in $(seq 1 60); do
    if /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "$SA_PASSWORD" -C -Q "SELECT 1" >/dev/null 2>&1; then
        echo "[qa-init] SQL listo después de ${i}s"
        break
    fi
    if [ "$i" -eq 60 ]; then
        echo "[qa-init] timeout esperando SQL Server"
        exit 1
    fi
    sleep 1
done

# Ejecutar init.sql
echo "[qa-init] aplicando init.sql..."
/opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "$SA_PASSWORD" -C -i /docker-init/init.sql
echo "[qa-init] init.sql OK"

# Bloquear con el proceso de SQL Server
wait $SQL_PID
