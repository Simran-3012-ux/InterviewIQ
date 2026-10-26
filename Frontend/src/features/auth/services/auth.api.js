import axios from 'axios';


export async function register({username, email, password}) {
    try {
        const response = await axios.post('http://localhost:3000/api/auth/register', {
            username,email,password
        },{
            withCredentials: true,
        });
        return response.data;
    } catch (error) {
        console.log(error)
    }
}

export async function login({email, password}) {
    try {
        const response = await axios.post('http://localhost:3000/api/auth/login', {
            email,password
        },{
            withCredentials: true,
        });
        return response.data;
    } catch (error) {
        // error.response is missing when the backend is not reachable
        console.log("STATUS", error.response?.status)
        throw error
    }
}

export async function logout() {
    try {
        // backend route is GET /api/auth/logout
        const response = await axios.get('http://localhost:3000/api/auth/logout', {
            withCredentials: true,
        });
        return response.data;
    } catch (error) {
        console.log(error)
    }
}

export async function getMe() {

    try{
        const response = await axios.get('http://localhost:3000/api/auth/get-me', {
            withCredentials: true,
        });
        return response.data;
    } catch (error) {
        console.log("STATUS", error.response?.status);
        console.log("MESSAGE", error.response?.data?.message);
    }
}