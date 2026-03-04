# 📚 DOCUMENTACIÓN SMART MENU

Bienvenido a la documentación del proyecto **NewSmartMenu**. Este repositorio contiene toda la información necesaria para entender, desarrollar e implementar un sistema de menú inteligente para restaurantes.

---

## 📖 Índice de Documentos

### 0. **Guía de Inicio**

#### [00 - Guía Rápida](./00-GUIA-RAPIDA.md)
Guía de inicio rápido para entender el proyecto y saber por dónde empezar según tu rol.

**Temas cubiertos:**
- Resumen del proyecto
- Índice de documentación
- Rutas de aprendizaje por rol
- Componentes principales
- Tecnologías clave
- Próximos pasos
- Checklist de inicio

---

### 1. **Documentación de Negocio**

#### [01 - Resumen Ejecutivo Smart Menu](./01-RESUMEN-EJECUTIVO-SMART-MENU.md)
Documento completo sobre qué es un Smart Menu, su propuesta de valor, beneficios, arquitectura del sistema, módulos funcionales y fases de implementación.

**Temas cubiertos:**
- ¿Qué es un Smart Menu?
- Propuesta de valor para clientes y restaurantes
- Flujo de negocio general
- Arquitectura del sistema
- Módulos funcionales
- Beneficios medibles
- Stack tecnológico recomendado
- Fases de implementación

---

#### [02 - Flujo Operativo del Restaurante](./02-FLUJO-OPERATIVO-RESTAURANTE.md)
Descripción detallada del flujo operativo completo desde todos los roles involucrados: host, meseros, cocina, bar, runners, cajero y gerente.

**Temas cubiertos:**
- Roles del sistema (7 roles principales)
- Flujo operativo detallado (7 fases)
- Sistema KDS (Kitchen Display System)
- Panel de control en tiempo real
- Notificaciones por rol
- Gestión de situaciones especiales
- Métricas clave (KPIs)
- Interfaces por rol

---

### 2. **Documentación Técnica**

#### [03 - Arquitectura Completa del Sistema](./03-ARQUITECTURA-COMPLETA-DEL-SISTEMA.md)
Arquitectura detallada en capas con todos los componentes necesarios para el desarrollo completo del sistema.

**Temas cubiertos:**
- Arquitectura general en 5 capas
- Capa de Presentación (4 aplicaciones)
- Capa de Aplicación/Negocio (10 microservicios)
- Capa de Datos (PostgreSQL, Redis, MongoDB)
- Capa de Infraestructura
- Componentes transversales
- Flujos operacionales completos (3 flujos principales)
- Correlaciones y dependencias entre servicios
- Stack tecnológico detallado

#### [04 - Resumen de Componentes y Correlaciones](./04-RESUMEN-COMPONENTES-Y-CORRELACIONES.md)
Resumen visual y organizado de todos los componentes del sistema y sus interrelaciones.

**Temas cubiertos:**
- Vista general de la arquitectura en 5 capas
- Resumen de las 4 aplicaciones frontend
- Mapa completo de los 10 microservicios
- Bases de datos y almacenamiento
- Infraestructura y deployment
- Correlaciones críticas entre servicios
- Sistema de eventos (Event-Driven)
- Seguridad y escalabilidad
- Métricas de rendimiento (SLAs)

#### [05 - Stack .NET 9 Detallado](./05-STACK-DOTNET-DETALLADO.md)
Guía completa de implementación con .NET 9, Entity Framework Core y SignalR.

**Temas cubiertos:**
- Stack tecnológico oficial (.NET 9, SQL Server, SignalR, EF Core)
- Clean Architecture con .NET
- Entity Framework Core - Configuración completa y queries avanzadas
- SignalR - Comunicación en tiempo real
- Program.cs - Configuración completa
- React + SignalR - Integración del cliente
- Ejemplos de código completos

#### [06 - User Journey Completo](./06-USER-JOURNEY-COMPLETO.md)
User journeys detallados paso a paso para todos los usuarios del sistema.

**Temas cubiertos:**
- Cliente - Escanea QR y hace pedido (completo)
- Cliente - Realiza pago (completo)
- Mesero - Atiende mesa
- Cocina - Prepara pedido
- Host - Asigna mesa
- Administrador - Gestiona menú
- Gerente - Revisa analytics
- Pantallas detalladas con wireframes ASCII
- Tiempos y métricas de cada paso

#### [07 - Estrategia de Unit Testing](./07-ESTRATEGIA-UNIT-TESTING.md)
Guía completa de testing con ejemplos para .NET y React.

**Temas cubiertos:**
- Filosofía de testing (TDD, AAA Pattern, FIRST)
- Estructura del proyecto de tests
- Backend .NET - xUnit, Moq, FluentAssertions
  - Entity Tests
  - Service Tests
  - Controller Tests
  - Validator Tests
- Frontend React - Vitest, Testing Library
  - Component Tests
  - Hook Tests
  - Redux Slice Tests
  - API Service Tests con MSW
- Integration Tests
- E2E Tests
- Coverage Goals (80-90%)
- CI/CD Integration

#### [08 - Sistema de Pagos y Facturación RD](./08-SISTEMA-PAGOS-Y-FACTURACION-RD.md)
Sistema completo de pagos y facturación electrónica para República Dominicana.

**Temas cubiertos:**
- Marco legal República Dominicana (DGII)
- Tipos de comprobantes e-CF (e31, e32, e34)
- NCF - Números de Comprobante Fiscal
- Cálculo de ITBIS (18%)
- Propina Legal 10% obligatoria (Ley 13-07)
- Retención ISR 10% sobre propinas
- RNC/Cédula - Validación
- Métodos de pago dominicanos
- División de cuentas
- Integración con portal DGII
- Factura de Crédito Fiscal vs Consumo
- Reportes fiscales 606, 607, 608
- Modelo de datos completo

- **[09 - Modelo de Base de Datos SQL Server](./02-Arquitectura/09-Modelo-Base-Datos-SQL-Server.md)** ✅
  - Scripts SQL completos
  - Índices y optimizaciones
  - Migrations con EF Core
  - Stored Procedures
  - Estado: **Completado**

- **[10 - API Documentation](./02-Arquitectura/10-API-Documentation.md)** ✅
  - Endpoints RESTful completos
  - Autenticación JWT
  - Ejemplos de requests/responses
  - SignalR Hubs y eventos
  - Estado: **Completado**

---

### 3. **Casos de Uso** ✅ **Completado**

- **[06 - Casos de Uso del Cliente](./03-Casos-de-Uso/06-Casos-de-Uso-Cliente.md)** ✅
  - Escanear QR y acceder al menú
  - Explorar y buscar platillos
  - Filtrar por preferencias dietéticas
  - Agregar al carrito
  - Realizar pedido
  - Ver estado de pedido
  - Pagar cuenta
  - Estado: **Completado**

- **[07 - Casos de Uso del Personal](./03-Casos-de-Uso/07-Casos-de-Uso-Personal.md)** ✅
  - Login del sistema
  - Asignación de mesas (Hostess)
  - Tomar órdenes (Mesero)
  - Preparación de pedidos (Chef/KDS)
  - Servir platillos (Mesero)
  - Procesar pagos (Cajero)
  - Estado: **Completado**

- **[08 - Casos de Uso del Administrador](./03-Casos-de-Uso/08-Casos-de-Uso-Administrador.md)** ✅
  - Login administrador
  - Gestión de menú completa
  - Gestión de categorías
  - Dashboard analytics
  - Gestión de usuarios
  - Configuración del restaurante
  - Reportes avanzados
  - Estado: **Completado**

---

### 4. **Guías de Desarrollo** ✅ **Completado**

- **[09 - Guía de Setup del Proyecto](./04-Guias-de-Desarrollo/09-Guia-Setup-Proyecto.md)** ✅
  - Requisitos previos (.NET, Node.js, SQL Server)
  - Instalación paso a paso
  - Configuración de base de datos
  - Variables de entorno
  - Ejecutar todos los servicios
  - Troubleshooting
  - Estado: **Completado**

- **[10 - Estándares de Código](./04-Guias-de-Desarrollo/10-Estandares-Codigo.md)** ✅
  - Principios SOLID y DRY
  - Convenciones de nombres (Backend y Frontend)
  - Estructura de archivos
  - Async/Await best practices
  - DTOs vs Entities
  - TypeScript types
  - Git workflow
  - Code review checklist
  - Estado: **Completado**

- **[11 - Testing](./04-Guias-de-Desarrollo/11-Testing.md)** ✅
  - Unit testing con xUnit
  - Integration testing
  - E2E testing con Playwright
  - Code coverage
  - Test data builders
  - CI/CD testing
  - Estado: **Completado**

---

### 5. **Manual de Usuario** ✅ **Completado**

- **[12 - Manual para Clientes](./05-Manual-de-Usuario/12-Manual-Clientes.md)** ✅
  - Cómo escanear QR
  - Explorar el menú
  - Buscar y filtrar platillos
  - Agregar al carrito
  - Confirmar orden
  - Seguir estado de pedido
  - Pagar cuenta
  - Preguntas frecuentes
  - Estado: **Completado**

- **[13 - Manual para Personal del Restaurante](./05-Manual-de-Usuario/13-Manual-Personal.md)** ✅
  - **Mesero:** Login, asignar mesas, tomar órdenes, servir platillos, procesar pagos
  - **Chef:** KDS, confirmar órdenes, gestionar preparación, marcar platillos listos
  - **Hostess:** Recibir clientes, asignar mesas, gestionar reservaciones
  - **Cajero:** Procesar pagos, métodos de pago, generar facturas, cierre de caja
  - Tips y troubleshooting
  - Estado: **Completado**

- **[14 - Manual para Administradores](./05-Manual-de-Usuario/14-Manual-Administradores.md)** ✅
  - Dashboard principal
  - Gestión de menú completa
  - Gestión de categorías
  - Gestión de usuarios y roles
  - Configuración del restaurante
  - Zonas y mesas
  - Reportes y analytics
  - Mantenimiento
  - Troubleshooting
  - Estado: **Completado**

---

## 🎯 ¿Cómo usar esta documentación?

### Para Stakeholders y Gerentes:
1. Lee primero el [Resumen Ejecutivo](./01-RESUMEN-EJECUTIVO-SMART-MENU.md)
2. Revisa el [Flujo Operativo](./02-FLUJO-OPERATIVO-RESTAURANTE.md) para entender las operaciones

### Para Desarrolladores:
1. Comienza con el Resumen Ejecutivo para contexto
2. Estudia la Arquitectura Técnica (próximamente)
3. Revisa el Modelo de Base de Datos (próximamente)
4. Consulta los Casos de Uso para implementación
5. Sigue la Guía de Setup para comenzar

### Para Personal del Restaurante:
1. Lee el Flujo Operativo para entender tu rol
2. Consulta el Manual de Usuario específico (próximamente)

---

## 📊 Estado del Proyecto

| Módulo | Estado | Progreso |
|--------|--------|----------|
| Documentación de Negocio | ✅ Completo | 100% |
| Documentación Técnica | ✅ Completo | 100% |
| User Journeys | ✅ Completo | 100% |
| Estrategia de Testing | ✅ Completo | 100% |
| Casos de Uso | ⏳ Pendiente | 0% |
| Guías de Desarrollo | ⏳ Pendiente | 0% |
| Manual de Usuario | ⏳ Pendiente | 0% |
| Desarrollo Frontend | ⏳ Pendiente | 0% |
| Desarrollo Backend | ⏳ Pendiente | 0% |
| Base de Datos | ⏳ Pendiente | 0% |

---

## 🚀 Próximos Pasos

1. **Fase de Diseño:**
   - Crear arquitectura técnica detallada
   - Diseñar modelo de base de datos
   - Definir API endpoints
   - Crear wireframes y mockups

2. **Fase de Desarrollo:**
   - Setup del proyecto (Frontend + Backend)
   - Implementación del MVP
   - Testing y QA
   - Deployment inicial

3. **Fase de Implementación:**
   - Piloto en restaurante real
   - Capacitación del personal
   - Ajustes y mejoras
   - Lanzamiento oficial

---

## 🤝 Contribuciones

Este proyecto está en desarrollo activo. Para contribuir:
1. Lee toda la documentación disponible
2. Sigue los estándares de código (próximamente)
3. Crea un branch para tu feature
4. Submit un Pull Request con descripción detallada

---

## 📞 Contacto

Para preguntas o sugerencias sobre la documentación:
- **Email:** smartmenu@example.com
- **Slack:** #smartmenu-team

---

## 📝 Notas de Versión

### v1.0 (6 de Febrero, 2026)
- ✅ Documentación inicial de negocio
- ✅ Flujo operativo completo
- ✅ Definición de roles y responsabilidades

---

**Última Actualización:** 6 de Febrero, 2026
**Mantenido por:** Smart Menu Team
