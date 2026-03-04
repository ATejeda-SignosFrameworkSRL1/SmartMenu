# 💳 SISTEMA DE PAGOS Y FACTURACIÓN - REPÚBLICA DOMINICANA

## **Sistema e-CF (Comprobante Fiscal Electrónico) - DGII**

---

## **📋 ÍNDICE**

1. [Marco Legal RD](#marco-legal-república-dominicana)
2. [Tipos de Comprobantes e-CF](#tipos-de-comprobantes-e-cf)
3. [NCF - Números de Comprobante Fiscal](#ncf---números-de-comprobante-fiscal)
4. [Cálculo de ITBIS](#cálculo-de-itbis)
5. [Propina Legal 10%](#propina-legal-10)
6. [Métodos de Pago](#métodos-de-pago)
7. [División de Cuentas](#división-de-cuentas)
8. [Facturación Electrónica DGII](#facturación-electrónica-dgii)
9. [Integración con Stripe](#integración-con-stripe)
10. [Modelo de Datos](#modelo-de-datos)
11. [Reportes Fiscales 606/607/608](#reportes-fiscales-606607608)

---

## **🇩🇴 MARCO LEGAL REPÚBLICA DOMINICANA**

### **Autoridad Fiscal**
- **DGII:** Dirección General de Impuestos Internos
- **Portal:** dgii.gov.do
- **Facturación Electrónica:** efactura.dgii.gov.do

### **Leyes Aplicables**

| Ley/Norma | Descripción | Aplicación |
|-----------|-------------|------------|
| **Ley 11-92** | Código Tributario | Base del sistema tributario dominicano |
| **Ley 13-07** | Ley de Propina | 10% obligatorio en restaurantes |
| **Ley 495-06** | Rectificación Ley 13-07 | Ajustes a propina legal |
| **Norma 01-19** | Facturación Electrónica | e-CF y comprobantes digitales |
| **Norma 02-05** | Comprobantes Fiscales | Tipos y uso de NCF |
| **Norma 05-19** | Autorización NCF | Secuencias de comprobantes |

### **Impuestos**

```csharp
public static class DominicanTaxRates
{
    // ITBIS (Impuesto sobre Transferencias de Bienes Industrializados y Servicios)
    public const decimal ITBIS_TASA_GENERAL = 0.18m;      // 18% - Tasa general
    public const decimal ITBIS_TASA_REDUCIDA = 0.16m;     // 16% - Casos especiales
    public const decimal ITBIS_EXENTO = 0.00m;            // 0% - Productos exentos
    
    // Propina Legal (Ley 13-07)
    public const decimal PROPINA_LEGAL = 0.10m;           // 10% obligatoria
    
    // ISR sobre propinas
    public const decimal ISR_PROPINA_EMPLEADO = 0.10m;    // 10% retención sobre propinas
    
    // Productos con impuestos selectivos
    public const decimal IMPUESTO_ALCOHOL = 0.10m;        // 10% adicional (ejemplo)
    public const decimal IMPUESTO_TABACO = 0.20m;         // 20% adicional
}
```

### **RNC - Registro Nacional de Contribuyentes**

```csharp
public class RNCValidator
{
    // RNC: 9 dígitos (Personas Jurídicas)
    // Cédula: 11 dígitos con guiones (001-1234567-8)
    
    public static bool ValidateRNC(string rnc)
    {
        if (string.IsNullOrWhiteSpace(rnc))
            return false;
            
        // Limpiar guiones y espacios
        var cleanRnc = rnc.Replace("-", "").Replace(" ", "");
        
        // Validar longitud (9 dígitos para RNC, 11 para cédula)
        if (cleanRnc.Length != 9 && cleanRnc.Length != 11)
            return false;
            
        // Validar que sean solo números
        return cleanRnc.All(char.IsDigit);
    }
    
    public static string FormatRNC(string rnc)
    {
        var cleanRnc = rnc.Replace("-", "").Replace(" ", "");
        
        if (cleanRnc.Length == 9)
            return cleanRnc; // RNC: sin formato
        
        if (cleanRnc.Length == 11)
            // Cédula: 001-1234567-8
            return $"{cleanRnc.Substring(0, 3)}-{cleanRnc.Substring(3, 7)}-{cleanRnc.Substring(10, 1)}";
        
        return rnc;
    }
}
```

---

## **📄 TIPOS DE COMPROBANTES (e-CF)**

### **1. Factura de Consumo Electrónica (e32)**

**Uso:** Ventas a consumidores finales
**Serie NCF:** E320000000001
**Características:**
- ✅ Para público general (sin RNC o con RNC sin crédito fiscal)
- ✅ No genera crédito fiscal para el comprador
- ✅ Incluye ITBIS y propina legal
- ✅ Puede incluir RNC del cliente (opcional)

```csharp
public class FacturaConsumo
{
    public int Id { get; set; }
    public string NCF { get; set; }                       // E320000000001
    public DateTime FechaEmision { get; set; }
    
    // Datos del emisor (Restaurante)
    public string EmisorRNC { get; set; }                 // 9 dígitos
    public string EmisorNombreComercial { get; set; }
    public string EmisorDireccion { get; set; }
    
    // Datos del comprador (Opcional)
    public string CompradorRNC { get; set; }              // Opcional
    public string CompradorNombre { get; set; }
    
    // Detalle
    public List<FacturaItem> Items { get; set; }
    
    // Montos
    public decimal MontoGravado { get; set; }             // Base para ITBIS
    public decimal ITBIS { get; set; }                    // 18% del monto gravado
    public decimal MontoExento { get; set; }              // Productos sin ITBIS
    public decimal PropinaLegal { get; set; }             // 10% obligatorio
    public decimal PropinaAdicional { get; set; }         // Propina voluntaria
    public decimal MontoTotal { get; set; }
    
    // Forma de pago
    public string FormaPago { get; set; }                 // 01=Efectivo, 02=Cheque, 03=Tarjeta, etc.
    
    // URLs
    public string UrlPDF { get; set; }
    public string UrlXML { get; set; }
    
    // Estado
    public EstadoComprobante Estado { get; set; }
}
```

**Ejemplo Visual:**

```
═══════════════════════════════════════════════
      🍽️ RESTAURANTE EL BUEN SABOR
═══════════════════════════════════════════════
RNC: 131-123456-7
Av. 27 de Febrero No. 123, Santo Domingo, DN
Tel: (809) 555-1234

FACTURA DE CONSUMO ELECTRÓNICA
NCF: E320000000123
Fecha: 06/02/2026 19:51:35

Mesa: 12 - Terraza
Mesero: Carlos Ruiz
───────────────────────────────────────────────

DETALLE DEL CONSUMO

1x Churrasco Premium                    $950.00
   (Término medio, sin cebolla)

1x Ensalada César                       $350.00

1x Pasta Alfredo                        $450.00

2x Limonada Natural                     $200.00

1x Cerveza Presidente                   $150.00

───────────────────────────────────────────────
Subtotal:                            $2,100.00
ITBIS (18%):                           $378.00
───────────────────────────────────────────────
Subtotal + ITBIS:                    $2,478.00

Propina Legal (10%):                   $247.80
Propina Adicional:                       $0.00
───────────────────────────────────────────────
TOTAL A PAGAR:                       $2,725.80
═══════════════════════════════════════════════

Forma de Pago: Tarjeta ****1234
Autorización: 123456

───────────────────────────────────────────────
¡Gracias por su visita!
Califícanos en: smartmenu.app/review

Comprobante Válido como Factura
═══════════════════════════════════════════════
```

---

### **2. Factura de Crédito Fiscal Electrónica (e31)**

**Uso:** Ventas a empresas (con RNC)
**Serie NCF:** E310000000001
**Características:**
- ✅ Genera crédito fiscal para el comprador
- ✅ **RNC del comprador es OBLIGATORIO**
- ✅ Debe incluir todos los datos fiscales
- ✅ Válida para deducción de impuestos

```csharp
public class FacturaCreditoFiscal
{
    public int Id { get; set; }
    public string NCF { get; set; }                       // E310000000001
    public DateTime FechaEmision { get; set; }
    
    // Datos del emisor (Restaurante)
    public string EmisorRNC { get; set; }
    public string EmisorRazonSocial { get; set; }
    public string EmisorNombreComercial { get; set; }
    public string EmisorDireccion { get; set; }
    public string EmisorTelefono { get; set; }
    public string EmisorEmail { get; set; }
    
    // Datos del comprador (OBLIGATORIOS)
    public string CompradorRNC { get; set; }              // REQUERIDO
    public string CompradorRazonSocial { get; set; }      // REQUERIDO
    public string CompradorDireccion { get; set; }
    public string CompradorTelefono { get; set; }
    public string CompradorEmail { get; set; }
    
    // Detalle de items
    public List<FacturaItem> Items { get; set; }
    
    // Montos
    public decimal MontoGravadoI1 { get; set; }           // Gravado ITBIS 18%
    public decimal ITBISI1 { get; set; }
    public decimal MontoGravadoI2 { get; set; }           // Gravado ITBIS 16%
    public decimal ITBISI2 { get; set; }
    public decimal MontoExento { get; set; }
    public decimal PropinaLegal { get; set; }
    public decimal MontoTotal { get; set; }
    
    // Forma de pago
    public FormaPago FormaPago { get; set; }
    public CondicionPago CondicionPago { get; set; }      // Contado / Crédito
    public DateTime? FechaVencimiento { get; set; }       // Si es a crédito
    
    // Archivos generados
    public string UrlPDF { get; set; }
    public string UrlXML { get; set; }
    public string CodigoQR { get; set; }                  // QR para validación
    
    // Estado
    public EstadoComprobante Estado { get; set; }
    public DateTime? FechaAnulacion { get; set; }
}

public class FacturaItem
{
    public int Id { get; set; }
    public int Cantidad { get; set; }
    public string Descripcion { get; set; }
    public decimal PrecioUnitario { get; set; }
    public decimal Descuento { get; set; }
    public decimal MontoItem { get; set; }
    public TipoImpuesto TipoImpuesto { get; set; }        // ITBIS 18%, 16%, Exento
    public decimal MontoITBIS { get; set; }
}

public enum TipoImpuesto
{
    ITBIS18,            // 18% - Tasa general
    ITBIS16,            // 16% - Tasa reducida
    Exento,             // 0% - Sin ITBIS
    NoSujeto            // No sujeto a ITBIS
}

public enum FormaPago
{
    Efectivo = 1,
    ChequeBancario = 2,
    TarjetaCreditoDebito = 3,
    TransferenciaBancaria = 4,
    Otro = 5
}

public enum CondicionPago
{
    Contado = 1,
    Credito = 2
}

public enum EstadoComprobante
{
    Valido,
    Anulado,
    Enviado,
    Rechazado
}
```

---

### **3. Nota de Crédito Electrónica (e04)**

**Uso:** Devoluciones, descuentos, anulaciones
**Serie NCF:** E040000000001
**Características:**
- ✅ Asociada a una factura original
- ✅ Reduce el monto de ventas
- ✅ Debe indicar el NCF de la factura afectada

```csharp
public class NotaCredito
{
    public int Id { get; set; }
    public string NCF { get; set; }                       // E040000000001
    public DateTime FechaEmision { get; set; }
    
    // Referencia a factura original
    public string NCFFacturaAfectada { get; set; }        // NCF que se está modificando
    public DateTime FechaFacturaAfectada { get; set; }
    public string TipoFacturaAfectada { get; set; }       // 31 o 32
    
    // Motivo
    public MotivoNotaCredito Motivo { get; set; }
    public string DescripcionMotivo { get; set; }
    
    // Datos fiscales (igual que factura)
    public string EmisorRNC { get; set; }
    public string CompradorRNC { get; set; }
    
    // Montos (siempre negativos o cero)
    public decimal MontoGravado { get; set; }
    public decimal ITBIS { get; set; }
    public decimal MontoTotal { get; set; }
    
    // Archivos
    public string UrlPDF { get; set; }
    public string UrlXML { get; set; }
}

public enum MotivoNotaCredito
{
    DevolucionMercancia = 1,
    DescuentoPosterior = 2,
    ErrorEnFactura = 3,
    AnulacionVenta = 4,
    Otro = 5
}
```

---

### **4. Nota de Débito Electrónica (e03)**

**Uso:** Cargos adicionales posteriores a la factura
**Serie NCF:** E030000000001
**Características:**
- ✅ Aumenta el monto de la factura original
- ✅ Asociada a una factura previa

---

## **🔢 NCF - NÚMEROS DE COMPROBANTE FISCAL**

### **Formato de NCF**

```
E 31 0000000001
│ │  │
│ │  └─ Secuencial (8 dígitos)
│ └──── Tipo de comprobante (2 dígitos)
└───── Prefijo "E" (Electrónico)
```

### **Tipos de NCF**

| Código | Tipo | Descripción | Serie |
|--------|------|-------------|-------|
| **31** | Factura de Crédito Fiscal | Para empresas (con RNC) | E310000000001 |
| **32** | Factura de Consumo | Para consumidores finales | E320000000001 |
| **33** | Nota de Débito | Cargo adicional | E330000000001 |
| **34** | Nota de Crédito | Devolución/descuento | E340000000001 |
| **41** | Compra | Compras a proveedores informales | E410000000001 |
| **43** | Gastos Menores | Gastos sin comprobante | E430000000001 |
| **44** | Reg. Único de Ingresos | Ingresos del día | E440000000001 |
| **45** | Reg. Gubernamental | Ventas a entidades gubernamentales | E450000000001 |
| **47** | Reg. Exportaciones | Ventas al exterior | E470000000001 |

### **Gestión de NCF**

```csharp
public class NCFManager
{
    private readonly ApplicationDbContext _context;
    
    public async Task<string> GenerateNCFAsync(TipoComprobante tipo)
    {
        // Obtener la secuencia actual
        var secuencia = await _context.NCFSecuencias
            .FirstOrDefaultAsync(s => s.TipoComprobante == tipo && 
                                     s.Estado == EstadoSecuencia.Activa);
        
        if (secuencia == null)
            throw new Exception("No hay secuencia activa para este tipo de comprobante");
        
        // Verificar que no se ha agotado
        if (secuencia.SecuencialActual >= secuencia.SecuencialHasta)
            throw new Exception("Secuencia de NCF agotada. Solicitar nueva secuencia a DGII");
        
        // Incrementar secuencial
        secuencia.SecuencialActual++;
        await _context.SaveChangesAsync();
        
        // Formatear NCF
        var tipoStr = ((int)tipo).ToString("D2");
        var secuencialStr = secuencia.SecuencialActual.ToString("D8");
        
        return $"E{tipoStr}{secuencialStr}";
    }
}

public class NCFSecuencia
{
    public int Id { get; set; }
    public TipoComprobante TipoComprobante { get; set; }
    public int SecuencialDesde { get; set; }              // Ej: 1
    public int SecuencialHasta { get; set; }              // Ej: 1000000
    public int SecuencialActual { get; set; }             // Actual utilizado
    public DateTime FechaAutorizacion { get; set; }
    public DateTime FechaVencimiento { get; set; }
    public EstadoSecuencia Estado { get; set; }
}

public enum TipoComprobante
{
    FacturaCreditoFiscal = 31,
    FacturaConsumo = 32,
    NotaDebito = 33,
    NotaCredito = 34,
    Compra = 41,
    GastosMenores = 43,
    RegistroUnicoIngresos = 44,
    RegistroGubernamental = 45,
    RegistroExportaciones = 47
}

public enum EstadoSecuencia
{
    Activa,
    Agotada,
    Vencida,
    Anulada
}
```

### **Solicitud de NCF a la DGII**

Los restaurantes deben solicitar secuencias de NCF a través de:
1. Portal DGII: dgii.gov.do
2. Oficinas virtuales DGII
3. Renovación antes de agotar el 80% de la secuencia

---

## **💰 CÁLCULO DE ITBIS (18%)**

### **ITBIS - Impuesto sobre Transferencias**

```csharp
public class ITBISCalculationService
{
    private readonly ApplicationDbContext _context;
    
    public async Task<ITBISBreakdown> CalculateITBISAsync(List<OrderItem> items)
    {
        var breakdown = new ITBISBreakdown();
        
        foreach (var item in items)
        {
            var dish = await _context.Dishes
                .Include(d => d.Category)
                .FirstOrDefaultAsync(d => d.Id == item.DishId);
            
            var itemSubtotal = item.Quantity * item.UnitPrice;
            
            // Determinar tasa de ITBIS
            var tasaITBIS = GetTasaITBIS(dish);
            
            if (tasaITBIS > 0)
            {
                breakdown.MontoGravado += itemSubtotal;
                var itbisAmount = itemSubtotal * tasaITBIS;
                
                breakdown.Details.Add(new ITBISDetail
                {
                    ItemId = item.Id,
                    Description = dish.Name,
                    MontoGravado = itemSubtotal,
                    TasaITBIS = tasaITBIS,
                    MontoITBIS = itbisAmount
                });
                
                breakdown.MontoITBIS += itbisAmount;
            }
            else
            {
                breakdown.MontoExento += itemSubtotal;
            }
        }
        
        breakdown.Subtotal = breakdown.MontoGravado + breakdown.MontoExento;
        breakdown.Total = breakdown.Subtotal + breakdown.MontoITBIS;
        
        return breakdown;
    }
    
    private decimal GetTasaITBIS(Dish dish)
    {
        // La mayoría de alimentos y bebidas: 18%
        // Algunos productos básicos: Exentos
        // Productos específicos: 16%
        
        if (dish.Category.IsExento)
            return 0m;
        
        if (dish.Category.TasaReducida)
            return DominicanTaxRates.ITBIS_TASA_REDUCIDA; // 16%
        
        return DominicanTaxRates.ITBIS_TASA_GENERAL; // 18%
    }
}

public class ITBISBreakdown
{
    public decimal Subtotal { get; set; }
    public decimal MontoGravado { get; set; }                 // Base para ITBIS
    public decimal MontoExento { get; set; }                  // Sin ITBIS
    public decimal MontoITBIS { get; set; }                   // 18% del gravado
    public decimal Total { get; set; }
    public List<ITBISDetail> Details { get; set; } = new();
}

public class ITBISDetail
{
    public int ItemId { get; set; }
    public string Description { get; set; }
    public decimal MontoGravado { get; set; }
    public decimal TasaITBIS { get; set; }
    public decimal MontoITBIS { get; set; }
}
```

### **Productos Exentos de ITBIS**

Según la legislación dominicana, están exentos:
- ❌ Productos agrícolas en su estado natural
- ❌ Productos de la canasta básica
- ✅ Alimentos preparados en restaurantes: **GRAVADOS 18%**

---

## **🎁 PROPINA LEGAL 10% (Ley 13-07)**

### **Marco Legal**

**Ley 13-07 (Modificada por Ley 495-06):**
- ✅ **10% obligatorio** sobre el subtotal + ITBIS
- ✅ Aplica a establecimientos gastronómicos
- ✅ Se distribuye entre empleados de servicio
- ✅ El restaurante retiene 10% de ISR sobre propinas

```csharp
public class PropinaLegalService
{
    public PropinaCalculation CalculatePropinaLegal(decimal subtotalConITBIS)
    {
        // La propina legal se calcula sobre subtotal + ITBIS
        var propinaLegal = subtotalConITBIS * DominicanTaxRates.PROPINA_LEGAL;
        
        return new PropinaCalculation
        {
            BaseCalculo = subtotalConITBIS,
            PorcentajePropina = 10m,
            MontoPropinaLegal = Math.Round(propinaLegal, 2),
            EsObligatoria = true
        };
    }
    
    public PropinaDistribution CalculateDistribution(
        decimal montoPropina, 
        List<int> empleadosIds)
    {
        // Retención 10% ISR (queda en restaurante para pagar a DGII)
        var retencionISR = montoPropina * DominicanTaxRates.ISR_PROPINA_EMPLEADO;
        
        // Monto neto a distribuir
        var montoNeto = montoPropina - retencionISR;
        
        // Distribuir entre empleados
        var montoPorEmpleado = montoNeto / empleadosIds.Count;
        
        return new PropinaDistribution
        {
            MontoTotal = montoPropina,
            RetencionISR = retencionISR,
            MontoNetoDist distributed = montoNeto,
            MontoPorEmpleado = Math.Round(montoPorEmpleado, 2),
            EmpleadosCount = empleadosIds.Count
        };
    }
}

public class PropinaCalculation
{
    public decimal BaseCalculo { get; set; }
    public decimal PorcentajePropina { get; set; }
    public decimal MontoPropinaLegal { get; set; }
    public bool EsObligatoria { get; set; }
}

public class PropinaDistribution
{
    public decimal MontoTotal { get; set; }
    public decimal RetencionISR { get; set; }                 // 10% retenido
    public decimal MontoNetoDistribuido { get; set; }         // 90% a empleados
    public decimal MontoPorEmpleado { get; set; }
    public int EmpleadosCount { get; set; }
}
```

### **Propina Adicional Voluntaria**

Los clientes pueden dejar propina adicional:
```csharp
public class PropinaAdicionalService
{
    public decimal CalculatePropinaAdicional(
        decimal subtotalConITBIS, 
        decimal porcentajeAdicional)
    {
        // La propina adicional es voluntaria
        var propinaAdicional = subtotalConITBIS * (porcentajeAdicional / 100);
        return Math.Round(propinaAdicional, 2);
    }
}
```

---

## **📊 EJEMPLO COMPLETO DE FACTURA**

```
═══════════════════════════════════════════════════════════
          🍽️ RESTAURANTE EL BUEN SABOR SRL
═══════════════════════════════════════════════════════════
RNC: 131-123456-7
Av. 27 de Febrero No. 123, Ensanche Naco
Santo Domingo, Distrito Nacional, Rep. Dom.
Tel: (809) 555-1234
Email: facturacion@elbuensabor.com.do

FACTURA DE CONSUMO ELECTRÓNICA
NCF: E320000000456
Fecha: 06/02/2026 19:51:35
Hora: 07:51:35 PM

Mesa: 12 - Terraza
Mesero: Carlos Ruiz
───────────────────────────────────────────────────────────

DETALLE DEL CONSUMO

1x Churrasco Premium (400g)               RD$ 950.00
   Término medio, sin cebolla
   Con papas al horno

1x Ensalada César                         RD$ 350.00

1x Pasta Alfredo                          RD$ 450.00
   Con pollo

2x Limonada Natural                       RD$ 200.00

1x Cerveza Presidente                     RD$ 150.00

───────────────────────────────────────────────────────────
CÁLCULO DE IMPUESTOS

Monto Gravado (Base):                   RD$ 2,100.00
ITBIS 18%:                              RD$   378.00
───────────────────────────────────────────────────────────
Subtotal + ITBIS:                       RD$ 2,478.00

Propina Legal 10% (Ley 13-07):          RD$   247.80
Propina Adicional (Voluntaria):         RD$     0.00
───────────────────────────────────────────────────────────
TOTAL A PAGAR:                          RD$ 2,725.80
═══════════════════════════════════════════════════════════

FORMA DE PAGO

Método: Tarjeta de Crédito ****1234
Código Autorización: 123456
Fecha/Hora: 06/02/2026 19:51:35

───────────────────────────────────────────────────────────

          ¡Gracias por su preferencia!
          Vuelva pronto

Para consultas o facturación con RNC:
WhatsApp: (809) 555-1234
Email: facturacion@elbuensabor.com.do

Validar este comprobante en:
https://dgii.gov.do/app/consultas/ncf

[QR CODE]

═══════════════════════════════════════════════════════════
Comprobante Fiscal Electrónico Válido
Sistema SmartMenu by [Tu Empresa]
═══════════════════════════════════════════════════════════
```

---

## **📤 INTEGRACIÓN CON DGII**

### **Portal e-Factura DGII**

```csharp
public class DGIIIntegrationService
{
    private readonly HttpClient _httpClient;
    private readonly string _apiUrl = "https://ecf.dgii.gov.do/api";
    
    public async Task<DGIIResponse> EnviarComprobanteAsync(FacturaConsumo factura)
    {
        // Generar XML según especificación DGII
        var xml = GenerarXMLComprobante(factura);
        
        // Firmar digitalmente el XML
        var xmlFirmado = FirmarXML(xml);
        
        // Enviar a DGII
        var response = await _httpClient.PostAsync(
            $"{_apiUrl}/comprobantes",
            new StringContent(xmlFirmado, Encoding.UTF8, "application/xml")
        );
        
        if (response.IsSuccessStatusCode)
        {
            var result = await response.Content.ReadAsStringAsync();
            return ParseDGIIResponse(result);
        }
        
        throw new Exception("Error al enviar comprobante a DGII");
    }
    
    private string GenerarXMLComprobante(FacturaConsumo factura)
    {
        // Generar XML según esquema XSD de DGII
        // Especificación: Norma 01-19
        
        var xml = new XDocument(
            new XElement("eFactura",
                new XAttribute("version", "1.0"),
                new XElement("Encabezado",
                    new XElement("RNCEmisor", factura.EmisorRNC),
                    new XElement("RazonSocialEmisor", factura.EmisorNombreComercial),
                    new XElement("NCF", factura.NCF),
                    new XElement("TipoComprobante", "32"),
                    new XElement("FechaEmision", factura.FechaEmision.ToString("yyyy-MM-dd")),
                    new XElement("HoraEmision", factura.FechaEmision.ToString("HH:mm:ss"))
                ),
                new XElement("Detalles",
                    factura.Items.Select(item =>
                        new XElement("Item",
                            new XElement("Cantidad", item.Cantidad),
                            new XElement("Descripcion", item.Descripcion),
                            new XElement("PrecioUnitario", item.PrecioUnitario),
                            new XElement("MontoItem", item.MontoItem),
                            new XElement("ITBIS", item.MontoITBIS)
                        )
                    )
                ),
                new XElement("Totales",
                    new XElement("MontoGravado", factura.MontoGravado),
                    new XElement("ITBIS", factura.ITBIS),
                    new XElement("PropinaLegal", factura.PropinaLegal),
                    new XElement("MontoTotal", factura.MontoTotal)
                )
            )
        );
        
        return xml.ToString();
    }
}
```

---

## **📊 REPORTES FISCALES (606, 607, 608)**

### **Formato 606 - Compras**

Reporte mensual de compras a proveedores:

```csharp
public class Formato606Service
{
    public async Task<string> GenerateFormato606Async(int year, int month)
    {
        var compras = await _context.Compras
            .Where(c => c.Fecha.Year == year && c.Fecha.Month == month)
            .Include(c => c.Proveedor)
            .ToListAsync();
        
        var sb = new StringBuilder();
        
        // Formato TXT según especificación DGII
        foreach (var compra in compras)
        {
            var line = $"{compra.NCF}|" +
                      $"{compra.NCFModificado ?? ""}|" +
                      $"{compra.TipoIdentificacion}|" +
                      $"{compra.RNCProveedor}|" +
                      $"{compra.TipoComprobante}|" +
                      $"{compra.Fecha:yyyyMMdd}|" +
                      $"{compra.FechaPago:yyyyMMdd}|" +
                      $"{compra.MontoFacturado:F2}|" +
                      $"{compra.ITBIS:F2}|" +
                      $"{compra.Retencion:F2}";
            
            sb.AppendLine(line);
        }
        
        return sb.ToString();
    }
}
```

### **Formato 607 - Ventas**

Reporte mensual de ventas:

```csharp
public class Formato607Service
{
    public async Task<string> GenerateFormato607Async(int year, int month)
    {
        var ventas = await _context.Facturas
            .Where(f => f.FechaEmision.Year == year && 
                       f.FechaEmision.Month == month &&
                       f.Estado == EstadoComprobante.Valido)
            .ToListAsync();
        
        var sb = new StringBuilder();
        
        foreach (var venta in ventas)
        {
            var line = $"{venta.NCF}|" +
                      $"{venta.NCFModificado ?? ""}|" +
                      $"{venta.TipoIdentificacionComprador}|" +
                      $"{venta.CompradorRNC ?? ""}|" +
                      $"{venta.TipoComprobante}|" +
                      $"{venta.FechaEmision:yyyyMMdd}|" +
                      $"{venta.FechaPago:yyyyMMdd}|" +
                      $"{venta.MontoFacturado:F2}|" +
                      $"{venta.ITBIS:F2}";
            
            sb.AppendLine(line);
        }
        
        return sb.ToString();
    }
}
```

### **Formato 608 - Anulaciones**

Reporte de comprobantes anulados:

```csharp
public class Formato608Service
{
    public async Task<string> GenerateFormato608Async(int year, int month)
    {
        var anulados = await _context.Facturas
            .Where(f => f.FechaAnulacion.HasValue &&
                       f.FechaAnulacion.Value.Year == year &&
                       f.FechaAnulacion.Value.Month == month)
            .ToListAsync();
        
        var sb = new StringBuilder();
        
        foreach (var anulado in anulados)
        {
            var line = $"{anulado.NCF}|" +
                      $"{anulado.TipoComprobante}|" +
                      $"{anulado.FechaEmision:yyyyMMdd}|" +
                      $"{anulado.FechaAnulacion:yyyyMMdd}|" +
                      $"{anulado.MotivoAnulacion}";
            
            sb.AppendLine(line);
        }
        
        return sb.ToString();
    }
}
```

---

## **💳 MÉTODOS DE PAGO EN RD**

### **Métodos Populares en República Dominicana**

```csharp
public enum MetodoPagoRD
{
    Efectivo = 1,
    TarjetaCredito = 2,
    TarjetaDebito = 3,
    TransferenciaBancaria = 4,
    AzulPay = 5,                    // Popular en RD
    CardNet = 6,                    // Procesador local
    PayPal = 7,
    ApplePay = 8,
    GooglePay = 9,
    Otros = 10
}

public class MetodoPagoConfiguration
{
    public int Id { get; set; }
    public MetodoPagoRD Metodo { get; set; }
    public bool EstaActivo { get; set; }
    public string NombreDisplay { get; set; }
    
    // Comisiones
    public decimal ComisionFija { get; set; }
    public decimal ComisionPorcentaje { get; set; }
    
    // Para tarjetas en RD
    public string ProcessorName { get; set; }             // "Azul", "CardNet", "Vimenca"
    public string MerchantId { get; set; }
    public string TerminalId { get; set; }
}
```

### **Procesadores de Pago en RD**

| Procesador | Uso | Comisión Típica |
|------------|-----|-----------------|
| **Azul** | Principal tarjetas RD | 3.5% + RD$2 |
| **CardNet** | Segundo más usado | 3.5% + RD$2 |
| **Vimenca** | Tarjetas visa/mastercard | 3.5% |
| **Stripe** | Internacional | 3.9% + $0.30 USD |
| **PayPal** | Internacional | 5.4% + fijo |

---

## **🔀 DIVISIÓN DE CUENTAS**

### **1. División Igual**

```csharp
public async Task<DivisionCuenta> DividirIgualAsync(
    int sessionId, 
    int numeroPerson)
{
    var session = await _context.TableSessions
        .Include(ts => ts.Orders)
            .ThenInclude(o => o.Items)
        .FirstOrDefaultAsync(ts => ts.Id == sessionId);
    
    // Calcular totales
    var breakdown = await CalculateITBISAsync(session.Orders);
    var propinaLegal = breakdown.Total * DominicanTaxRates.PROPINA_LEGAL;
    var totalConPropina = breakdown.Total + propinaLegal;
    
    var montoPorPersona = totalConPropina / numeroPersonas;
    
    return new DivisionCuenta
    {
        SessionId = sessionId,
        TipoDivision = TipoDivision.Igual,
        NumeroPersonas = numeroPersonas,
        MontoOriginal = totalConPropina,
        MontoPorPersona = Math.Round(montoPorPersona, 2),
        Partes = GenerarPartes(numeroPersonas, montoPorPersona)
    };
}
```

### **2. División por Items**

```csharp
public async Task<DivisionCuenta> DividirPorItemsAsync(
    int sessionId,
    Dictionary<string, List<int>> asignacionItems) // email → [itemIds]
{
    var session = await _context.TableSessions
        .Include(ts => ts.Orders)
            .ThenInclude(o => o.Items)
        .FirstOrDefaultAsync(ts => ts.Id == sessionId);
    
    var division = new DivisionCuenta
    {
        SessionId = sessionId,
        TipoDivision = TipoDivision.PorItems,
        NumeroPersonas = asignacionItems.Count,
        Partes = new List<ParteDivision>()
    };
    
    foreach (var asignacion in asignacionItems)
    {
        var items = session.Orders
            .SelectMany(o => o.Items)
            .Where(i => asignacion.Value.Contains(i.Id))
            .ToList();
        
        var subtotal = items.Sum(i => i.Quantity * i.UnitPrice);
        var itbis = subtotal * DominicanTaxRates.ITBIS_TASA_GENERAL;
        var subtotalConITBIS = subtotal + itbis;
        var propinaLegal = subtotalConITBIS * DominicanTaxRates.PROPINA_LEGAL;
        var total = subtotalConITBIS + propinaLegal;
        
        division.Partes.Add(new ParteDivision
        {
            ClienteIdentificador = asignacion.Key,
            ItemIds = asignacion.Value,
            Subtotal = subtotal,
            ITBIS = itbis,
            PropinaLegal = propinaLegal,
            Total = Math.Round(total, 2)
        });
    }
    
    division.MontoOriginal = division.Partes.Sum(p => p.Total);
    
    return division;
}
```

---

## **🔌 INTEGRACIÓN CON STRIPE (Pagos Internacionales)**

### **Configuración para República Dominicana**

```csharp
public class StripeServiceRD : IStripeService
{
    private readonly StripeClient _stripeClient;
    
    public StripeServiceRD(IConfiguration configuration)
    {
        StripeConfiguration.ApiKey = configuration["Stripe:SecretKey"];
        _stripeClient = new StripeClient(StripeConfiguration.ApiKey);
    }
    
    public async Task<PaymentIntentResult> CreatePaymentIntentAsync(
        decimal amountDOP,
        string sessionId)
    {
        // Stripe trabaja en centavos
        var amountInCents = (long)(amountDOP * 100);
        
        var options = new PaymentIntentCreateOptions
        {
            Amount = amountInCents,
            Currency = "dop",                             // Peso Dominicano
            Description = $"SmartMenu - Sesión {sessionId}",
            Metadata = new Dictionary<string, string>
            {
                { "session_id", sessionId },
                { "country", "DO" },
                { "restaurant_id", "1" }
            },
            StatementDescriptor = "SMARTMENU*REST",       // Aparece en estado de cuenta
            PaymentMethodTypes = new List<string> { "card" }
        };
        
        var service = new PaymentIntentService();
        var paymentIntent = await service.CreateAsync(options);
        
        return new PaymentIntentResult
        {
            ClientSecret = paymentIntent.ClientSecret,
            PaymentIntentId = paymentIntent.Id,
            Amount = amountDOP,
            Currency = "DOP"
        };
    }
    
    public async Task<bool> VerifyWebhookAsync(string payload, string signature)
    {
        try
        {
            var webhookSecret = _configuration["Stripe:WebhookSecret"];
            var stripeEvent = EventUtility.ConstructEvent(
                payload,
                signature,
                webhookSecret
            );
            
            return true;
        }
        catch
        {
            return false;
        }
    }
}
```

---

## **📊 MODELO DE DATOS COMPLETO**

### **Tabla: Payments**

```sql
CREATE TABLE Payments (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    SessionId INT NOT NULL,
    TableId INT NOT NULL,
    
    -- Montos (en DOP)
    Subtotal DECIMAL(18,2) NOT NULL,
    ITBIS DECIMAL(18,2) NOT NULL,
    PropinaLegal DECIMAL(18,2) NOT NULL,
    PropinaAdicional DECIMAL(18,2) DEFAULT 0,
    Descuento DECIMAL(18,2) DEFAULT 0,
    Total DECIMAL(18,2) NOT NULL,
    
    -- Método de pago
    Metodo VARCHAR(50) NOT NULL,
    FormaPagoDGII VARCHAR(2) NOT NULL,                    -- Código DGII: 01, 02, 03, 04
    
    -- Información transacción
    TransactionId VARCHAR(255),                           -- ID de Stripe o procesador
    AuthorizationCode VARCHAR(100),                       -- Código autorización
    PaymentReference VARCHAR(255),
    
    -- Estado
    Status VARCHAR(50) NOT NULL,                          -- Pending, Completed, Failed
    ErrorMessage NVARCHAR(500),
    
    -- Auditoría
    CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    CompletedAt DATETIME2,
    
    -- Índices
    CONSTRAINT FK_Payments_Sessions FOREIGN KEY (SessionId) 
        REFERENCES TableSessions(Id),
    CONSTRAINT FK_Payments_Tables FOREIGN KEY (TableId) 
        REFERENCES Tables(Id)
);

CREATE INDEX IX_Payments_SessionId ON Payments(SessionId);
CREATE INDEX IX_Payments_Status ON Payments(Status);
CREATE INDEX IX_Payments_CreatedAt ON Payments(CreatedAt);
```

### **Tabla: Invoices (Facturas Electrónicas)**

```sql
CREATE TABLE Invoices (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    PaymentId INT NOT NULL,
    
    -- NCF
    NCF VARCHAR(19) NOT NULL UNIQUE,                      -- E320000000123
    TipoComprobante INT NOT NULL,                         -- 31, 32, 34, etc.
    NCFSecuenciaId INT NOT NULL,
    
    -- Datos fiscales emisor (Restaurante)
    EmisorRNC VARCHAR(11) NOT NULL,
    EmisorRazonSocial NVARCHAR(200) NOT NULL,
    EmisorNombreComercial NVARCHAR(200),
    EmisorDireccion NVARCHAR(500),
    EmisorTelefono VARCHAR(20),
    EmisorEmail VARCHAR(100),
    
    -- Datos fiscales receptor (Cliente)
    CompradorTipoIdentificacion VARCHAR(2),               -- 1=RNC, 2=Cédula, 3=Pasaporte
    CompradorRNC VARCHAR(11),
    CompradorNombre NVARCHAR(200),
    CompradorDireccion NVARCHAR(500),
    CompradorTelefono VARCHAR(20),
    CompradorEmail VARCHAR(100),
    
    -- Fechas
    FechaEmision DATETIME2 NOT NULL,
    FechaVencimiento DATETIME2,                           -- Si es a crédito
    
    -- Montos
    MontoGravado18 DECIMAL(18,2) NOT NULL,                -- Base ITBIS 18%
    ITBIS18 DECIMAL(18,2) NOT NULL,
    MontoGravado16 DECIMAL(18,2) DEFAULT 0,               -- Base ITBIS 16%
    ITBIS16 DECIMAL(18,2) DEFAULT 0,
    MontoExento DECIMAL(18,2) DEFAULT 0,
    PropinaLegal DECIMAL(18,2) NOT NULL,
    PropinaAdicional DECIMAL(18,2) DEFAULT 0,
    Descuento DECIMAL(18,2) DEFAULT 0,
    MontoTotal DECIMAL(18,2) NOT NULL,
    
    -- Forma de pago DGII
    FormaPago VARCHAR(2) NOT NULL,                        -- 01, 02, 03, 04
    CondicionPago VARCHAR(2) NOT NULL,                    -- 1=Contado, 2=Crédito
    
    -- Archivos generados
    UrlPDF NVARCHAR(500),
    UrlXML NVARCHAR(500),
    CodigoQR NVARCHAR(MAX),
    
    -- Estado
    Estado VARCHAR(50) NOT NULL,                          -- Valido, Anulado, Enviado
    FechaAnulacion DATETIME2,
    MotivoAnulacion NVARCHAR(500),
    
    -- DGII
    EnviadoDGII BIT DEFAULT 0,
    FechaEnvioDGII DATETIME2,
    RespuestaDGII NVARCHAR(MAX),
    
    -- Auditoría
    CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    CreatedBy INT,
    
    CONSTRAINT FK_Invoices_Payments FOREIGN KEY (PaymentId) 
        REFERENCES Payments(Id),
    CONSTRAINT FK_Invoices_NCFSecuencias FOREIGN KEY (NCFSecuenciaId) 
        REFERENCES NCFSecuencias(Id)
);

CREATE UNIQUE INDEX IX_Invoices_NCF ON Invoices(NCF);
CREATE INDEX IX_Invoices_PaymentId ON Invoices(PaymentId);
CREATE INDEX IX_Invoices_FechaEmision ON Invoices(FechaEmision);
CREATE INDEX IX_Invoices_CompradorRNC ON Invoices(CompradorRNC);
```

### **Tabla: NCFSecuencias**

```sql
CREATE TABLE NCFSecuencias (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    RestaurantId INT NOT NULL,
    TipoComprobante INT NOT NULL,                         -- 31, 32, 34, etc.
    
    -- Rango autorizado por DGII
    SecuencialDesde INT NOT NULL,                         -- 1
    SecuencialHasta INT NOT NULL,                         -- 1000000
    SecuencialActual INT NOT NULL DEFAULT 0,
    
    -- Fechas
    FechaAutorizacion DATE NOT NULL,
    FechaVencimiento DATE NOT NULL,
    
    -- Estado
    Estado VARCHAR(50) NOT NULL,                          -- Activa, Agotada, Vencida
    
    -- Auditoría
    CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    
    CONSTRAINT FK_NCFSecuencias_Restaurants FOREIGN KEY (RestaurantId) 
        REFERENCES Restaurants(Id)
);

CREATE INDEX IX_NCFSecuencias_TipoComprobante ON NCFSecuencias(TipoComprobante);
CREATE INDEX IX_NCFSecuencias_Estado ON NCFSecuencias(Estado);
```

### **Tabla: InvoiceItems**

```sql
CREATE TABLE InvoiceItems (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    InvoiceId INT NOT NULL,
    
    -- Detalle del producto/servicio
    Cantidad INT NOT NULL,
    Descripcion NVARCHAR(500) NOT NULL,
    PrecioUnitario DECIMAL(18,2) NOT NULL,
    Descuento DECIMAL(18,2) DEFAULT 0,
    MontoItem DECIMAL(18,2) NOT NULL,
    
    -- Impuestos
    TipoImpuesto VARCHAR(20) NOT NULL,                    -- ITBIS18, ITBIS16, Exento
    MontoITBIS DECIMAL(18,2) NOT NULL,
    
    CONSTRAINT FK_InvoiceItems_Invoices FOREIGN KEY (InvoiceId) 
        REFERENCES Invoices(Id) ON DELETE CASCADE
);

CREATE INDEX IX_InvoiceItems_InvoiceId ON InvoiceItems(InvoiceId);
```

### **Tabla: TipDistributions (Distribución de Propinas)**

```sql
CREATE TABLE TipDistributions (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    PaymentId INT NOT NULL,
    StaffId INT NOT NULL,
    
    -- Montos
    MontoPropinaTotal DECIMAL(18,2) NOT NULL,
    RetencionISR10 DECIMAL(18,2) NOT NULL,                -- 10% retención
    MontoNetoEmpleado DECIMAL(18,2) NOT NULL,             -- 90% para empleado
    
    -- Fecha
    FechaPropina DATE NOT NULL,
    FechaPago DATE,
    EstaPagado BIT DEFAULT 0,
    
    -- Tipo de distribución
    TipoDistribucion VARCHAR(50) NOT NULL,                -- Directo, Pool, etc.
    
    CONSTRAINT FK_TipDistributions_Payments FOREIGN KEY (PaymentId) 
        REFERENCES Payments(Id),
    CONSTRAINT FK_TipDistributions_Staff FOREIGN KEY (StaffId) 
        REFERENCES Staff(Id)
);

CREATE INDEX IX_TipDistributions_StaffId ON TipDistributions(StaffId);
CREATE INDEX IX_TipDistributions_FechaPropina ON TipDistributions(FechaPropina);
```

---

## **💻 IMPLEMENTACIÓN COMPLETA EN C#**

### **Service: PaymentService**

```csharp
using Microsoft.EntityFrameworkCore;
using SmartMenu.Domain.Entities;
using SmartMenu.Application.DTOs;

namespace SmartMenu.Application.Services
{
    public interface IPaymentService
    {
        Task<PaymentResult> ProcessPaymentAsync(ProcessPaymentRequest request);
        Task<Invoice> GenerateInvoiceAsync(int paymentId, InvoiceRequest request);
        Task<DivisionCuenta> SplitBillAsync(int sessionId, SplitBillRequest request);
    }
    
    public class PaymentService : IPaymentService
    {
        private readonly ApplicationDbContext _context;
        private readonly IStripeService _stripeService;
        private readonly INCFManager _ncfManager;
        private readonly IDGIIIntegrationService _dgiiService;
        private readonly INotificationService _notificationService;
        
        public PaymentService(
            ApplicationDbContext context,
            IStripeService stripeService,
            INCFManager ncfManager,
            IDGIIIntegrationService dgiiService,
            INotificationService notificationService)
        {
            _context = context;
            _stripeService = stripeService;
            _ncfManager = ncfManager;
            _dgiiService = dgiiService;
            _notificationService = notificationService;
        }
        
        public async Task<PaymentResult> ProcessPaymentAsync(ProcessPaymentRequest request)
        {
            // 1. Obtener sesión y órdenes
            var session = await _context.TableSessions
                .Include(ts => ts.Orders)
                    .ThenInclude(o => o.Items)
                .Include(ts => ts.Table)
                .FirstOrDefaultAsync(ts => ts.Id == request.SessionId);
            
            if (session == null)
                throw new NotFoundException("Session not found");
            
            // 2. Calcular totales
            var taxCalculation = await CalculateTotalsAsync(session.Orders);
            
            // 3. Calcular propina legal (10% obligatorio)
            var propinaLegal = taxCalculation.Total * DominicanTaxRates.PROPINA_LEGAL;
            
            // 4. Propina adicional (opcional)
            var propinaAdicional = request.PropinaAdicionalPorcentaje.HasValue
                ? taxCalculation.Total * (request.PropinaAdicionalPorcentaje.Value / 100)
                : 0;
            
            var totalFinal = taxCalculation.Total + propinaLegal + propinaAdicional;
            
            // 5. Crear registro de pago
            var payment = new Payment
            {
                SessionId = request.SessionId,
                TableId = session.TableId,
                Subtotal = taxCalculation.Subtotal,
                ITBIS = taxCalculation.ITBIS,
                PropinaLegal = propinaLegal,
                PropinaAdicional = propinaAdicional,
                Total = totalFinal,
                Metodo = request.MetodoPago.ToString(),
                FormaPagoDGII = GetFormaPagoDGII(request.MetodoPago),
                Status = PaymentStatus.Pending,
                CreatedAt = DateTime.UtcNow
            };
            
            _context.Payments.Add(payment);
            await _context.SaveChangesAsync();
            
            // 6. Procesar pago según método
            PaymentResult result;
            
            switch (request.MetodoPago)
            {
                case MetodoPagoRD.TarjetaCredito:
                case MetodoPagoRD.TarjetaDebito:
                    result = await _stripeService.ProcessCardPaymentAsync(
                        payment.Id,
                        totalFinal,
                        request.PaymentToken
                    );
                    break;
                
                case MetodoPagoRD.Efectivo:
                    result = ProcessCashPayment(payment);
                    break;
                
                default:
                    throw new NotSupportedException($"Método {request.MetodoPago} no soportado");
            }
            
            // 7. Actualizar pago
            payment.Status = result.Success 
                ? PaymentStatus.Completed 
                : PaymentStatus.Failed;
            payment.TransactionId = result.TransactionId;
            payment.PaymentReference = result.Reference;
            payment.CompletedAt = result.Success ? DateTime.UtcNow : null;
            payment.ErrorMessage = result.ErrorMessage;
            
            await _context.SaveChangesAsync();
            
            if (result.Success)
            {
                // 8. Cerrar sesión
                session.Status = SessionStatus.Paid;
                session.EndTime = DateTime.UtcNow;
                await _context.SaveChangesAsync();
                
                // 9. Generar comprobante (Factura de Consumo por defecto)
                await GenerateDefaultInvoiceAsync(payment.Id);
                
                // 10. Distribuir propinas
                await DistributeTipsAsync(payment);
                
                // 11. Notificar
                await _notificationService.NotifyPaymentCompletedAsync(payment.Id);
            }
            
            return result;
        }
        
        private string GetFormaPagoDGII(MetodoPagoRD metodo)
        {
            return metodo switch
            {
                MetodoPagoRD.Efectivo => "01",
                MetodoPagoRD.TarjetaCredito => "03",
                MetodoPagoRD.TarjetaDebito => "03",
                MetodoPagoRD.TransferenciaBancaria => "04",
                _ => "05" // Otro
            };
        }
        
        private async Task<TaxCalculation> CalculateTotalsAsync(List<Order> orders)
        {
            decimal subtotal = 0;
            decimal itbis = 0;
            
            foreach (var order in orders)
            {
                foreach (var item in order.Items)
                {
                    var itemTotal = item.Quantity * item.UnitPrice;
                    subtotal += itemTotal;
                    
                    // Calcular ITBIS (18% en la mayoría de casos)
                    itbis += itemTotal * DominicanTaxRates.ITBIS_TASA_GENERAL;
                }
            }
            
            return new TaxCalculation
            {
                Subtotal = subtotal,
                ITBIS = Math.Round(itbis, 2),
                Total = Math.Round(subtotal + itbis, 2)
            };
        }
        
        public async Task<Invoice> GenerateInvoiceAsync(
            int paymentId, 
            InvoiceRequest request)
        {
            var payment = await _context.Payments
                .Include(p => p.Session)
                    .ThenInclude(s => s.Orders)
                        .ThenInclude(o => o.Items)
                .FirstOrDefaultAsync(p => p.Id == paymentId);
            
            if (payment == null)
                throw new NotFoundException("Payment not found");
            
            // Determinar tipo de comprobante
            var tipoComprobante = !string.IsNullOrEmpty(request.CompradorRNC)
                ? TipoComprobante.FacturaCreditoFiscal  // e31
                : TipoComprobante.FacturaConsumo;        // e32
            
            // Generar NCF
            var ncf = await _ncfManager.GenerateNCFAsync(tipoComprobante);
            
            // Obtener datos del restaurante
            var restaurant = await _context.Restaurants
                .FirstOrDefaultAsync(r => r.Id == payment.Session.Table.RestaurantId);
            
            // Crear factura
            var invoice = new Invoice
            {
                PaymentId = payment.Id,
                NCF = ncf,
                TipoComprobante = (int)tipoComprobante,
                
                // Emisor
                EmisorRNC = restaurant.RNC,
                EmisorRazonSocial = restaurant.RazonSocial,
                EmisorNombreComercial = restaurant.NombreComercial,
                EmisorDireccion = restaurant.Direccion,
                EmisorTelefono = restaurant.Telefono,
                EmisorEmail = restaurant.Email,
                
                // Receptor
                CompradorRNC = request.CompradorRNC,
                CompradorNombre = request.CompradorNombre,
                CompradorDireccion = request.CompradorDireccion,
                CompradorTelefono = request.CompradorTelefono,
                CompradorEmail = request.CompradorEmail,
                
                // Fechas
                FechaEmision = DateTime.Now,
                
                // Montos
                MontoGravado18 = payment.Subtotal,
                ITBIS18 = payment.ITBIS,
                PropinaLegal = payment.PropinaLegal,
                PropinaAdicional = payment.PropinaAdicional,
                MontoTotal = payment.Total,
                
                // Forma de pago
                FormaPago = payment.FormaPagoDGII,
                CondicionPago = "1", // Contado
                
                // Estado
                Estado = EstadoComprobante.Valido,
                CreatedAt = DateTime.UtcNow
            };
            
            _context.Invoices.Add(invoice);
            
            // Crear items de la factura
            foreach (var order in payment.Session.Orders)
            {
                foreach (var item in order.Items)
                {
                    var invoiceItem = new InvoiceItem
                    {
                        InvoiceId = invoice.Id,
                        Cantidad = item.Quantity,
                        Descripcion = item.Dish.Name,
                        PrecioUnitario = item.UnitPrice,
                        MontoItem = item.Quantity * item.UnitPrice,
                        TipoImpuesto = TipoImpuesto.ITBIS18,
                        MontoITBIS = (item.Quantity * item.UnitPrice) * DominicanTaxRates.ITBIS_TASA_GENERAL
                    };
                    
                    _context.InvoiceItems.Add(invoiceItem);
                }
            }
            
            await _context.SaveChangesAsync();
            
            // Generar PDF y XML
            await GenerateInvoiceFilesAsync(invoice);
            
            // Enviar a DGII
            await _dgiiService.EnviarComprobanteAsync(invoice);
            
            // Enviar por email si tiene
            if (!string.IsNullOrEmpty(invoice.CompradorEmail))
            {
                await SendInvoiceByEmailAsync(invoice);
            }
            
            return invoice;
        }
        
        private async Task GenerateDefaultInvoiceAsync(int paymentId)
        {
            // Generar factura de consumo por defecto (sin RNC del cliente)
            await GenerateInvoiceAsync(paymentId, new InvoiceRequest
            {
                TipoComprobante = TipoComprobante.FacturaConsumo
            });
        }
    }
}
```

---

## **📊 EJEMPLO DE CÁLCULO COMPLETO**

### **Caso: Mesa con 3 Personas - RD$2,100 en consumo**

```
══════════════════════════════════════════════════════════
ORDEN #2345 - Mesa 12 - 3 Personas
══════════════════════════════════════════════════════════

CONSUMO:
1x Churrasco Premium                      RD$   950.00
1x Ensalada César                         RD$   350.00
1x Pasta Alfredo                          RD$   450.00
2x Limonada Natural                       RD$   200.00
1x Cerveza Presidente                     RD$   150.00

──────────────────────────────────────────────────────────
CÁLCULO FISCAL:

Subtotal (Base):                          RD$ 2,100.00
ITBIS 18%:                                RD$   378.00
──────────────────────────────────────────────────────────
Subtotal + ITBIS:                         RD$ 2,478.00

Propina Legal 10% (Obligatoria):          RD$   247.80
Propina Adicional (Voluntaria):           RD$     0.00
──────────────────────────────────────────────────────────
TOTAL A PAGAR:                            RD$ 2,725.80
══════════════════════════════════════════════════════════

DISTRIBUCIÓN DE PROPINA:
Propina Total:                            RD$   247.80
Retención ISR 10% (para DGII):            RD$    24.78
Neto para empleados (90%):                RD$   223.02

DIVISIÓN IGUAL ENTRE 3 PERSONAS:
RD$ 908.60 por persona

══════════════════════════════════════════════════════════
NCF: E320000000456
Forma de Pago: Tarjeta de Crédito (03)
Comprobante: Factura de Consumo Electrónica
══════════════════════════════════════════════════════════
```

---

## **📋 API ENDPOINTS**

### **Payments Endpoints**

```csharp
[ApiController]
[Route("api/[controller]")]
public class PaymentsController : ControllerBase
{
    private readonly IPaymentService _paymentService;
    
    [HttpPost("process")]
    [Authorize(Roles = "Customer,Waiter")]
    public async Task<ActionResult<PaymentResult>> ProcessPayment(
        [FromBody] ProcessPaymentRequest request)
    {
        var result = await _paymentService.ProcessPaymentAsync(request);
        return Ok(result);
    }
    
    [HttpPost("{paymentId}/invoice")]
    [Authorize(Roles = "Customer,Waiter")]
    public async Task<ActionResult<Invoice>> GenerateInvoice(
        int paymentId,
        [FromBody] InvoiceRequest request)
    {
        var invoice = await _paymentService.GenerateInvoiceAsync(paymentId, request);
        return CreatedAtAction(nameof(GetInvoice), new { id = invoice.Id }, invoice);
    }
    
    [HttpGet("invoices/{id}")]
    public async Task<ActionResult<Invoice>> GetInvoice(int id)
    {
        var invoice = await _context.Invoices
            .Include(i => i.Items)
            .FirstOrDefaultAsync(i => i.Id == id);
        
        if (invoice == null)
            return NotFound();
        
        return Ok(invoice);
    }
    
    [HttpGet("invoices/{id}/pdf")]
    public async Task<IActionResult> GetInvoicePDF(int id)
    {
        var invoice = await _context.Invoices.FindAsync(id);
        
        if (invoice == null)
            return NotFound();
        
        // Descargar PDF de Azure Blob Storage
        var pdfBytes = await _blobService.DownloadFileAsync(invoice.UrlPDF);
        
        return File(pdfBytes, "application/pdf", $"factura-{invoice.NCF}.pdf");
    }
    
    [HttpPost("split-bill")]
    [Authorize(Roles = "Customer")]
    public async Task<ActionResult<DivisionCuenta>> SplitBill(
        [FromBody] SplitBillRequest request)
    {
        var division = await _paymentService.SplitBillAsync(
            request.SessionId,
            request
        );
        
        return Ok(division);
    }
    
    [HttpGet("session/{sessionId}/bill")]
    public async Task<ActionResult<BillSummary>> GetBill(int sessionId)
    {
        var bill = await _paymentService.GetBillSummaryAsync(sessionId);
        return Ok(bill);
    }
}
```

### **Request/Response DTOs**

```csharp
public class ProcessPaymentRequest
{
    public int SessionId { get; set; }
    public MetodoPagoRD MetodoPago { get; set; }
    public string PaymentToken { get; set; }              // Token de Stripe
    public decimal? PropinaAdicionalPorcentaje { get; set; }  // Opcional
    public string CustomerEmail { get; set; }
}

public class PaymentResult
{
    public bool Success { get; set; }
    public string TransactionId { get; set; }
    public string Reference { get; set; }
    public decimal Amount { get; set; }
    public string ErrorMessage { get; set; }
    public Invoice Invoice { get; set; }
}

public class InvoiceRequest
{
    public TipoComprobante TipoComprobante { get; set; }  // 31 o 32
    
    // Datos del comprador (requeridos si TipoComprobante = 31)
    public string CompradorRNC { get; set; }
    public string CompradorNombre { get; set; }
    public string CompradorDireccion { get; set; }
    public string CompradorTelefono { get; set; }
    public string CompradorEmail { get; set; }
}

public class BillSummary
{
    public int SessionId { get; set; }
    public int TableId { get; set; }
    public string TableNumber { get; set; }
    public List<OrderSummary> Orders { get; set; }
    
    public decimal Subtotal { get; set; }
    public decimal ITBIS { get; set; }
    public decimal SubtotalConITBIS { get; set; }
    public decimal PropinaLegal { get; set; }
    public decimal Total { get; set; }
    
    public List<decimal> PropinaAdicionalSugerida { get; set; } = new() { 5, 10, 15 };
}
```

---

## **🔄 FLUJO COMPLETO DE PAGO**

```
1. Cliente solicita cuenta
   └─→ GET /api/payments/session/{sessionId}/bill

2. Sistema calcula:
   - Subtotal: RD$ 2,100.00
   - ITBIS 18%: RD$ 378.00
   - Subtotal + ITBIS: RD$ 2,478.00
   - Propina Legal 10%: RD$ 247.80
   - Total: RD$ 2,725.80

3. Cliente selecciona método de pago
   └─→ POST /api/payments/process

4. Si es tarjeta:
   a. Crear PaymentIntent en Stripe (DOP)
   b. Cliente ingresa datos
   c. Stripe procesa
   d. Webhook confirma

5. Sistema registra pago exitoso
   a. Payment.Status = "Completed"
   b. Session.Status = "Paid"

6. Generar NCF y Factura
   a. NCF Manager genera: E320000000456
   b. Crear registro en Invoices
   c. Crear InvoiceItems
   d. Generar PDF
   e. Generar XML

7. Enviar a DGII
   └─→ POST a portal e-factura

8. Distribuir propinas
   a. Propina Legal: RD$ 247.80
   b. Retención ISR 10%: RD$ 24.78
   c. Neto empleados: RD$ 223.02
   d. Crear TipDistribution

9. Notificar y enviar comprobante
   a. Email con PDF adjunto
   b. WhatsApp (opcional)
   c. SMS (opcional)
```

---

## **📱 PANTALLAS DEL FLUJO DE PAGO**

### **Pantalla 1: Resumen de Cuenta**

```
┌─────────────────────────────────────┐
│ ⬅️ Tu Cuenta            Mesa 12     │
├─────────────────────────────────────┤
│                                     │
│ Mesa 12 - Sesión de 50 min         │
│ Mesero: Carlos Ruiz                 │
│                                     │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                     │
│ 🍽️ Consumo Total                    │
│                                     │
│ Subtotal:              RD$ 2,100.00 │
│ ITBIS (18%):           RD$   378.00 │
│ ━━━━━━━━━━━━━━━━━━━━━              │
│ Subtotal + ITBIS:      RD$ 2,478.00 │
│                                     │
│ Propina Legal (10%):   RD$   247.80 │
│ ⚠️ Obligatorio por ley              │
│                                     │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                     │
│ 💝 Propina Adicional (Opcional)     │
│ ○ Sin propina adicional             │
│ ○ 5%  (+ RD$ 123.90)               │
│ ○ 10% (+ RD$ 247.80)               │
│ ○ 15% (+ RD$ 371.70)               │
│ ○ Otro monto: _______              │
│                                     │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                     │
│ TOTAL A PAGAR:         RD$ 2,725.80 │
│                                     │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                     │
│ [💳 Pagar Ahora]                    │
│ [🔀 Dividir Cuenta]                 │
│ [📄 Solicitar Factura con RNC]      │
│                                     │
└─────────────────────────────────────┘
```

### **Pantalla 2: Solicitar Factura con RNC**

```
┌─────────────────────────────────────┐
│ ⬅️ Factura con RNC                  │
├─────────────────────────────────────┤
│                                     │
│ Para generar una Factura de Crédito│
│ Fiscal, ingresa los datos fiscales: │
│                                     │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                     │
│ 🏢 RNC o Cédula *                   │
│ ┌─────────────────────────────────┐ │
│ │ 131-123456-7                    │ │
│ └─────────────────────────────────┘ │
│ ✅ RNC válido                        │
│                                     │
│ 📝 Razón Social / Nombre *          │
│ ┌─────────────────────────────────┐ │
│ │ Mi Empresa SRL                  │ │
│ └─────────────────────────────────┘ │
│                                     │
│ 📍 Dirección                         │
│ ┌─────────────────────────────────┐ │
│ │ Av. Winston Churchill #123      │ │
│ └─────────────────────────────────┘ │
│                                     │
│ 📞 Teléfono                          │
│ ┌─────────────────────────────────┐ │
│ │ (809) 555-9999                  │ │
│ └─────────────────────────────────┘ │
│                                     │
│ 📧 Email *                           │
│ ┌─────────────────────────────────┐ │
│ │ facturacion@miempresa.com.do    │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                     │
│ NCF que se generará: e31            │
│ Tipo: Factura de Crédito Fiscal     │
│                                     │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                     │
│ [Cancelar]  [Continuar al Pago]     │
│                                     │
└─────────────────────────────────────┘
```

---

**Fecha de Creación:** 6 de Febrero, 2026  
**Versión:** 1.0  
**País:** República Dominicana 🇩🇴  
**Sistema:** e-CF (Comprobante Fiscal Electrónico)  
**Autoridad:** DGII (Dirección General de Impuestos Internos)  
**Stack:** .NET 9 + Entity Framework Core + SignalR

