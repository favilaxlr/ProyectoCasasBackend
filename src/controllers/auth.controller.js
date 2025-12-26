//Importamos el modelo de datos de User
import User from '../models/user.models.js';
import Role from '../models/roles.models.js';
import bcrypt from 'bcryptjs';
import { createAccessToken } from '../libs/jwt.js';
import jwt from 'jsonwebtoken';
import { TOKEN_SECRET } from '../config.js';
import dotenv from 'dotenv';
import { sendVerificationCode, verifyCode } from '../services/verificationService.js';

//Configuramos las variables de entorno
dotenv.config()

//Obtenemos el rol del usuario para el registro  de usuarios
const roleUser = process.env.SETUP_ROLE_USER;

//Funcion para registrar usuarios
export const register = async (req, res)=>{
    const { username, email, phone, password} = req.body;
    
    try {
        //Validamos que el email no se este registrado en la base de datos
        const userFound = await User.findOne({email});
        if(userFound) //Ya esta registrado en la bd
            return res.status(400)//Retornamos un error en el registro
                        .json({message: ['El email ya esta registrado']});

        //Obtenemos el rol por defecto para usuarios
        //Y lo agregamos al usuario para guardarlo en la db con ese rol
        const role = await Role.findOne({role: roleUser});
        if(!role) //No se encuentra el rol de usuarios inicializado
        return res.status(400) //Retornamos error en el registro
                    .json({message: ["El rol para usuarios no esta definido"]})

        //Crear un nuevo Usuario (el password se hasheará automáticamente por el pre-save hook)
        const newUser = new User({
            username,
            email,
            phone,
            password, // Sin hashear, el modelo lo hará automáticamente
            role: role._id 
        });
        const userSaved = await newUser.save();
        
        //Enviar código de verificación por SMS y email
        await sendVerificationCode(userSaved);
        
        //Generamos el token de inicio de sesion
        const token = await createAccessToken({id: userSaved._id});

        //Verificamos si el token de inicio de sesion lo generamos para el entorno local
        //de desarrollo, o lo generamos para el servidor en la nube
        if (process.env.ENVIROMENT=='local'){
            res.cookie('token', token, {
                sameSite: 'lax', //Para indicar que el back y fron son locales para desarrollo
            });
        } else { //El back y front se encuentran en distintos servidores remotos
            res.cookie('token', token, {
                sameSite: 'none', //Para peticiones remotas
                secure: true, //Para activar https en deployment
            });

        } //Fin de if(process.env.ENVIROMENT)

        res.json({
            id: userSaved._id,
            username: userSaved.username,
            email: userSaved.email,
            phone: userSaved.phone,
            role: role.role,
            isEmailVerified: userSaved.isEmailVerified,
            isPhoneVerified: userSaved.isPhoneVerified
        });
    } catch (error) {
            res.status(500)
                .json({message: ["Error al registrar"]});
    }
}//Fin de register

//Funcion para inciar sesión
export const login = async (req, res)=>{
    const { email, password } = req.body;
    try {
        //Buscamos el usuario por email o username en la bd
        const userFound = await User.findOne({
            $or: [{email}, {username: email}]
        });
        if(!userFound)
            return res.status(400)
                        .json({message: ['Usuario no encontrado']})
        //Comparar el password que envio el usuario con el de la BD
        const isMatch = await bcrypt.compare(password, userFound.password);
        //Si no lo cocincide el password
        if(!isMatch)
            return res.status(400)
                        .json({message: ["Password no coincide"]})
        
        //Obtener el rol del usuario para verificar si es admin o co-admin
        const role = await Role.findById(userFound.role);
        if (!role) //No se encuentra el rol del usuario
            return res.status(400) //Retornamos error en el login
                        .json({message: ["El rol para el usuario no está definido"]})
        
        //Verificar que el usuario haya verificado su email y teléfono
        //EXCEPTO si es admin o co-admin
        const isAdminOrCoAdmin = role.role === 'admin' || role.role === 'co-admin';
        if(!isAdminOrCoAdmin && (!userFound.isEmailVerified || !userFound.isPhoneVerified))
            return res.status(403)
                        .json({
                            message: ["Debes verificar tu email y número de teléfono antes de iniciar sesión"],
                            needsVerification: true
                        })
        
        //Si se encuentra en la bd y el password coincide
        //Generamos el token de inicio de sesion
        const token = await createAccessToken({id: userFound._id});

        //Verificamos el inicio de sesión lo generamos para el entorno local
        //de desarollo, o lo generamos para el servidor en la nube 
        if (process.env.ENVIROMENT=='local'){
            res.cookie('token', token, {
                sameSite: 'lax', //para indicar que el backend y front son locales para desarrollo
            });
        } else{
            res.cookie('token', token, {
                sameSite: 'none', //para peticiones remotas
                secure: true, //para activar https en deployment
            });
        } //Fin de if(process.env.ENVIROMENT)

        res.json({
            id: userFound._id,
            username: userFound.username,
            email: userFound.email,
            phone: userFound.phone,
            role: role
        })
    } catch (error){
        res.status(500)
            .json({message: ["Error al iniciar sesión"]});
    }

}//Fin de login

//Funcion para cerrar sesión
export const logout = (req,res)=>{
    res.cookie('token',"",{
        expires: new Date(0)
    })
    //Retornamos 200= OK
    return res.sendStatus(200);
}

//Funcion para obtener los datos del perfil del usuario
export const profile = async (req, res)=>{
    const userFound = await User.findById(req.user.id);

    if(!userFound) //No se encontro en la BD
        return res.status(400)
                    .json({message: ["Usuario no encontrado"]})
        
        //Obtenemos el rol para el usuario que inicio sesion
        //Y lo asignamos en el return del usuario.
        const role = await Role.findById(userFound.role);
        if (!role) //No se encuentra el rol del usuario
            return res.status(400) //Retornamos error en el login
                        .json({message: ["El rol para el usuario no está definido"]})

        res.json({
            id: userFound._id,
            username: userFound.username,
            email: userFound.email,
            phone: userFound.phone,
        })
    
}//Fin de profile

//Función para validar el token de inicio de sesión
export const verifyToken = async (req, res)=>{
    const {token} = req.cookies;
    if (!token)
        return res.status(400)
                    .json({message: ["No autorizado"]});

    jwt.verify(token, TOKEN_SECRET, async (err, user)=>{
        if (err) //Hay error al validar el token
            return res.status(401)
                        .json({message: ["No autorizado"]});

        const userFound = await User.findById(user.id);
        if (!userFound)//Si no encuentra el usuario que viene en el token
            return res.status(401)
                        .json({message: ["No autorizado"]});
        
        //Obtenemos el rol para el usuario que inició sesión
        //y lo asignamos en el return del usuario.
        const role = await Role.findById(userFound.role);
        if (!role) //No se encuentra el rol del usuario
            return res.status(400) //Retornamos error en el login
                        .json({message: ["El rol para el usuario no está definido"]})

        const userResponse = {
            id: userFound._id,
            username: userFound.username,
            email: userFound.email,
            phone: userFound.phone,
            role: role
        }

        return res.json(userResponse);

    }); //Fin de jwt.verifyToken
}//Fin de verifyToken

//Función para verificar el código de verificación
export const verifyUserCode = async (req, res) => {
    const { email, code } = req.body;
    
    try {
        //Buscar el usuario por email
        const user = await User.findOne({ email });
        if (!user)
            return res.status(404)
                        .json({ message: ['Usuario no encontrado'] });

        //Verificar el código
        const result = await verifyCode(user, code);
        
        if (!result.success) {
            return res.status(400)
                        .json({ message: [result.message] });
        }

        res.json({
            message: 'Verificación exitosa',
            isEmailVerified: user.isEmailVerified,
            isPhoneVerified: user.isPhoneVerified
        });
    } catch (error) {
        res.status(500)
            .json({ message: ['Error al verificar el código'] });
    }
}//Fin de verifyUserCode

//Función para reenviar código de verificación
export const resendVerificationCode = async (req, res) => {
    const { email } = req.body;
    
    try {
        const user = await User.findOne({ email });
        if (!user)
            return res.status(404)
                        .json({ message: ['Usuario no encontrado'] });

        //Si ya está verificado
        if (user.isEmailVerified && user.isPhoneVerified)
            return res.status(400)
                        .json({ message: ['El usuario ya está verificado'] });

        //Enviar nuevo código
        await sendVerificationCode(user);
        
        res.json({ message: 'Código de verificación reenviado' });
    } catch (error) {
        res.status(500)
            .json({ message: ['Error al reenviar el código'] });
    }
}//Fin de resendVerificationCode
