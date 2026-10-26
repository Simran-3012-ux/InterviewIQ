import {createContext,useState,useEffect} from 'react';
import {getMe} from './services/auth.api.js';

export const AuthContext = createContext()

export const AuthProvider = ({children}) => {

    const [user,setUser] = useState(null);
    const [loading,setLoading] = useState(true);

    useEffect(() => {
        const getAndSetUser = async () => {
            try {
                const data = await getMe();
                setUser(data?.user ?? null);
            } finally {
                setLoading(false);
            }
        };
        getAndSetUser();
    }, []);

    return (
        <AuthContext.Provider value={{user,loading,setUser,setLoading}}>
            {children}
        </AuthContext.Provider>
    );
}