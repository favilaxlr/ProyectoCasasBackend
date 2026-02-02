// Prefer the Messaging Service SID once the A2P campaign is approved; fall back to the raw
// phone number so the current system keeps working while the registration is pending.
const hasMessagingService = () => Boolean(
    process.env.TWILIO_MESSAGING_SERVICE_SID && process.env.TWILIO_MESSAGING_SERVICE_SID.trim()
);

export const getTwilioSenderConfig = () => {
    if (hasMessagingService()) {
        return { messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID };
    }

    return { from: process.env.TWILIO_PHONE_NUMBER };
};
