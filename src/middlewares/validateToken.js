import { TOKEN_SECRET } from "../config.js";
import jwt from 'jsonwebtoken';

export const authRequired = (req, res, next)=>{
    const token = req.cookies.token;

    if(!token)
        return res.status(401)
                    .json({message: ["No autorizado"]});
    
    //Verificar el token
    jwt.verify(token, TOKEN_SECRET, (err, user)=>{
        if(err) //Si hay error al validar el token
        return res.status(403)
            .json({message: ['Token inválido']});
        req.user = user; //Guardamos los datos del usuario en el objeto request
        next();
    })
}//Fin de authRequired

// Alias para compatibilidad
export const validateToken = authRequired;