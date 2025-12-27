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
        console.log('📝 Intento de registro:', { username, email, phone: phone ? 'Presente' : 'Ausente' });
        
        //Validamos que el email no se este registrado en la base de datos
        const userFound = await User.findOne({email});
        if(userFound) { //Ya esta registrado en la bd
            console.log('⚠️ Email ya registrado:', email);
            // Si ya está verificado, sugerir login
            if (userFound.isEmailVerified && userFound.isPhoneVerified) {
                console.log('✅ Usuario ya verificado');
                return res.status(400)
                            .json({message: ['Este email ya está registrado. Por favor inicia sesión.']});
            } else {
                // Si no está verificado, sugerir verificación
                console.log('⚠️ Usuario no verificado');
                return res.status(400)
                            .json({message: ['Este email ya está registrado pero no verificado. Por favor verifica tu cuenta.'], needsVerification: true, email: userFound.email});
            }
        }

        //Obtenemos el rol por defecto para usuarios
        //Y lo agregamos al usuario para guardarlo en la db con ese rol
        const role = await Role.findOne({role: roleUser});
        if(!role) { //No se encuentra el rol de usuarios inicializado
            console.log('❌ Rol de usuario no definido');
            return res.status(400) //Retornamos error en el registro
                        .json({message: ["El rol para usuarios no esta definido"]});
        }

        console.log('✅ Creando nuevo usuario...');
        
        //Crear un nuevo Usuario (el password se hasheará automáticamente por el pre-save hook)
        const newUser = new User({
            username,
            email,
            phone,
            password, // Sin hashear, el modelo lo hará automáticamente
            role: role._id 
        });
        const userSaved = await newUser.save();
        
        console.log('✅ Usuario guardado exitosamente:', userSaved.username);
        console.log('📨 Enviando código de verificación...');
        
        //Enviar código de verificación por SMS y email
        await sendVerificationCode(userSaved);
        
        console.log('✅ Registro completado');
        
        // NO generar token hasta que el usuario verifique su cuenta
        // El usuario debe ir a /verify-code primero
        
        res.json({
            message: 'Registro exitoso. Por favor verifica tu cuenta con el código enviado a tu email y teléfono.',
            email: userSaved.email,
            phone: userSaved.phone,
            requiresVerification: true
        });
    } catch (error) {
        console.error('❌ Error en registro:', error);
        console.error('📋 Stack:', error.stack);
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
            profileImage: userFound.profileImage,
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
            profileImage: userFound.profileImage,
            role: role
        }

        return res.json(userResponse);

    }); //Fin de jwt.verifyToken
}//Fin de verifyToken

//Función para verificar el código de verificación
export const verifyUserCode = async (req, res) => {
    const { email, code } = req.body;
    
    try {
        console.log('🔍 Intentando verificar código para:', email);
        console.log('📝 Código recibido:', code);
        
        //Buscar el usuario por email
        const user = await User.findOne({ email });
        if (!user) {
            console.log('❌ Usuario no encontrado:', email);
            return res.status(404)
                        .json({ message: ['Usuario no encontrado'] });
        }

        console.log('✅ Usuario encontrado:', user.username);
        console.log('📋 Estado de verificación:', {
            isEmailVerified: user.isEmailVerified,
            isPhoneVerified: user.isPhoneVerified,
            hasCode: !!user.verificationCode,
            codeExpiry: user.verificationCodeExpiry
        });

        // Si el usuario ya está verificado, autenticarlo directamente
        if (user.isEmailVerified && user.isPhoneVerified) {
            console.log('✅ Usuario ya verificado, autenticando directamente...');
            const role = await Role.findById(user.role);
            const token = await createAccessToken({id: user._id});

            if (process.env.ENVIROMENT=='local'){
                res.cookie('token', token, {
                    sameSite: 'lax',
                });
            } else {
                res.cookie('token', token, {
                    sameSite: 'none',
                    secure: true,
                });
            }

            return res.json({
                message: 'Ya estás verificado. Bienvenido de nuevo',
                id: user._id,
                username: user.username,
                email: user.email,
                phone: user.phone,
                profileImage: user.profileImage,
                role: role.role,
                isEmailVerified: user.isEmailVerified,
                isPhoneVerified: user.isPhoneVerified
            });
        }

        //Verificar el código
        console.log('🔐 Verificando código...');
        const result = await verifyCode(user, code);
        console.log('📊 Resultado de verificación:', result);
        
        if (!result.success) {
            console.log('❌ Código inválido o expirado');
            return res.status(400)
                        .json({ message: [result.message] });
        }

        console.log('✅ Código válido, generando token...');
        
        // Ahora SÍ generar el token después de verificar
        const role = await Role.findById(user.role);
        const token = await createAccessToken({id: user._id});

        //Verificamos si el token de inicio de sesion lo generamos para el entorno local
        //de desarrollo, o lo generamos para el servidor en la nube
        if (process.env.ENVIROMENT=='local'){
            res.cookie('token', token, {
                sameSite: 'lax',
            });
        } else {
            res.cookie('token', token, {
                sameSite: 'none',
                secure: true,
            });
        }

        console.log('✅ Verificación completada exitosamente');

        res.json({
            message: 'Verificación exitosa',
            id: user._id,
            username: user.username,
            email: user.email,
            phone: user.phone,
            profileImage: user.profileImage,
            role: role.role,
            isEmailVerified: user.isEmailVerified,
            isPhoneVerified: user.isPhoneVerified
        });
    } catch (error) {
        console.error('❌ Error en verifyUserCode:', error);
        console.error('📋 Stack:', error.stack);
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
