import crypto from 'crypto';

const CSRF_COOKIE_NAME = 'csrfToken';
const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS', 'TRACE'];
const ONE_HOUR_MS = 60 * 60 * 1000;

/**
 * Issues a CSRF token using the double-submit-cookie pattern.
 * The token is returned in the response body and mirrored in a SameSite cookie
 * so the backend can validate it on subsequent unsafe requests.
 */
export const issueCsrfToken = (req, res) => {
    const csrfToken = crypto.randomBytes(32).toString('hex');

    const isLocal = process.env.ENVIROMENT === 'local';
    const cookieOptions = {
        httpOnly: false,
        secure: isLocal ? false : true,
        sameSite: isLocal ? 'lax' : 'none',
        maxAge: ONE_HOUR_MS
    };

    if (process.env.CSRF_COOKIE_DOMAIN) {
        cookieOptions.domain = process.env.CSRF_COOKIE_DOMAIN.trim();
    }

    res.cookie(CSRF_COOKIE_NAME, csrfToken, cookieOptions);

    return res.json({
        csrfToken,
        issuedAt: new Date().toISOString()
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

    if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
        return res.status(403).json({ message: ['Invalid CSRF token'] });
    }

    return next();
};
