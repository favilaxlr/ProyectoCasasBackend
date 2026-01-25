import crypto from 'crypto';

const CSRF_COOKIE_NAME = 'csrfToken';
const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS', 'TRACE'];
const TOKEN_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
const CSRF_SECRET = process.env.CSRF_SECRET || process.env.JWT_SECRET || process.env.TOKEN_SECRET;

const base64UrlEncode = (payload) => Buffer.from(payload).toString('base64url');
const base64UrlDecode = (payload) => Buffer.from(payload, 'base64url').toString('utf8');

const signPayload = (payload) => {
    if (!CSRF_SECRET) {
        throw new Error('CSRF secret is not configured. Set CSRF_SECRET in env');
    }

    return crypto.createHmac('sha256', CSRF_SECRET).update(payload).digest('base64url');
};

const createSignedToken = () => {
    const payload = {
        nonce: crypto.randomBytes(16).toString('hex'),
        issuedAt: Date.now()
    };

    const encodedPayload = base64UrlEncode(JSON.stringify(payload));
    const signature = signPayload(encodedPayload);

    return `${encodedPayload}.${signature}`;
};

const isSignedTokenValid = (token) => {
    if (!token || !CSRF_SECRET) return false;

    const [encodedPayload, receivedSignature] = token.split('.') ?? [];
    if (!encodedPayload || !receivedSignature) {
        return false;
    }

    const expectedSignature = signPayload(encodedPayload);

    const receivedBuffer = Buffer.from(receivedSignature, 'base64url');
    const expectedBuffer = Buffer.from(expectedSignature, 'base64url');

    if (
        receivedBuffer.length !== expectedBuffer.length ||
        !crypto.timingSafeEqual(receivedBuffer, expectedBuffer)
    ) {
        return false;
    }

    try {
        const payload = JSON.parse(base64UrlDecode(encodedPayload));
        if (!payload?.issuedAt) {
            return false;
        }

        if (Date.now() - payload.issuedAt > TOKEN_TTL_MS) {
            return false;
        }

        return true;
    } catch (error) {
        return false;
    }
};

const resolveCookieSameSite = (userAgent = '') => {
    const ua = userAgent.toLowerCase();
    const isOldSafari = /cpu (iphone )?os 1[0-2]|mac os x 10_[0-4]/.test(ua);
    const envSameSite = process.env.CSRF_COOKIE_SAMESITE?.toLowerCase();

    if (envSameSite === 'none' || envSameSite === 'lax' || envSameSite === 'strict') {
        return envSameSite;
    }

    if (isOldSafari) {
        return 'lax';
    }

    const isLocal = process.env.ENVIROMENT === 'local';
    return isLocal ? 'lax' : 'none';
};

/**
 * Issues a CSRF token. It is still mirrored in a cookie for backwards
 * compatibility, but the server now also trusts the signed header so that
 * Safari/iOS clients that block the cookie can continue to operate.
 */
export const issueCsrfToken = (req, res) => {
    const csrfToken = createSignedToken();

    const isLocal = process.env.ENVIROMENT === 'local';
    const cookieOptions = {
        httpOnly: true,
        secure: isLocal ? false : true,
        sameSite: resolveCookieSameSite(req.headers['user-agent']),
        maxAge: TOKEN_TTL_MS,
        path: '/'
    };

    if (process.env.CSRF_COOKIE_DOMAIN) {
        cookieOptions.domain = process.env.CSRF_COOKIE_DOMAIN.trim();
    }

    try {
        res.cookie(CSRF_COOKIE_NAME, csrfToken, cookieOptions);
    } catch (error) {
        console.error('Error setting CSRF cookie:', error.message);
    }

    return res.json({
        csrfToken,
        issuedAt: new Date().toISOString(),
        expiresInMs: TOKEN_TTL_MS
    });
};

/**
 * Validates the CSRF token for state-changing requests.
 */
export const csrfProtection = (req, res, next) => {
    if (SAFE_METHODS.includes(req.method)) {
        return next();
    }

    const csrfCookie = req.cookies[CSRF_COOKIE_NAME];
    const csrfHeader = req.headers['x-csrf-token'];

    if (!csrfHeader) {
        return res.status(403).json({ message: ['Invalid CSRF token'] });
    }

    const hasMatchingCookie = csrfCookie && csrfCookie === csrfHeader;
    if (hasMatchingCookie || isSignedTokenValid(csrfHeader)) {
        return next();
    }

    return res.status(403).json({ message: ['Invalid CSRF token'] });
};
