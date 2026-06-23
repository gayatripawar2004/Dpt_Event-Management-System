const jwt = require('jsonwebtoken');

function verifyStudent(req, res, next) {
    const token = req.cookies.token;

    if (!token) {
        return res.redirect('/login?message=Please login first');
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.student = decoded;
        next();
    } catch (err) {
        res.clearCookie('token');
        return res.redirect('/login?message=Session expired, please login again');
    }
}

module.exports = { verifyStudent }; // ✅ MUST