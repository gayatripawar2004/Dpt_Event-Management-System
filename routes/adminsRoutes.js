var express = require('express');
var router = express.Router();
var adminsController = require('../controllers/adminscontroller');  
const { verifyAdmin } = require('../middleware/adminAuth');
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

// ============= PUBLIC ROUTES (No authentication required) =============
router.get('/login', adminsController.loginPage);
router.post('/login', adminsController.adminLogin);
router.get('/logout', adminsController.adminLogout);

// // Make admin available in views for public routes
// router.use(adminsController.setAdminLocals);


router.use(verifyAdmin);

router.use((req, res, next) => {
    res.locals.admin = req.admin;
    next();
});

// Profile routes
router.get('/profile', adminsController.profilePage);
router.post('/profile/update', upload.single('profile_image'), adminsController.updateProfile);
router.post('/change-password', adminsController.changePassword);


// Dashboard
router.get('/', adminsController.dashboardPage);
router.get('/dashboard', adminsController.dashboardPage);

// Event routes
router.get("/event_header", adminsController.event_header);
router.post('/event-header/update', upload.single('image'), adminsController.event_header_update);
router.get('/add_event', adminsController.add_event);
router.post('/add-event', upload.single('image'), adminsController.add_event_post);
router.get('/event_list', adminsController.event_list);
router.get('/edit-event/:id', adminsController.edit_event);
router.post('/update-event/:id', upload.single('image'), adminsController.update_event);
router.get('/event-fields/:eventId', adminsController.manageEventFields);
router.post('/event-fields/save', adminsController.saveEventFields);
router.post('/event-fields/delete/:fieldId', adminsController.deleteEventField);
router.get('/event-registrations/:id', adminsController.eventRegistrations);

// Gallery routes
router.get("/gallery_header", adminsController.gallery_header);
router.post('/gallery-header/update', upload.single('image'), adminsController.gallery_header_update);
router.get('/add_gallery', adminsController.add_gallery);
router.post('/add-gallery', upload.single('image'), adminsController.add_gallery_post);
router.get('/gallery_list', adminsController.gallery_list);
router.get('/edit-gallery/:id', adminsController.edit_gallery);
router.post('/update-gallery/:id', upload.single('image'), adminsController.update_gallery);
router.get('/delete-gallery/:id', adminsController.delete_gallery);

// Contact routes
router.get('/contact_header', adminsController.contact_header);
router.post('/contact-header/update', upload.single('image'), adminsController.contact_header_update);
router.get('/messages', adminsController.contact_messages);
router.get('/contact_info', adminsController.contact_info);
router.post('/contact-info/update', adminsController.contact_info_update);
router.get('/delete_message/:id', adminsController.delete_contact_message);

// Results routes
router.get('/event-results', adminsController.event_results_page);
router.post('/event-results/add', adminsController.add_event_result);
router.get('/results_list', adminsController.results_list);
router.get('/delete-result/:id', adminsController.delete_result);
router.get('/edit-result/:id', adminsController.edit_result);
router.post('/update-result/:id', adminsController.update_result);

// Announcement routes
router.get('/announcement', adminsController.announcementPage);
router.post('/announcement/add', adminsController.addAnnouncement);
router.get('/announcement_list', adminsController.announcementList);
router.get('/announcement/edit/:id', adminsController.editAnnouncementPage);
router.post('/admin/announcement/update/:id', adminsController.updateAnnouncement);
router.get('/announcement/delete/:id', adminsController.deleteAnnouncement);

// Alumni routes
router.get('/alumni', adminsController.alumniPage);
router.get('/alumni/status/:id', adminsController.updateAlumniStatus);
router.get('/view/:id', adminsController.viewAlumni);

// Event details and feedback
router.get('/event-details/:id', adminsController.adminEventDetails);
router.get('/feedback', adminsController.feedbackEvents);
router.get('/event-feedback/:id', adminsController.eventFeedback);
router.get('/event-attendance/:id', adminsController.eventAttendance);

// Student management
router.get('/pending-students', adminsController.pendingStudents);
router.get('/approve-student/:id', adminsController.approveStudent);
router.get('/reject-student/:id', adminsController.rejectStudent);

router.get('/notifications', verifyAdmin, adminsController.getNotifications);

router.post('/notification/delete/:id', adminsController.deleteNotification);
router.post('/notifications/delete-all', adminsController.deleteAllNotifications);
router.post('/notifications/mark-all-read', adminsController.markAllAsRead);


// Student routes
router.get('/students', adminsController.allStudents);
router.get('/student/view/:id', adminsController.studentDetails); 


router.get('/student/delete/:id', verifyAdmin, adminsController.deleteStudent);

router.post('/student/delete/:id', verifyAdmin, adminsController.deleteStudent);

// About Page routes
router.get('/about', verifyAdmin, adminsController.aboutPageAdmin);
router.get("/about_header", adminsController.about_header);
router.post('/about-header/update', upload.single('image'), adminsController.about_header_update);

router.post('/about/update', verifyAdmin, upload.single('image'), adminsController.updateAboutPage);

// Faculty routes (without image upload)
router.get('/faculty', verifyAdmin, adminsController.facultyList);
router.get('/faculty/add', verifyAdmin, adminsController.addFaculty);
router.get('/faculty/edit/:id', verifyAdmin, adminsController.editFaculty);
router.post('/faculty/save', verifyAdmin, adminsController.saveFaculty);  // No upload.single()
router.get('/faculty/delete/:id', verifyAdmin, adminsController.deleteFaculty);
router.post('/faculty/update-order', verifyAdmin, adminsController.updateFacultyOrder);

// Facilities routes
router.get('/facilities', verifyAdmin, adminsController.facilitiesList);
router.get('/facilities/add', verifyAdmin, adminsController.addFacility);
router.get('/facilities/edit/:id', verifyAdmin, adminsController.editFacility);
router.post('/facilities/save', verifyAdmin, adminsController.saveFacility);
router.get('/facilities/delete/:id', verifyAdmin, adminsController.deleteFacility);
router.post('/facilities/update-order', verifyAdmin, adminsController.updateFacilityOrder);
module.exports = router;