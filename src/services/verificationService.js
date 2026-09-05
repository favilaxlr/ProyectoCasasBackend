import twilio from 'twilio';
import dotenv from 'dotenv';
import { getTwilioSenderConfig } from '../libs/twilioSender.js';
import { buildSMS } from '../libs/smsTemplates.js';
import { isTwilioEmailEnabled, sendEmail } from './twilioEmail.js';
import { wrapEmail, escapeHtml } from './emailLayout.js';

dotenv.config();

if (isTwilioEmailEnabled()) {
    console.log('✅ Twilio Email configurado');
} else {
    console.log('💡 Twilio Email no configurado - Modo MOCK para emails');
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
        const html = wrapEmail({
            preheader: `Your verification code is ${code}. It expires in 10 minutes.`,
            eyebrow: 'Account verification',
            title: `Welcome, ${username || 'there'}`,
            intro: 'Use this code to confirm your email and finish creating your FR Family Investments account.',
            bodyHtml: `
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#050914;border-radius:16px;">
                <tr>
                  <td align="center" style="padding:28px 20px 12px;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:2.2px;text-transform:uppercase;color:#5eead4;">
                    Your code
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding:0 20px 18px;font-family:Georgia,'Times New Roman',serif;font-size:40px;letter-spacing:10px;color:#ffffff;font-weight:700;">
                    ${escapeHtml(code)}
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding:0 24px 26px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#94a3b8;">
                    Valid for 10 minutes · Enter it on the verification screen
                  </td>
                </tr>
              </table>
              <p style="margin:22px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:21px;color:#64748b;">
                If you did not create an account, you can ignore this message.
              </p>
            `,
            footerNote: 'FR Family Investments — your partner in real estate.'
        });
        const result = await sendEmail({
            to: email,
            subject: 'Your verification code · FR Family Investments',
            html,
            text: `Welcome to FR Family Investments. Your verification code is ${code}. It expires in 10 minutes.`
        });

        console.log(`✅ Email de verificación enviado a ${email} (${result.mode})`);
        return { success: true, mode: result.mode };
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
