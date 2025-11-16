// netlify/functions/users.js
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

// Helper function to verify the token from the request headers
const verifyToken = (event) => {
    if (!JWT_SECRET) throw new Error("JWT_SECRET environment variable not set.");
    const authHeader = event.headers.authorization;
    if (!authHeader) return null;

    const token = authHeader.split(' ')[1];
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (e) {
        return null; // Invalid token
    }
};

exports.handler = async (event) => {
    const decodedToken = verifyToken(event);
    
    if (!decodedToken || decodedToken.role !== 'admin') {
        return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized: Access is denied' }) };
    }

    const { db } = event.netlify.sdk;

    // GET all users
    if (event.httpMethod === 'GET') {
        const users = await db.get('users') || [];
        return { statusCode: 200, body: JSON.stringify(users) };
    }

    // POST a new user
    if (event.httpMethod === 'POST') {
        const newUser = JSON.parse(event.body);
        if (!newUser.username || !newUser.password) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Username and password are required.' }) };
        }
        
        // IMPORTANT: HASH THE PASSWORD before saving in a real app!
        // newUser.password = await bcrypt.hash(newUser.password, 10);
        
        newUser.id = `user_${Date.now()}`;
        newUser.createdAt = new Date().toISOString();

        let users = await db.get('users') || [];
        users.push(newUser);
        
        await db.set('users', users);
        
        return {
            statusCode: 201,
            body: JSON.stringify({ message: `User '${newUser.username}' created successfully!` }),
        };
    }

    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
};