const TWILIO_EMAIL_URL = 'https://comms.twilio.com/v1/Emails';

const isPlaceholder = (value) =>
    !value || value === 'your_account_sid_here' || value === 'your_auth_token_here';

export const isTwilioEmailEnabled = () =>
    !isPlaceholder(process.env.TWILIO_ACCOUNT_SID) && Boolean(process.env.TWILIO_AUTH_TOKEN);

export const getEmailFromAddress = () =>
    process.env.TWILIO_FROM_EMAIL
    || process.env.SENDGRID_FROM_EMAIL
    || 'noreply@frfamilyinvestments.com';

export const getEmailFromName = () =>
    process.env.TWILIO_FROM_NAME || 'FR Family Investments';

const normalizeRecipients = (to) => {
    const list = Array.isArray(to) ? to : [to];

    return list
        .map((item) => {
            if (!item) return null;
            if (typeof item === 'string') {
                const address = item.trim();
                return address ? { address } : null;
            }
            const address = String(item.address || item.email || '').trim();
            if (!address) return null;
            return {
                address,
                ...(item.name ? { name: item.name } : {})
            };
        })
        .filter(Boolean);
};

const parseErrorBody = async (response) => {
    const text = await response.text();
    if (!text) return response.statusText;

    try {
        const body = JSON.parse(text);
        return body.message
            || body.error
            || body.detail
            || body.errors?.[0]?.message
            || text;
    } catch {
        return text;
    }
};

export const sendEmail = async ({ to, subject, html, text, from, fromName }) => {
    const recipients = normalizeRecipients(to);
    if (!recipients.length) {
        throw new Error('No email recipients provided');
    }

    if (!isTwilioEmailEnabled()) {
        console.log(`[MOCK] Email to ${recipients.map((r) => r.address).join(', ')}: ${subject}`);
        return { success: true, mode: 'mock', recipients: recipients.map((r) => r.address) };
    }

    const payload = {
        from: {
            address: from || getEmailFromAddress(),
            name: fromName || getEmailFromName()
        },
        to: recipients,
        content: {
            subject,
            html,
            ...(text ? { text } : {})
        }
    };

    const auth = Buffer.from(
        `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
    ).toString('base64');

    const response = await fetch(TWILIO_EMAIL_URL, {
        method: 'POST',
        headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const message = await parseErrorBody(response);
        throw new Error(`Twilio Email ${response.status}: ${message}`);
    }

    const result = await response.json().catch(() => ({}));
    return {
        success: true,
        mode: 'twilio-email',
        operationId: result.operationId,
        recipients: recipients.map((r) => r.address)
    };
};
