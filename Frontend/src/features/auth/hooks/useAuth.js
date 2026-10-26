import {useContext,useEffect} from "react";
import {AuthContext} from "../auth.context.jsx";
import{login,logout,register,getMe} from "../services/auth.api.js";

export const useAuth = () => {
    const context= useContext(AuthContext);
    const {user,loading,setUser,setLoading} = context;            // from state layer


    const handleLogin = async ({email,password}) => {
        setLoading(true);  
        try{                                // to show loading is the use of UI
        const data = await login({email,password}); 
        setUser(data.user);
        }catch(err){
        throw err;
        }finally{
        setLoading(false);
        }
}

    const handleRegister = async ({username,email,password}) => {
        setLoading(true);
        try{
        const data = await register({username,email,password});
        setUser(data.user);
        }catch(err){
        }finally{
        setLoading(false);
        }
    }   

    const handleLogout = async () => {
        setLoading(true);
        await logout();
        setUser(null);
        setLoading(false);
    }
    
    return {
        user,
        loading,
        handleLogin,
        handleRegister,
        handleLogout
    }
}
