import React,{useState} from 'react';
import {useNavigate, Link} from 'react-router-dom';
import '../auth.form.scss';
import {useAuth} from '../hooks/useAuth.js';


const Login = () => {
    const navigate = useNavigate();
    const {loading, handleLogin} = useAuth();


    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');


const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try{
    await handleLogin({email, password});
    navigate('/',{replace:true});      // Redirect to home page after successful login
    }
    catch(err){
        if (!err.response) {
            // request never reached the server (backend not running / wrong URL)
            setError("Can't reach the server. Is the backend running on port 3000?");
        } else {
            setError(err.response.data?.message || 'Login failed. Please try again.');
        }
    }
}

    return (
        <main>
            <div className="form-container">
                <h1>Login</h1>

                <form onSubmit={handleSubmit}>
                    <div className="input-group">
                        <label htmlFor="email">Email</label>
                        <input
                           value={email}
                           onChange={(e) => setEmail(e.target.value)}
                        type="email" id="email" placeholder='Enter email' required />
                    </div>
                    <div className="input-group">
                        <label htmlFor="password">Password</label>
                        <input
                           value={password}
                           onChange={(e) => setPassword(e.target.value)}
                        type="password" id="password" placeholder='Enter password' required />
                    </div>
                    {error && <p className="form-error" role="alert">{error}</p>}
                    <button className="button primary-button" disabled={loading}>
                        {loading ? 'Logging in...' : 'Login'}
                    </button>
                </form>

                <p>Don't have an account? <Link to="/register">Register</Link></p>
            </div>
        </main>
    )
}

export default Login;