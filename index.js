require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const studentsRoutes = require('./routes/studentsRoutes');
const adminsRoutes = require('./routes/adminsRoutes');

const app = express();

// ✅ JWT Secret from .env
const JWT_SECRET = process.env.JWT_SECRET;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());


// Static folders
app.use('/images', express.static(path.join(__dirname, '../images')));
app.use(express.static(path.join(__dirname, 'public')));

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ✅ Make logged-in student AND admin available in all views
app.use((req, res, next) => {
    // Student token
    const studentToken = req.cookies.token;
    if (studentToken) {
        try {
            const decoded = jwt.verify(studentToken, JWT_SECRET);
            res.locals.student = decoded;
        } catch (err) {
            res.locals.student = null;
        }
    } else {
        res.locals.student = null;
    }

    // Admin token
    const adminToken = req.cookies.adminToken;
    if (adminToken) {
        try {
            const decoded = jwt.verify(adminToken, JWT_SECRET);
            res.locals.admin = decoded;
        } catch (err) {
            res.locals.admin = null;
        }
    } else {
        res.locals.admin = null;
    }

    next();
});

// Routes
app.use('/', studentsRoutes);
app.use('/admin', adminsRoutes);

// Server start
app.listen(3000, () => {
    console.log('✅ Server running on http://localhost:3000');
});