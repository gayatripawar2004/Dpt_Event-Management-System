var express = require('express');
var router = express.Router();
var studentsController = require('../controllers/studentscontroller'); 

const { verifyStudent } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/');
    },
    filename: function (req, file, cb) {
        const uniqueName = Date.now() + path.extname(file.originalname);
        cb(null, uniqueName);
    }
});

const upload = multer({ storage: storage });

router.get('/', studentsController.indexPage);

router.get('/event', studentsController.eventPage);

router.get('/about', studentsController.aboutPage);

router.get('/gallery', studentsController.galleryPage);

router.get('/contact', studentsController.contactPage);

router.post('/submit-contact', studentsController.submitContact);

router.get('/result', studentsController.resultPage);

router.get('/alumni', studentsController.alumniPage);

router.post('/alumni/register',upload.single('image'), studentsController.registerAlumni);


router.get('/privacy', studentsController.privacyPage);
 
router.get('/terms', studentsController.termsPage);

router.get('/faq', studentsController.faqPage);

router.get('/event-details', studentsController.eventDetailsPage);

// Student - Dynamic registration form
router.get('/event-register/:id',verifyStudent, studentsController.getEventRegistrationForm);
router.post('/event-register/:id', studentsController.submitEventRegistration);

// Show feedback form
router.get('/event-feedback/:id',verifyStudent, studentsController.feedbackForm);

// Submit feedback
router.post('/submit-feedback', studentsController.submitFeedback);

router.get('/mark-attendance', studentsController.markAttendance);

// 🔹 submit attendance
router.post('/mark-attendance', studentsController.submitAttendance);

// Student Login & Register with JWT
router.get('/login', studentsController.showLogin);
router.post('/login', studentsController.processLogin);
router.get('/register', studentsController.showRegister);
router.post('/register', studentsController.processRegister);
router.get('/logout', studentsController.logout);

// Profile Page
router.get('/profile', verifyStudent, studentsController.profilePage);

// Update Profile
router.post('/profile/update', verifyStudent, upload.single('profile_image'), studentsController.updateProfile);

router.get('/forgot-password', studentsController.showForgotPassword);
router.post('/forgot-password', studentsController.sendOTP);
router.post('/verify-otp', studentsController.verifyOTP);
router.post('/reset-password', studentsController.resetPassword);


module.exports = router; 
