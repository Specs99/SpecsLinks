const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

const { DATABASE_URL, JWT_SECRET } = process.env;

// This helper function checks for a valid admin token in the request headers
const verifyAdmin = (event) => {
    const authHeader = event.headers.authorization;
    if (!authHeader) return false;

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        // Only return true if the token is valid AND the user has the 'admin' role
        return decoded.role === 'admin';
    } catch (e) {
        return false;
    }
};

exports.handler = async (event) => {
    // Protect this endpoint: Only admins should be able to see the user list.
    if (!verifyAdmin(event)) {
        return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
    }

    const pool = new Pool({
        connectionString: DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        // GET Request: Fetch all users
        if (event.httpMethod === 'GET') {
            const result = await pool.query('SELECT id, username, role, created_at FROM users ORDER BY created_at DESC');
            return {
                statusCode: 200,
                body: JSON.stringify(result.rows),
            };
        }

        // You can add logic for POST (create user), DELETE, etc. here later

        return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };

    } catch (error) {
        console.error("Error in users.js function:", error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Failed to process user data.' }) };
    } finally {
        await pool.end();
    }
};