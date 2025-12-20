const tryParseNumber = (v) => {
    if (typeof v !== 'string') return v;
    if (!v.trim()) return v;
    const n = Number(v);
    return Number.isNaN(n) ? v : n;
};

const tryParseBoolean = (v) => {
    if (typeof v !== 'string') return v;
    if (v === 'true' || v === 'on') return true;
    if (v === 'false' || v === 'off') return false;
    return v;
};

const unflatten = (obj) => {
    const res = {};
    for (const key of Object.keys(obj)) {
        const value = obj[key];
        if (key.indexOf('.') === -1) {
            res[key] = value;
            continue;
        }
        const parts = key.split('.');
        let cur = res;
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            if (i === parts.length - 1) {
                cur[part] = value;
            } else {
                cur[part] = cur[part] || {};
                cur = cur[part];
            }
        }
    }
    return res;
};

export const validateSchema = (schema) => (req, res, next) => {
    try {
        // Primero unflatten para convertir keys como 'price.rent' en objetos
        const flatBody = { ...req.body };
        const nested = unflatten(flatBody);

        // Mezclar las propiedades no anidadas que puedan no tener punto
        for (const k of Object.keys(flatBody)) {
            if (k.indexOf('.') === -1 && !(k in nested)) nested[k] = flatBody[k];
        }

        // Convertir amenities de CSV a array si viene como string
        if (typeof nested.amenities === 'string') {
            nested.amenities = nested.amenities.split(',').map(s => s.trim()).filter(Boolean);
        }

        // Intentar convertir a números y booleanos en campos comunes
        if (nested.price) {
            if (nested.price.rent !== undefined) nested.price.rent = tryParseNumber(nested.price.rent);
            if (nested.price.deposit !== undefined) nested.price.deposit = tryParseNumber(nested.price.deposit);
        }
        if (nested.details) {
            if (nested.details.bedrooms !== undefined) nested.details.bedrooms = tryParseNumber(nested.details.bedrooms);
            if (nested.details.bathrooms !== undefined) nested.details.bathrooms = tryParseNumber(nested.details.bathrooms);
            if (nested.details.squareFeet !== undefined) nested.details.squareFeet = tryParseNumber(nested.details.squareFeet);
            if (nested.details.yearBuilt !== undefined) nested.details.yearBuilt = tryParseNumber(nested.details.yearBuilt);
            if (nested.details.parking !== undefined) nested.details.parking = tryParseBoolean(nested.details.parking);
            if (nested.details.petFriendly !== undefined) nested.details.petFriendly = tryParseBoolean(nested.details.petFriendly);
            if (nested.details.furnished !== undefined) nested.details.furnished = tryParseBoolean(nested.details.furnished);
        }

        // Contact parsing
        if (nested.contact) {
            if (nested.contact.phone !== undefined) nested.contact.phone = nested.contact.phone;
            if (nested.contact.email !== undefined) nested.contact.email = nested.contact.email;
        }

        // Reemplazar req.body por el objeto transformado para la validación
        req.body = nested;

        schema.parse(req.body);
        next();
    } catch (error) {
        // Loguear error de validación con contexto útil
        console.log('Schema validation error:', error);

        let messages = [];
        if (error && Array.isArray(error.issues)) {
            messages = error.issues.map((err) => err.message);
        } else if (error && error.message) {
            messages = [error.message];
        } else {
            try {
                messages = [JSON.stringify(error)];
            } catch (e) {
                messages = [String(error)];
            }
        }

        return res.status(400)
                    .json({
                        message: messages
                    });
    }
};
//Fin de validateSchema