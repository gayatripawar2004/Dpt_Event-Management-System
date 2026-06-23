const mysql = require('mysql2');

var conn = mysql.createConnection({
    host:  "bk7z0ols9xdnq5kbmqln-mysql.services.clever-cloud.com",
    user:  "un1ntlkgoiix9aib",
    password: "wY85wVEjYmC3H9PnFveZ",
    database: "bk7z0ols9xdnq5kbmqln",
    port:3306
});

async function exe(sql, params = []) {
    const [result] = await conn.promise().query(sql, params);
    return result;
}

module.exports = exe;