// netlify/functions/login.js

const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

const { DATABASE_URL, JWT_SECRET } = process.env;

exports.handler = async (event) => {
    console.log("Login function invoked.");

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }

    // --- Check Environment Variables ---
    if (!DATABASE_URL) {
        console.error("FATAL: DATABASE_URL environment variable is not set.");
        return { statusCode: 500, body: JSON.stringify({ error: 'Server configuration error.' }) };
    }
    if (!JWT_SECRET) {
        console.error("FATAL: JWT_SECRET environment variable is not set.");
        return { statusCode: 500, body: JSON.stringify({ error: 'Server configuration error.' }) };
    }
    console.log("Environment variables loaded successfully.");

    // --- Create Database Pool ---
    // Note: We use ssl: { rejectUnauthorized: false } for compatibility with Neon's shared infrastructure.
    const pool = new Pool({
        connectionString: DATABASE_URL,
        ssl: {
            rejectUnauthorized: false
        }
    });
    console.log("Database connection pool created.");

    try {
        const { username, password } = JSON.parse(event.body);
        console.log(`Attempting to authenticate user: ${username}`);

        // --- Query the Database ---
        console.log("Executing query to find user...");
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        console.log("Query executed. Row count:", result.rowCount);
        
        const user = result.rows[0];

        // --- Authenticate User ---
        // IMPORTANT: The password check `password === user.password_hash` is INSECURE and for testing only.
        // In a real app, you MUST use a library like bcrypt to compare hashed passwords.
        if (!user || password !== user.password_hash) {
            console.warn(`Authentication failed for user: ${username}`);
            return { statusCode: 401, body: JSON.stringify({ error: 'Invalid username or password' }) };
        }
        console.log(`Authentication successful for user: ${user.username}`);

        // --- Generate Token ---
        const token = jwt.sign(
            { userId: user.id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '8h' }
        );
        console.log("JWT token generated successfully.");
        
        // --- Prepare and Send Response ---
        // Never send the password hash back to the client.
        const userForClient = {
            id: user.id,
            username: user.username,
            role: user.role,
        };

        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Login successful!', token, user: userForClient }),
        };

    } catch (error) {
        console.error("!!! UNEXPECTED ERROR IN LOGIN FUNCTION:", error);
        return { statusCode: 500, body: JSON.stringify({ error: 'An internal server error occurred.' }) };
    } finally {
        // Ensure the connection is closed.
        await pool.end();
        console.log("Database connection pool closed.");
    }
};