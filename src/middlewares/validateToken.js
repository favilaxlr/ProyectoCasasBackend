import { TOKEN_SECRET } from "../config.js";
import jwt from 'jsonwebtoken';

export const authRequired = (req, res, next)=>{
    //Obtenemos las cookies
    const {token} = req.cookies;
    //console.log(cookies);

    if(!token) //Si no hay token en las cookies
        return res.status(401)
                    .json({message: ["No token, authorización denegada"]});
    
    //Verificar el token
    jwt.verify(token, TOKEN_SECRET, (err, user)=>{
        if(err) //Si hay error al validar el token
        return res.status(403)
                .json({message: ['Token invalido']});
        req.user = user; //Guardamos los datos del usuario en el objeto request
        next();
    })
}//Fin de authRequired

// Alias para compatibilidad
export const validateToken = authRequired;