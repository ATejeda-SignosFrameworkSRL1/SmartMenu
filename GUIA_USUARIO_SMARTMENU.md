# Guía de Usuario de SmartMenu

Esta guía explica, paso a paso y en lenguaje sencillo, cómo usar SmartMenu en un restaurante. Está pensada para personas que no conocen el sistema y necesitan entender qué hace cada pantalla, qué botón usar y en qué orden trabajar.

## 1. ¿Qué es SmartMenu?

SmartMenu es un sistema digital para manejar las operaciones principales de un restaurante:

- Los clientes ven el menú desde su celular escaneando un código QR.
- Los clientes pueden crear órdenes desde la mesa.
- Los meseros ven las órdenes, atienden mesas y procesan pagos.
- Cocina y bar reciben los pedidos en pantalla.
- Caja registra ventas directas y revisa los pagos del día.
- El host o recepcionista gestiona mesas y reservas.
- El administrador configura menú, mesas, usuarios, reportes y mantenimiento.

En resumen: SmartMenu conecta cliente, mesero, cocina, bar, caja, host y administración en un solo flujo.

## 2. Cómo entrar al sistema

### 2.1. Abrir el sistema

Si estás en la computadora donde corre el sistema, abre el navegador y entra a:

```text
http://localhost:3000/login
```

También puedes abrir directamente cada módulo:

| Módulo | Dirección |
| --- | --- |
| Cliente / QR | `http://localhost:3000` |
| Login empleados | `http://localhost:3000/login` |
| Administración | `http://localhost:3001` |
| Cocina / KDS | `http://localhost:3002` |
| Mesero | `http://localhost:3003` |
| Host / Recepción | `http://localhost:3004` |
| Caja | `http://localhost:3005` |
| Reservas públicas | `http://localhost:3007` |
| API / Swagger | `http://localhost:5041/swagger` |

> Nota: En celulares o equipos de la red local, la dirección puede cambiar de `localhost` a la IP de la computadora donde está corriendo SmartMenu.

### 2.2. Iniciar sesión

1. Entra a `http://localhost:3000/login`.
2. Escribe tu correo.
3. Escribe tu contraseña.
4. Presiona **Iniciar Sesión**.
5. El sistema te llevará automáticamente al módulo que corresponde a tu rol.

### 2.3. Usuarios de prueba

Estos usuarios sirven para probar el sistema en ambiente local:

| Rol | Usuario | Contraseña |
| --- | --- | --- |
| Administrador | `admin@smartmenu.com` | `Admin123!` |
| Chef | `chef@smartmenu.com` | `Chef123!` |
| Bar | `bar@smartmenu.com` | `Bar123!` |
| Mesero | `waiter@smartmenu.com` | `Waiter123!` |
| Host | `host@smartmenu.com` | `Host123!` |
| Cajero | `cashier@smartmenu.com` | `Cash123!` |

## 3. Vista general del flujo del restaurante

El flujo normal de trabajo es este:

1. El administrador configura zonas, mesas, usuarios y menú.
2. El cliente escanea el QR de su mesa.
3. El cliente revisa el menú y confirma su orden.
4. El mesero revisa o reclama la mesa si aplica.
5. Cocina y bar reciben la orden.
6. Cocina o bar marcan los productos como preparados/listos.
7. El mesero sirve la orden.
8. El cliente solicita la cuenta o el mesero procesa el cobro.
9. Caja puede revisar los pagos y registrar ventas.
10. Administración revisa reportes, órdenes y estado general.

## 4. Módulo de Cliente

El módulo de cliente es el que usa la persona sentada en la mesa.

### 4.1. Entrar desde un QR

1. El cliente escanea el código QR de la mesa.
2. Se abre SmartMenu en el navegador del celular.
3. El sistema identifica la mesa.
4. El cliente entra al menú digital.

Si el QR no funciona o la mesa no se encuentra, el sistema mostrará un mensaje indicando que la mesa no fue encontrada.

### 4.2. Ver el menú

En el menú el cliente puede:

- Buscar platos por nombre.
- Filtrar por categoría.
- Ver descripción, precio e imagen del plato.
- Ver etiquetas como vegetariano, vegano o sin gluten si están configuradas.
- Agregar productos al carrito.

Pasos:

1. Revisa las categorías del menú.
2. Busca el plato deseado.
3. Presiona el botón para agregarlo al carrito.
4. Repite el proceso hasta completar la orden.
5. Presiona el ícono del carrito para revisar.

### 4.3. Revisar el carrito

En el carrito el cliente puede:

- Ver todos los platos seleccionados.
- Subir o bajar cantidades.
- Eliminar productos.
- Agregar instrucciones especiales.
- Revisar subtotal, ITBIS, propina legal y total.

Pasos:

1. Entra al carrito.
2. Revisa que los platos y cantidades estén correctos.
3. Agrega instrucciones si necesitas algo especial.
4. Revisa el resumen del cobro.
5. Presiona **Confirmar Orden**.

### 4.4. Seguimiento de la orden

Después de confirmar, el cliente ve el estado de su orden.

El sistema puede mostrar estados como:

- Orden recibida.
- En preparación.
- Lista.
- Servida.

Si el cliente quiere pedir más comida, puede volver al menú y agregar productos a su orden existente.

### 4.5. Solicitar la cuenta

Cuando el cliente desea pagar:

1. Entra a la pantalla de pago desde su orden.
2. Revisa el resumen.
3. Elige método de pago:
   - Efectivo.
   - Tarjeta.
   - Transferencia.
   - Mixto.
4. Si necesita comprobante fiscal, marca la opción correspondiente.
5. Escribe el RNC y valida los datos.
6. Envía la solicitud.
7. Espera al mesero para completar el pago.

## 5. Módulo de Mesero

El módulo de mesero se usa para atender mesas, dar seguimiento a pedidos y cobrar.

### 5.1. Entrar como mesero

1. Entra al login.
2. Usa un usuario con rol de mesero.
3. El sistema abrirá la app de mesero.

### 5.2. Ver órdenes y mesas

El mesero puede ver:

- Órdenes generales.
- Órdenes asignadas a él.
- Estado de cada mesa.
- Pedidos pendientes.
- Pedidos listos para servir.
- Solicitudes de cobro.

### 5.3. Reclamar o tomar una mesa

Si una mesa necesita ser atendida:

1. Busca la mesa en la vista del mesero.
2. Selecciona la opción para reclamar o tomar la mesa.
3. Espera aprobación si el sistema la requiere.
4. Cuando la mesa esté asignada, aparecerá dentro de tus mesas.

### 5.4. Dar seguimiento a una orden

1. Abre la orden.
2. Revisa los productos pedidos.
3. Observa si cocina o bar ya marcaron los productos como listos.
4. Cuando esté listo, sirve la orden.
5. Actualiza el estado según corresponda.

### 5.5. Procesar un pago

Cuando una mesa pide la cuenta:

1. Abre la orden o solicitud de cobro.
2. Verifica el total.
3. Selecciona el método de pago.
4. Agrega propina si corresponde.
5. Si el pago es mixto, divide los montos por efectivo, tarjeta o transferencia.
6. Confirma el pago.
7. El sistema marca la orden como completada.

### 5.6. Transferir mesa u orden

Si otro mesero atenderá la mesa:

1. Abre la opción de transferencia.
2. Selecciona la mesa u orden.
3. Elige el mesero destino.
4. Confirma la transferencia.

Esto ayuda cuando un mesero termina turno o cambia de zona.

## 6. Módulo de Cocina / KDS

KDS significa Kitchen Display System. Es la pantalla que usa cocina para ver qué preparar.

### 6.1. Entrar como cocina

1. Inicia sesión con usuario de chef o personal de cocina.
2. El sistema abre la pantalla de cocina.

### 6.2. Ver pedidos

La cocina ve las órdenes activas que ya fueron confirmadas.

Cada orden muestra información como:

- Número de orden.
- Mesa.
- Tiempo desde que entró.
- Platos.
- Cantidad.
- Notas especiales.
- Alergias o personalizaciones.

### 6.3. Filtrar por curso

Los productos pueden estar organizados por momento del servicio:

- Entrada.
- Plato fuerte.
- Postre.

Esto permite preparar los platos en el orden correcto.

### 6.4. Marcar preparación

Pasos típicos:

1. Revisa la orden nueva.
2. Empieza a preparar los productos.
3. Marca la orden o producto como en preparación si aplica.
4. Cuando esté listo, marca como listo.
5. El mesero verá que puede recoger y servir.

## 7. Módulo de Bar

El bar funciona parecido a cocina, pero enfocado en bebidas.

### 7.1. Qué ve el bar

El bar recibe productos identificados como bebidas, por ejemplo:

- Agua.
- Refrescos.
- Vino.
- Cerveza.
- Cócteles.
- Jugos.
- Tragos.

### 7.2. Flujo del bar

1. Entra con usuario de bar.
2. Revisa la cola de bebidas.
3. Prepara la bebida.
4. Marca como lista.
5. El mesero recoge y entrega.

## 8. Módulo de Host / Recepción

El host o recepcionista gestiona la llegada de clientes, mesas y reservas.

### 8.1. Entrar como host

1. Inicia sesión con usuario de host.
2. El sistema abre la app de recepción.

### 8.2. Ver mesas

El host puede ver las mesas por zona y estado.

Estados comunes:

- Disponible.
- Ocupada.
- Reservada.
- Limpieza.
- Por cobrar.

### 8.3. Asignar una mesa

1. Busca una mesa disponible.
2. Selecciona la mesa.
3. Indica cantidad de personas.
4. Agrega notas si aplica.
5. Confirma la asignación.

### 8.4. Gestionar reservas

En la sección de reservas el host puede:

- Ver reservas pendientes.
- Ver reservas confirmadas.
- Aceptar reservas.
- Rechazar reservas.
- Revisar datos del cliente.
- Ver fecha, hora y cantidad de personas.
- Revisar notas especiales.
- Revisar pre-orden si el cliente reservó platos por adelantado.

### 8.5. Confirmar una reserva

1. Entra a la pestaña de reservas.
2. Abre la reserva pendiente.
3. Revisa fecha, hora, cliente y cantidad de personas.
4. Presiona la opción para confirmar.
5. La mesa queda reservada según la configuración.

## 9. Portal público de Reservas

Este portal lo usa el cliente desde internet o desde una pantalla pública.

Dirección local:

```text
http://localhost:3007
```

### 9.1. Hacer una reserva

1. Entra al portal de reservas.
2. Presiona **Reservar Ahora**.
3. Completa los datos:
   - Nombre.
   - Teléfono.
   - Correo si aplica.
   - Fecha.
   - Hora.
   - Cantidad de personas.
   - Solicitudes especiales.
4. Selecciona una mesa disponible si el sistema la muestra.
5. Envía la reserva.
6. El host recibirá la solicitud.

### 9.2. Pre-orden en reserva

Si está disponible, el cliente puede agregar platos antes de llegar.

Esto permite que el restaurante se prepare con anticipación.

## 10. Módulo de Caja

Caja sirve para registrar ventas, revisar pagos y manejar comprobantes fiscales.

### 10.1. Entrar como cajero

1. Inicia sesión con usuario de cajero.
2. El sistema abre la pantalla de caja.

### 10.2. Caja del día

En **Caja del día** puedes ver:

- Total vendido.
- Total de propinas.
- Ventas netas.
- Cantidad de transacciones.
- Ventas por método de pago.
- Pagos con comprobante fiscal.
- Movimientos del día.

Pasos:

1. Selecciona la fecha.
2. Presiona **Actualizar**.
3. Revisa los totales y movimientos.

### 10.3. Nueva venta

Caja también puede crear una venta directa.

Pasos:

1. Entra a la pestaña de nueva venta.
2. Busca productos del menú.
3. Agrega productos a la orden.
4. Revisa cantidades.
5. Elige método de pago.
6. Indica si requiere comprobante fiscal.
7. Confirma la venta.

### 10.4. Agregar NCF o comprobante fiscal

Si un pago necesita comprobante:

1. Abre el movimiento.
2. Presiona la opción para agregar NCF o datos fiscales.
3. Escribe el RNC.
4. Valida el RNC.
5. Confirma el negocio o razón social.
6. Guarda.

## 11. Panel de Administración

El panel de administración controla la configuración y supervisión general.

Dirección local:

```text
http://localhost:3001
```

### 11.1. Dashboard

El dashboard muestra una vista rápida del restaurante:

- Mesas disponibles.
- Mesas ocupadas.
- Pedidos en cocina.
- Platillos activos.
- Órdenes activas.
- Ventas del día.
- Ticket promedio.
- Tiempo promedio.

Úsalo para entender rápidamente cómo está operando el restaurante.

### 11.2. Órdenes

La sección de órdenes permite supervisar pedidos activos y sus estados.

Sirve para:

- Ver qué órdenes están pendientes.
- Ver qué órdenes están en preparación.
- Ver órdenes listas o servidas.
- Dar seguimiento operativo.

### 11.3. Menú

En gestión de menú puedes administrar platos.

Acciones comunes:

- Crear un plato.
- Editar nombre, descripción y precio.
- Subir imagen.
- Asignar categoría.
- Marcar disponibilidad.
- Asignar zona de cocina o bar.
- Eliminar platos si corresponde.

Pasos para crear un plato:

1. Entra a **Menú**.
2. Presiona la opción para crear o agregar.
3. Llena los datos del plato.
4. Selecciona categoría.
5. Define precio.
6. Agrega imagen si aplica.
7. Marca si está disponible.
8. Guarda.

### 11.4. Mesas

En la sección de mesas puedes:

- Ver todas las mesas.
- Filtrar por zona.
- Filtrar por estado.
- Crear mesas.
- Ver o descargar QR.
- Cambiar estado de mesa.
- Eliminar mesas.

Pasos para crear una mesa:

1. Entra a **Mesas**.
2. Presiona **Crear mesa** o la opción equivalente.
3. Escribe el número de mesa.
4. Indica la capacidad.
5. Selecciona la zona.
6. Guarda.
7. Imprime o descarga el QR para colocarlo en la mesa.

### 11.5. Cocina (KDS)

Desde administración también puedes revisar la cola de cocina.

Úsalo si necesitas supervisar pedidos sin entrar como chef.

### 11.6. Bar

La sección de bar muestra la cola de bebidas.

Úsala para supervisar o apoyar el trabajo del personal de bar.

### 11.7. Reservas

Permite revisar las reservas del restaurante.

Acciones comunes:

- Ver reservas pendientes.
- Confirmar reservas.
- Cancelar o rechazar reservas.
- Ver detalles del cliente.
- Ver fecha, hora y cantidad de personas.

### 11.8. Mantenimiento

En mantenimiento se configuran estructuras importantes del restaurante.

Puedes administrar:

- Zonas de mesas.
- Cocinas.
- Bares.
- Tags o etiquetas de platos.
- Relación de mesas con zonas.

Ejemplos de zonas:

- Terraza.
- Salón principal.
- VIP.
- Cocina caliente.
- Cocina fría.
- Bar principal.

### 11.9. Usuarios

En usuarios puedes crear y administrar el personal.

Roles comunes:

- Admin.
- Manager.
- Chef.
- KitchenStaff.
- Waiter.
- Host.
- Cashier.
- Customer.

Pasos para crear un usuario:

1. Entra a **Usuarios**.
2. Presiona crear usuario.
3. Llena nombre, apellido, correo y teléfono.
4. Asigna una contraseña.
5. Selecciona el rol.
6. Si aplica, asigna zona de cocina, bar o servicio.
7. Guarda.

### 11.10. Reportes

Reportes sirve para revisar información de desempeño.

Puede incluir:

- Ventas.
- Órdenes.
- Tiempos promedio.
- Rendimiento de platos.
- Información operativa del restaurante.

## 12. Estados importantes del sistema

### 12.1. Estados de mesa

| Estado | Qué significa |
| --- | --- |
| Disponible | La mesa está libre. |
| Ocupada | Hay clientes usando la mesa. |
| Reservada | La mesa está apartada para una reserva. |
| Limpieza | La mesa está en proceso de limpieza. |
| Por cobrar | El cliente solicitó cuenta o está pendiente de pago. |

### 12.2. Estados de orden

| Estado | Qué significa |
| --- | --- |
| Pendiente | La orden fue creada, pero todavía no está confirmada para producción. |
| Confirmada | La orden ya puede entrar a cocina o bar. |
| En preparación | Cocina o bar está preparando. |
| Lista | Ya está lista para servir. |
| Servida | El mesero ya entregó al cliente. |
| Completada | La orden fue pagada y cerrada. |
| Cancelada | La orden fue anulada. |

## 13. Flujo recomendado para una operación real

### 13.1. Antes de abrir el restaurante

1. El administrador entra al panel.
2. Revisa que el menú esté actualizado.
3. Verifica que los platos disponibles estén activos.
4. Revisa zonas y mesas.
5. Confirma que cada mesa tenga su QR correcto.
6. Crea o activa usuarios del personal.

### 13.2. Durante el servicio

1. Host asigna mesas y confirma reservas.
2. Cliente escanea QR y ordena.
3. Mesero monitorea mesas y órdenes.
4. Cocina prepara comida.
5. Bar prepara bebidas.
6. Mesero sirve.
7. Cliente pide cuenta.
8. Mesero o caja procesa el pago.

### 13.3. Al cerrar el día

1. Caja revisa **Caja del día**.
2. Administración revisa reportes.
3. Se verifican pagos con comprobante fiscal.
4. Se cierran órdenes pendientes.
5. Se revisan reservas futuras.

## 14. Consejos para usuarios nuevos

- Si no sabes dónde entrar, empieza en `http://localhost:3000/login`.
- Si eres cliente, normalmente no necesitas usuario: solo escaneas el QR.
- Si una pantalla no carga, espera unos segundos y actualiza.
- Si un usuario cae en el módulo equivocado, revisa su rol en administración.
- Si una orden no aparece en cocina, verifica que esté confirmada.
- Si una mesa no aparece para el host, revisa que esté asignada a una zona de mesas y no a cocina/bar.
- Si el comprobante fiscal falla, valida que el RNC esté bien escrito.

## 15. Problemas comunes y qué hacer

### No puedo iniciar sesión

Revisa:

1. Que el correo esté bien escrito.
2. Que la contraseña sea correcta.
3. Que el usuario esté activo.
4. Que el backend esté corriendo.

### El cliente escanea el QR y no aparece la mesa

Revisa:

1. Que la mesa exista en administración.
2. Que el QR corresponda a esa mesa.
3. Que el sistema cliente esté corriendo.

### Cocina no ve una orden

Revisa:

1. Que la orden haya sido confirmada.
2. Que el plato esté asignado a cocina.
3. Que el usuario de cocina tenga la zona correcta si usa zonas.

### Bar no ve una bebida

Revisa:

1. Que el producto esté configurado como bebida o asignado correctamente.
2. Que el usuario de bar esté entrando al módulo correcto.
3. Que la orden esté activa.

### No aparece una mesa en reservas

Revisa:

1. Que la mesa esté disponible.
2. Que tenga capacidad suficiente.
3. Que no esté reservada u ocupada en ese horario.
4. Que pertenezca a una zona de mesas.

### El pago no se completa

Revisa:

1. Que la orden exista.
2. Que el método de pago esté seleccionado.
3. Que el mesero o caja haya confirmado el cobro.
4. Que si requiere comprobante, el RNC esté validado.

## 16. Glosario rápido

| Palabra | Significado |
| --- | --- |
| QR | Código que el cliente escanea para abrir la mesa. |
| KDS | Pantalla de cocina donde aparecen los pedidos. |
| Orden | Pedido completo de una mesa. |
| Ítem | Un producto dentro de una orden. |
| ITBIS | Impuesto de República Dominicana, configurado como 18%. |
| Propina legal | Cargo legal de servicio, configurado como 10%. |
| RNC | Registro Nacional de Contribuyentes usado para comprobantes fiscales. |
| NCF | Número de Comprobante Fiscal. |
| Zona | Área del restaurante, cocina o bar. |
| Host | Persona que recibe clientes y gestiona mesas/reservas. |

## 17. Resumen rápido por rol

| Rol | Qué hace principalmente |
| --- | --- |
| Cliente | Escanea QR, ordena y solicita cuenta. |
| Mesero | Atiende mesas, da seguimiento y cobra. |
| Cocina | Prepara platos y marca estados. |
| Bar | Prepara bebidas y marca estados. |
| Host | Asigna mesas y gestiona reservas. |
| Cajero | Registra ventas y revisa pagos. |
| Admin | Configura y supervisa todo el sistema. |

## 18. Primer recorrido recomendado para aprender

Si estás aprendiendo SmartMenu desde cero, sigue este orden:

1. Entra como administrador.
2. Revisa las zonas en **Mantenimiento**.
3. Revisa las mesas en **Mesas**.
4. Revisa los usuarios en **Usuarios**.
5. Revisa el menú en **Menú**.
6. Abre el cliente y simula una orden.
7. Entra como cocina y marca la orden como lista.
8. Entra como mesero y sirve/cobra.
9. Entra como caja y revisa el movimiento.
10. Revisa el dashboard y reportes en administración.

Con este recorrido puedes entender el sistema completo sin tocar configuraciones avanzadas.
