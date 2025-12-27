# Sistema de Recordatorios de Citas

Este documento explica cómo funciona el sistema de recordatorios automáticos para las citas.

## Funcionamiento

El sistema envía recordatorios por SMS **24 horas antes** de cada cita a:
- **Cliente**: Recordatorio con detalles de la cita (propiedad, hora, dirección, quién lo atenderá)
- **Admin/Co-admin asignado**: Recordatorio con datos del cliente y ubicación

## Ejecución Manual

Para enviar recordatorios manualmente, puedes hacer una petición POST desde Postman o cualquier cliente HTTP:

```http
POST http://localhost:4000/api/appointments/reminders
Authorization: Bearer <tu-token-de-admin>
```

Respuesta:
```json
{
  "success": true,
  "appointmentsFound": 3,
  "remindersSent": 6
}
```

## Ejecución Automática con Cron (Windows)

### Opción 1: Usar el Programador de Tareas de Windows

1. Abre el **Programador de Tareas** (Task Scheduler)
2. Crea una **Nueva Tarea Básica**
3. Nombre: "Recordatorios de Citas FR"
4. Disparador: **Diariamente** a las **9:00 AM**
5. Acción: **Iniciar un programa**
   - Programa: `powershell.exe`
   - Argumentos: 
   ```
   -ExecutionPolicy Bypass -File "C:\ruta\a\send-reminders.ps1"
   ```

6. Crea el archivo `send-reminders.ps1`:

```powershell
# send-reminders.ps1
$token = "TU_TOKEN_DE_ADMIN_AQUI"
$url = "http://localhost:4000/api/appointments/reminders"

$headers = @{
    "Authorization" = "Bearer $token"
}

try {
    $response = Invoke-RestMethod -Uri $url -Method Post -Headers $headers
    Write-Host "✅ Recordatorios enviados: $($response.remindersSent) SMS"
    Write-Host "📅 Citas encontradas: $($response.appointmentsFound)"
} catch {
    Write-Host "❌ Error: $_"
}
```

### Opción 2: Script Node.js

Crea el archivo `scripts/sendReminders.js`:

```javascript
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const sendReminders = async () => {
    try {
        // Necesitas un token de admin válido
        const response = await axios.post(
            'http://localhost:4000/api/appointments/reminders',
            {},
            {
                headers: {
                    'Authorization': `Bearer ${process.env.ADMIN_TOKEN}`
                }
            }
        );
        
        console.log('✅ Recordatorios enviados:', response.data.remindersSent);
        console.log('📅 Citas encontradas:', response.data.appointmentsFound);
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
};

sendReminders();
```

Ejecutar manualmente:
```bash
node scripts/sendReminders.js
```

Programar con Windows Task Scheduler para ejecutar diariamente:
```
node "C:\ruta\a\proyecto\scripts\sendReminders.js"
```

## Opción 3: Usar node-cron (Integrado en el backend)

Si quieres que los recordatorios se ejecuten automáticamente mientras el backend está corriendo:

1. Instala node-cron:
```bash
npm install node-cron
```

2. Agrega en `backend/src/index.js`:

```javascript
import cron from 'node-cron';
import { sendAppointmentReminders } from './controllers/appointments.controller.js';

// Ejecutar todos los días a las 9:00 AM
cron.schedule('0 9 * * *', async () => {
    console.log('🔔 Ejecutando recordatorios automáticos...');
    await sendAppointmentReminders();
});
```

## Notas Importantes

- Los recordatorios solo se envían a citas **confirmadas** y **asignadas** a un admin/co-admin
- Solo se procesan citas que sean **exactamente 24 horas** después de la ejecución
- Twilio debe estar configurado correctamente con números verificados
- En cuenta trial de Twilio, solo funcionará con números verificados

## Formato del SMS

**Al Cliente:**
```
RECORDATORIO - FR Family Investments: Mañana [fecha] a las [hora] tienes cita para "[propiedad]". Te atenderá: [admin]. Dirección: [dirección].
```

**Al Admin/Co-admin:**
```
RECORDATORIO - Mañana [fecha] a las [hora] tienes cita asignada con [cliente] en "[propiedad]". Contacto: [teléfono].
```

## Troubleshooting

- **No se envían recordatorios**: Verifica que las citas tengan `assignedTo` configurado
- **Error de Twilio**: Verifica credenciales en `.env`
- **Números no verificados**: En cuenta trial, solo funcionan números verificados
