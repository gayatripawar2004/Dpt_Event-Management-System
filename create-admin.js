require('dotenv').config();
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');

async function createAdmin() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    const password = 'admin123';
    const hashedPassword = await bcrypt.hash(password, 10);

    try {
        await connection.execute(
            `INSERT INTO admin_users (username, email, password, full_name, role, status) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            ['admin', 'admin@example.com', hashedPassword, 'Administrator', 'super_admin', 'active']
        );
        console.log('✅ Admin user created!');
        console.log('Username: admin');
        console.log('Password: admin123');
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            console.log('⚠️ Admin user already exists');
        } else {
            console.error('Error:', err);
        }
    }

    await connection.end();
}

createAdmin();