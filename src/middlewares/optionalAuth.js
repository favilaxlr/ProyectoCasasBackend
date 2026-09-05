import { TOKEN_SECRET } from '../config.js';
import jwt from 'jsonwebtoken';

export const optionalAuth = (req, res, next) => {
    let token = req.cookies.token;

    if (!token) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7);
        }
    }

    if (!token) {
        return next();
    }

    jwt.verify(token, TOKEN_SECRET, (err, user) => {
        if (!err) {
            req.user = user;
        }
        next();
    });
};
