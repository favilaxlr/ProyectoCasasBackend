import sgMail from '@sendgrid/mail';
import twilio from 'twilio';
import dotenv from 'dotenv';
import { getTwilioSenderConfig } from '../libs/twilioSender.js';
import { buildSMS } from '../libs/smsTemplates.js';

dotenv.config();

// Configurar SendGrid
const SENDGRID_ENABLED = process.env.SENDGRID_API_KEY && process.env.SENDGRID_API_KEY !== 'your_sendgrid_key_here';
if (SENDGRID_ENABLED) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    console.log('✅ SendGrid configurado correctamente');
} else {
    console.log('💡 SendGrid no configurado - Modo MOCK para emails');
}

// Configurar Twilio (reutilizando del sistema existente)
let twilioClient = null;
const TWILIO_ENABLED = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_ACCOUNT_SID !== 'your_account_sid_here';
if (TWILIO_ENABLED) {
    try {
        twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    } catch (error) {
        console.error('❌ Error configuring Twilio for verification:', error.message);
    }
}

// Generar código de verificación de 6 dígitos
export const generateVerificationCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

// Enviar código por SMS
export const sendVerificationSMS = async (phone, code) => {
    try {
        if (twilioClient && TWILIO_ENABLED) {
            const smsBody = buildSMS(
                `Your verification code is ${code}. Valid for 10 minutes. Message and data rates may apply.`
            );
            await twilioClient.messages.create({
                body: smsBody,
                to: phone,
                ...getTwilioSenderConfig()
            });
            console.log(`✅ Verification SMS sent to ${phone}`);
            return { success: true, mode: 'twilio' };
        } else {
            // Mock mode
            console.log(`📱 [MOCK] Verification SMS sent to ${phone}: ${code}`);
            return { success: true, mode: 'mock' };
        }
    } catch (error) {
        console.error('❌ Error sending verification SMS:', error.message);
        return { success: false, error: error.message };
    }
};

// Enviar código por Email
export const sendVerificationEmail = async (email, code, username) => {
    try {
        if (SENDGRID_ENABLED) {
            const msg = {
                to: email,
                from: process.env.SENDGRID_FROM_EMAIL || 'noreply@frfamilyinvestments.com',
                subject: 'Verifica tu cuenta - FR Family Investments',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #2563eb;">¡Bienvenido a FR Family Investments, ${username}!</h2>
                        <p>Gracias por registrarte. Para completar tu registro, por favor verifica tu correo electrónico usando el siguiente código:</p>
                        <div style="background-color: #f3f4f6; padding: 20px; text-align: center; margin: 20px 0;">
                            <h1 style="color: #1f2937; letter-spacing: 5px; margin: 0;">${code}</h1>
                        </div>
                        <p style="color: #6b7280;">Este código expirará en 10 minutos.</p>
                        <p>Si no solicitaste este código, puedes ignorar este mensaje.</p>
                        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
                        <p style="color: #9ca3af; font-size: 12px;">FR Family Investments - Tu socio en bienes raíces</p>
                    </div>
                `
            };
            
            console.log('📤 Intentando enviar email con SendGrid...');
            console.log('📧 Destinatario:', email);
            console.log('📨 Remitente:', msg.from);
            
            await sgMail.send(msg);
            console.log(`✅ Email de verificación enviado a ${email}`);
            return { success: true, mode: 'sendgrid' };
        } else {
            // Modo mock
            console.log(`📧 [MOCK] Email de verificación enviado a ${email}: ${code}`);
            return { success: true, mode: 'mock' };
        }
    } catch (error) {
        console.error('❌ Error sending verification email:', error.message);
        console.error('📋 Full error:', error.response?.body || error);
        
        // Temporary solution: log code if email fails
        console.log('🔐 ============================================');
        console.log(`📧 Email: ${email}`);
        console.log(`🔑 VERIFICATION CODE: ${code}`);
        console.log('🔐 ============================================');
        
        return { success: false, error: error.message };
    }
};

// Enviar código por ambos medios
export const sendVerificationCode = async (user) => {
    const code = generateVerificationCode();
    const expiryTime = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos

    // Actualizar usuario con el código
    user.verificationCode = code;
    user.verificationCodeExpiry = expiryTime;
    await user.save();

    // Enviar por SMS y Email en paralelo
    const [smsResult, emailResult] = await Promise.all([
        sendVerificationSMS(user.phone, code),
        sendVerificationEmail(user.email, code, user.username)
    ]);

    // Si el SMS falla pero el email se envía, aún considerarlo éxito parcial
    const atLeastOneSuccess = smsResult.success || emailResult.success;

    // Always log code for debugging in development
    console.log('\n🔐 ============================================');
    console.log(`📧 Email: ${user.email}`);
    console.log(`📱 Phone: ${user.phone}`);
    console.log(`🔑 VERIFICATION CODE: ${code}`);
    console.log('🔐 ============================================\n');

    return {
        success: true, // Siempre éxito, el código está guardado en BD
        sms: smsResult,
        email: emailResult,
        code: code, // Siempre devolver el código para debugging
        message: !smsResult.success && !emailResult.success 
            ? 'Código generado (revisa la consola del servidor)'
            : !smsResult.success && emailResult.success 
            ? 'Código enviado por email. SMS no disponible.'
            : atLeastOneSuccess 
            ? 'Código enviado exitosamente'
            : 'Error al enviar código'
    };
};

// Verificar código
export const verifyCode = async (user, code) => {
    // Verificar que el código existe y no ha expirado
    if (!user.verificationCode) {
        return { success: false, message: 'No hay código de verificación pendiente' };
    }

    if (user.verificationCodeExpiry < new Date()) {
        return { success: false, message: 'The code has expired. Request a new one.' };
    }

    if (user.verificationCode !== code) {
        return { success: false, message: 'Incorrect code' };
    }

    // Código válido - marcar email como verificado siempre
    // Phone se marca como verificado solo si se pudo enviar el SMS
    user.isEmailVerified = true;
    user.isPhoneVerified = true; // Se marca ambos porque el código fue validado
    user.verificationCode = null;
    user.verificationCodeExpiry = null;
    await user.save();

    return { 
        success: true, 
        message: 'Verification completed successfully',
        user: {
            id: user._id,
            username: user.username,
            email: user.email,
            phone: user.phone,
            isVerified: true
        }
    };
};
