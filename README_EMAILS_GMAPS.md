# Configuración de Emails y Google Maps

## 🚀 Cambios Realizados

### 1. Campo de Google Maps
- Se agregó un campo de URL de Google Maps en:
  - Panel de administración (Mi negocio)
  - Formulario de registro de barbería

**Cómo usarlo:**
1. Abre Google Maps
2. Busca tu barbería
3. Haz clic en "Compartir"
4. Copia el enlace y pégalo en el campo "Ubicación en Google Maps"

### 2. Envío de Emails de Confirmación
Cuando un barbero confirma una cita, el cliente recibe automáticamente un email con:
- Fecha y hora de la cita
- Servicio y precio
- Ubicación (con link a Google Maps si está configurado)
- Teléfono del negocio

## ⚙️ Configuración Requerida en Supabase

### Paso 1: Crear la Función Edge para Enviar Emails

1. En tu proyecto Supabase, ve a **Edge Functions**
2. Crea una nueva función llamada `send-email`
3. Reemplaza el contenido con el código del archivo `INSTRUCCIONES_EMAILS.md`

### Paso 2: Configurar Variables de Entorno

En tu proyecto Supabase, ve a **Settings > Secrets** y agrega:

```
SENDGRID_API_KEY=tu_clave_api_de_sendgrid
SENDER_EMAIL=tu_email@dominio.com
SMTP_HOST=smtp.sendgrid.net
SMTP_USER=apikey
SMTP_PASS=tu_clave_api_de_sendgrid
```

### Paso 3: Obtener Clave de SendGrid

1. Regístrate en [SendGrid](https://sendgrid.com)
2. Ve a **Settings > API Keys**
3. Crea una nueva API Key
4. Cópiala y pégala en las variables de entorno de Supabase

### Paso 4: Actualizar la Base de Datos

La tabla `negocios` necesita tener estos campos (deben crearse en Supabase):
```sql
ALTER TABLE negocios ADD COLUMN ubicacion_gmaps TEXT NULL;
```

Si usas la UI de Supabase:
1. Ve a la tabla `negocios`
2. Haz clic en "+" para agregar una columna
3. Nombre: `ubicacion_gmaps`
4. Tipo: `text`
5. Nullable: `true`

## 📝 Cambios en el Código

### admin.js
- Agregada función `enviarEmailConfirmacion(cita)` que:
  - Obtiene el email del cliente
  - Construye el HTML del email
  - Invoca la función edge `send-email`
- Modificada `cambiarEstado()` para llamar `enviarEmailConfirmacion()`
- Modificada `accionRapida()` para enviar emails en confirmaciones rápidas

### admin.html
- Agregado campo `edit-gmaps` en el formulario "Mi negocio"

### registro-negocio.js
- Agregada lectura del campo `neg-gmaps` en `guardarNegocio()`
- Agregado campo `ubicacion_gmaps` al insertar en BD

### registro-negocio.html
- Agregado campo de entrada para URL de Google Maps

### login.html, login.js
- Validaciones de campos mejoradas (ya estaban listos)

## 🔍 Pruebas

### Probar sin configurar SendGrid (desarrollo local)

Si aún no tienes SendGrid configurado, los emails no se enviarán pero:
1. El sistema mostrará un mensaje `"Cita confirmada (email no pudo ser enviado)"`
2. Aparecerá una advertencia en la consola del navegador
3. La confirmación de la cita funciona normalmente

### Probar con SendGrid

1. Completa todos los pasos de configuración arriba
2. Confirma una cita desde el panel de admin
3. Revisa la bandeja de entrada del cliente
4. El email debe llegar en 1-2 minutos

## 📧 Personalizaciones

Para cambiar el formato del email, edita la función `enviarEmailConfirmacion()` en `admin.js`. 
El HTML se construye en la variable `emailData`.

## 🆘 Solución de Problemas

**"Email no enviado":**
- Verifica que la función edge esté desplegada en Supabase
- Revisa que las variables de entorno estén correctamente configuradas
- Verifica que la clave de SendGrid sea válida

**Los emails no llegan:**
- Revisa la carpeta de spam/correo no deseado
- Verifica los logs de la función edge en Supabase
- Asegúrate de que el email del cliente sea válido

**Google Maps no aparece en el email:**
- Verifica que hayas ingresado una URL válida de Google Maps
- El formato debe ser como: `https://maps.google.com/?q=...`
