import twilio from 'twilio';
import User from '../models/user.models.js';
import Role from '../models/roles.models.js';
import Notification from '../models/notification.models.js';
import dotenv from 'dotenv';
import { getTwilioSenderConfig } from '../libs/twilioSender.js';

dotenv.config();

// Configure Twilio only if credentials are present
let client = null;
const TWILIO_ENABLED = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_ACCOUNT_SID !== 'your_account_sid_here';

if (TWILIO_ENABLED) {
    try {
        client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        console.log('✅ Twilio configured successfully');
    } catch (error) {
        console.error('❌ Error configuring Twilio:', error.message);
        console.log('💡 System will run in mock mode (no real SMS)');
    }
} else {
    console.log('💡 Mock mode enabled: SMS deliveries will be simulated');
}

// Configuración del sistema
const BATCH_SIZE = 50; // Mensajes por lote
const BATCH_INTERVAL = 1000; // 1 segundo entre lotes
const MAX_RETRIES = 3;
const MAX_PROCESSING_TIME = 10 * 60 * 1000; // 10 minutos

// Message template for new properties (SMS optimized, formal tone)
const generatePropertyMessage = (property) => {
    const baseUrl = process.env.BASE_URL_FRONTEND || 'http://localhost:5173';
    const price = property.price?.sale ? `$${property.price.sale.toLocaleString()}` : 'Price upon request';
    const beds = property.details?.bedrooms || 'N/A';
    const baths = property.details?.bathrooms || 'N/A';
    return `FR Family Investments - New Property Available\n\n${property.title}\nPrice: ${price}\nBedrooms: ${beds} | Bathrooms: ${baths}\nLocation: ${property.address?.city || 'Dallas'}\n\nView details: ${baseUrl}/properties/${property._id}`;
};

// Message template for properties that become available again
const generateAvailableAgainMessage = (property) => {
    const baseUrl = process.env.BASE_URL_FRONTEND || 'http://localhost:5173';
    const price = property.price?.sale ? `$${property.price.sale.toLocaleString()}` : 'Price upon request';
    const beds = property.details?.bedrooms || 'N/A';
    const baths = property.details?.bathrooms || 'N/A';
    return `FR Family Investments - Property Available Again\n\n${property.title}\nPrice: ${price}\nBedrooms: ${beds} | Bathrooms: ${baths}\nLocation: ${property.address?.city || 'Dallas'}\n\nView details: ${baseUrl}/properties/${property._id}`;
};

// Send an individual SMS with retry + mock support
const sendSMSWithRetry = async (phone, message, retries = MAX_RETRIES) => {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            // Si Twilio está disponible, enviar SMS real
            if (client && TWILIO_ENABLED) {
                const result = await client.messages.create({
                    body: message,
                    to: phone,
                    ...getTwilioSenderConfig()
                });
                console.log(`📱 SMS sent to ${phone} - SID: ${result.sid} - Status: ${result.status}`);
                return { success: true, phone, mode: 'twilio', sid: result.sid, status: result.status };
            } else {
                // Mock mode: 95% success rate simulation
                const mockSuccess = Math.random() > 0.05;
                if (mockSuccess) {
                    // Simulate network latency
                    await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
                    return { success: true, phone, mode: 'mock' };
                } else {
                    throw new Error('Mock failure simulation');
                }
            }
        } catch (error) {
            console.error(`❌ Error sending SMS to ${phone} (attempt ${attempt}/${retries}):`, error.message);
            if (attempt === retries) {
                return { 
                    success: false, 
                    phone, 
                    error: error.message || 'Unknown error',
                    mode: TWILIO_ENABLED ? 'twilio' : 'mock'
                };
            }
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, 500 * attempt));
        }
    }
};

// Process a batch of users
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

// Notify when a property becomes available again
export const sendPropertyAvailableNotification = async (property, changedBy) => {
    const message = generateAvailableAgainMessage(property);
    return await sendMassNotification(property, changedBy, message, 'available_again');
};

// Main mass-notification workflow
export const sendMassNotification = async (property, createdBy, customMessage = null, notificationType = 'new_property') => {
    const startTime = new Date();
    let notification;
    
    try {
        // 1. Fetch the 'admin' role ID to exclude admins
        const adminRole = await Role.findOne({ role: 'admin' });
        const adminRoleId = adminRole?._id;
        
        // 2. Load verified users with valid phone numbers (excluding admins)
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
            throw new Error('No verified users to notify');
        }

        // 3. Build message template
        const message = generatePropertyMessage(property);

        console.log('\n📢 ============================================');
        console.log('🏠 Starting mass SMS notification batch...');
        console.log(`📊 Users to notify: ${users.length}`);
        console.log(`📝 Message: ${message.substring(0, 50)}...`);
        console.log('📢 ============================================\n');

        // 4. Create notification record
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

        // 5. Process in batches
        let totalSent = 0;
        let totalFailed = 0;
        const invalidNumbers = [];
        const allResults = [];

        for (let i = 0; i < users.length; i += BATCH_SIZE) {
            // Enforce max processing time
            if (Date.now() - startTime.getTime() > MAX_PROCESSING_TIME) {
                throw new Error('Maximum processing time exceeded');
            }

            const batch = users.slice(i, i + BATCH_SIZE);
            const batchResults = await processBatch(batch, message);

            totalSent += batchResults.sent.length;
            totalFailed += batchResults.failed.length;
            allResults.push(...batchResults.all);
            
            // Track invalid numbers
            batchResults.failed.forEach(failed => {
                invalidNumbers.push({
                    phone: failed.phone,
                    error: failed.error
                });
                console.log(`❌ Failed: ${failed.user?.username} (${failed.phone}) - ${failed.error}`);
            });

            // Success log
            batchResults.sent.forEach(sent => {
                console.log(`✅ Sent: ${sent.user?.username} (${sent.phone})`);
            });

            // Actualizar progreso en base de datos
            await Notification.findByIdAndUpdate(notification._id, {
                'stats.sentCount': totalSent,
                'stats.failedCount': totalFailed,
                'stats.invalidNumbers': invalidNumbers,
                results: allResults
            });

            // Pause between batches (except final batch)
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
        console.log('✅ Notifications completed');
        console.log(`📊 Sent: ${totalSent}/${users.length}`);
        console.log(`❌ Failed: ${totalFailed}/${users.length}`);
        console.log(`⏱️  Duration: ${duration}s`);
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
        console.error('Error during mass notification:', error);
        
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
        throw new Error('No failed recipients to retry');
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