const jwt = require('jsonwebtoken');
const exe = require('../model/connection');

async function verifyAdmin(req, res, next) {

    const token = req.cookies.adminToken;

    if (!token) {
        return res.redirect('/admin/login?message=Please login first');
    }

    try {

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        req.admin = decoded;

        // Notifications
        let notifications = await exe(`
            SELECT * FROM notifications
            ORDER BY id DESC
            LIMIT 5
        `);

        let unread = await exe(`
            SELECT COUNT(*) as total
            FROM notifications
            WHERE is_read = 0
        `);

        res.locals.notifications = notifications;
        res.locals.unreadCount = unread[0].total;

        next();

    } catch (err) {

        res.clearCookie('adminToken');

        return res.redirect('/admin/login?message=Session expired, please login again');

    }
}

module.exports = { verifyAdmin };