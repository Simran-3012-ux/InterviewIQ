import {useAuth} from '../hooks/useAuth.js';
import {Navigate} from 'react-router-dom';
import React from 'react';

const Protected = ({children}) => {
    const {loading,user} = useAuth();

    if (loading) {
        return (<main><h1>Loading...</h1></main>);
    }

    if (!user) {
        // Redirect to login page if not authenticated
        return <Navigate to="/login" />;
    }

    return children;
};

export default Protected;