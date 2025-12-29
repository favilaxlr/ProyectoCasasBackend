import twilio from 'twilio';
import User from '../models/user.models.js';
import Role from '../models/roles.models.js';
import Notification from '../models/notification.models.js';
import dotenv from 'dotenv';

dotenv.config();

// Configurar Twilio solo si las credenciales están disponibles
let client = null;
const TWILIO_ENABLED = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_ACCOUNT_SID !== 'your_account_sid_here';

if (TWILIO_ENABLED) {
    try {
        client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        console.log('✅ Twilio configurado correctamente');
    } catch (error) {
        console.error('❌ Error configurando Twilio:', error.message);
        console.log('💡 El sistema funcionará en modo mock (sin enviar SMS reales)');
    }
} else {
    console.log('💡 Modo MOCK activado: Se simularán envíos de SMS');
}

// Configuración del sistema
const BATCH_SIZE = 50; // Mensajes por lote
const BATCH_INTERVAL = 1000; // 1 segundo entre lotes
const MAX_RETRIES = 3;
const MAX_PROCESSING_TIME = 10 * 60 * 1000; // 10 minutos

// Plantilla de mensaje para nuevas propiedades (optimizada para SMS)
const generatePropertyMessage = (property) => {
    const baseUrl = process.env.BASE_URL_FRONTEND || 'http://localhost:5173';
    const price = property.price?.sale ? `$${Math.round(property.price.sale / 1000)}K` : 'N/A';
    const beds = property.details?.bedrooms || 'N/A';
    const baths = property.details?.bathrooms || 'N/A';
    return `🏠 New property: ${property.title}\n${price} | ${beds}bed ${baths}bath\n${property.address?.city || 'Dallas'}\n${baseUrl}/properties/${property._id}`;
};

// Función para enviar SMS individual con reintentos (con soporte para modo mock)
const sendSMSWithRetry = async (phone, message, retries = MAX_RETRIES) => {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            // Si Twilio está disponible, enviar SMS real
            if (client && TWILIO_ENABLED) {
                const result = await client.messages.create({
                    body: message,
                    from: process.env.TWILIO_PHONE_NUMBER,
                    to: phone
                });
                console.log(`📱 SMS enviado a ${phone} - SID: ${result.sid} - Status: ${result.status}`);
                return { success: true, phone, mode: 'twilio', sid: result.sid, status: result.status };
            } else {
                // Modo mock: simular envío exitoso el 95% de las veces
                const mockSuccess = Math.random() > 0.05;
                if (mockSuccess) {
                    // Simular latencia de red
                    await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
                    return { success: true, phone, mode: 'mock' };
                } else {
                    throw new Error('Simulación de fallo en modo mock');
                }
            }
        } catch (error) {
            console.error(`❌ Error enviando SMS a ${phone} (intento ${attempt}/${retries}):`, error.message);
            if (attempt === retries) {
                return { 
                    success: false, 
                    phone, 
                    error: error.message || 'Error desconocido',
                    mode: TWILIO_ENABLED ? 'twilio' : 'mock'
                };
            }
            // Esperar antes del siguiente intento
            await new Promise(resolve => setTimeout(resolve, 500 * attempt));
        }
    }
};

// Función para procesar lotes de usuarios
const processBatch = async (users, message) => {
    const results = await Promise.all(
        users.map(user => 
            sendSMSWithRetry(user.phone, message).then(result => ({
                ...result,
                user: {
                    id: user._id,
                    username: user.username,
                    phone: user.phone
                }
            }))
        )
    );
    
    return {
        sent: results.filter(r => r.success),
        failed: results.filter(r => !r.success),
        all: results
    };
};

// Función principal para envío masivo
export const sendMassNotification = async (property, createdBy) => {
    const startTime = new Date();
    let notification;
    
    try {
        // 1. Obtener el ObjectId del rol 'admin' para excluirlo
        const adminRole = await Role.findOne({ role: 'admin' });
        const adminRoleId = adminRole?._id;
        
        // 2. Obtener todos los usuarios VERIFICADOS con teléfono válido (excluyendo admins)
        const userQuery = {
            phone: { $exists: true, $ne: '' },
            isEmailVerified: true,
            isPhoneVerified: true
        };
        
        // Solo excluir admins si encontramos el rol
        if (adminRoleId) {
            userQuery.role = { $ne: adminRoleId };
        }
        
        const users = await User.find(userQuery).select('phone username');

        if (users.length === 0) {
            throw new Error('No hay usuarios verificados para notificar');
        }

        // 3. Generar mensaje
        const message = generatePropertyMessage(property);

        console.log('\n📢 ============================================');
        console.log('🏠 Iniciando envío de notificaciones masivas...');
        console.log(`📊 Total usuarios a notificar: ${users.length}`);
        console.log(`📝 Mensaje: ${message.substring(0, 50)}...`);
        console.log('📢 ============================================\n');

        // 4. Crear registro de notificación
        notification = new Notification({
            type: 'new_property',
            property: property._id,
            message,
            stats: {
                totalUsers: users.length,
                sentCount: 0,
                failedCount: 0,
                invalidNumbers: []
            },
            results: [],
            status: 'in_progress',
            createdBy,
            processingTime: {
                startedAt: startTime
            }
        });

        await notification.save();

        // 5. Procesar en lotes
        let totalSent = 0;
        let totalFailed = 0;
        const invalidNumbers = [];
        const allResults = [];

        for (let i = 0; i < users.length; i += BATCH_SIZE) {
            // Verificar tiempo máximo de procesamiento
            if (Date.now() - startTime.getTime() > MAX_PROCESSING_TIME) {
                throw new Error('Tiempo máximo de procesamiento excedido');
            }

            const batch = users.slice(i, i + BATCH_SIZE);
            const batchResults = await processBatch(batch, message);

            totalSent += batchResults.sent.length;
            totalFailed += batchResults.failed.length;
            allResults.push(...batchResults.all);
            
            // Registrar números inválidos
            batchResults.failed.forEach(failed => {
                invalidNumbers.push({
                    phone: failed.phone,
                    error: failed.error
                });
                console.log(`❌ Fallo: ${failed.user?.username} (${failed.phone}) - ${failed.error}`);
            });

            // Log de éxitos
            batchResults.sent.forEach(sent => {
                console.log(`✅ Enviado: ${sent.user?.username} (${sent.phone})`);
            });

            // Actualizar progreso en base de datos
            await Notification.findByIdAndUpdate(notification._id, {
                'stats.sentCount': totalSent,
                'stats.failedCount': totalFailed,
                'stats.invalidNumbers': invalidNumbers,
                results: allResults
            });

            // Pausa entre lotes (excepto en el último)
            if (i + BATCH_SIZE < users.length) {
                await new Promise(resolve => setTimeout(resolve, BATCH_INTERVAL));
            }
        }

        // 6. Finalizar proceso
        const endTime = new Date();
        const duration = Math.round((endTime.getTime() - startTime.getTime()) / 1000);

        await Notification.findByIdAndUpdate(notification._id, {
            status: 'completed',
            'stats.sentCount': totalSent,
            'stats.failedCount': totalFailed,
            'stats.invalidNumbers': invalidNumbers,
            results: allResults,
            'processingTime.completedAt': endTime,
            'processingTime.duration': duration
        });

        console.log('\n📢 ============================================');
        console.log('✅ Notificaciones completadas');
        console.log(`📊 Enviados: ${totalSent}/${users.length}`);
        console.log(`❌ Fallidos: ${totalFailed}/${users.length}`);
        console.log(`⏱️  Duración: ${duration}s`);
        console.log('📢 ============================================\n');

        return {
            success: true,
            notificationId: notification._id,
            stats: {
                totalUsers: users.length,
                sent: totalSent,
                failed: totalFailed,
                duration
            }
        };

    } catch (error) {
        console.error('Error en envío masivo:', error);
        
        // Marcar como fallido si existe el registro
        if (notification) {
            const endTime = new Date();
            const duration = Math.round((endTime.getTime() - startTime.getTime()) / 1000);
            
            await Notification.findByIdAndUpdate(notification._id, {
                status: 'failed',
                'processingTime.completedAt': endTime,
                'processingTime.duration': duration
            });
        }

        throw error;
    }
};

// Función para obtener estadísticas de notificaciones
export const getNotificationStats = async () => {
    const totalUsers = await User.countDocuments({
        phone: { $exists: true, $ne: '' }
    });

    const recentNotifications = await Notification.find()
        .populate('property', 'title')
        .populate('createdBy', 'username')
        .sort({ createdAt: -1 })
        .limit(10);

    return {
        totalUsers,
        recentNotifications
    };
};

// Función para reenviar a destinatarios fallidos
export const resendFailedNotifications = async (notificationId) => {
    const notification = await Notification.findById(notificationId)
        .populate('property');

    if (!notification || notification.stats.invalidNumbers.length === 0) {
        throw new Error('No hay destinatarios fallidos para reenviar');
    }

    const message = notification.message;
    const failedNumbers = notification.stats.invalidNumbers.map(item => ({ phone: item.phone }));

    const batchResults = await processBatch(failedNumbers, message);

    // Actualizar estadísticas
    const newSentCount = notification.stats.sentCount + batchResults.sent.length;
    const newFailedCount = notification.stats.failedCount - batchResults.sent.length + batchResults.failed.length;
    
    const updatedInvalidNumbers = batchResults.failed.map(failed => ({
        phone: failed.phone,
        error: failed.error
    }));

    await Notification.findByIdAndUpdate(notificationId, {
        'stats.sentCount': newSentCount,
        'stats.failedCount': newFailedCount,
        'stats.invalidNumbers': updatedInvalidNumbers
    });

    return {
        success: true,
        resent: batchResults.sent.length,
        stillFailed: batchResults.failed.length
    };
};