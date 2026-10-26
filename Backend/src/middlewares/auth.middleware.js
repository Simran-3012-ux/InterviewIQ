const jwt = require('jsonwebtoken');
const blacklistTokenModel = require('../models/blacklist.model');

async function authUser(req,res,next){
    // Read the token from the cookie (browser) or from "Authorization: Bearer <token>" (Postman / API clients)
    const authHeader = req.headers.authorization
    const token = req.cookies.token || (authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null)

    if(!token){
        return res.status(401).json({message: 'Unauthorized'})
    }

    const isTokenBlacklisted = await blacklistTokenModel.findOne({token})
    if(isTokenBlacklisted){
        return res.status(401).json({message: 'Token is Invalid'})
    }


try{
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.user = decoded;
    next();
} catch (error) {
    return res.status(401).json({message: 'Invalid token'})
}
}

module.exports={authUser}