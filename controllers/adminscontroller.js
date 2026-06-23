const exe = require('../model/connection');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});



const addNotification = async (title, message, type) => {
    let sql = `
        INSERT INTO notifications (title, message, type)
        VALUES (?, ?, ?)
    `;

    await exe(sql, [title, message, type]);
};

exports.getNotifications = async (req, res) => {
    try {

        // Mark all as read
        await exe(`
            UPDATE notifications
            SET is_read = 1
            WHERE is_read = 0
        `);

        let notifications = await exe(`
            SELECT * FROM notifications
            ORDER BY id DESC
            LIMIT 10
        `);

        let unread = await exe(`
            SELECT COUNT(*) as total
            FROM notifications
            WHERE is_read = 0
        `);

        res.render('admin/notifications.ejs', {
            notifications,
            unreadCount: unread[0].total
        });

    } catch(err) {
        console.log(err);
    }
};

// adminController.js मध्ये add करा
exports.deleteNotification = async (req, res) => {
    try {
        const notificationId = req.params.id;
        
        // Delete single notification
        await exe("DELETE FROM notifications WHERE id = ?", [notificationId]);
        
        res.redirect('/admin/notifications');
    } catch(err) {
        console.log(err);
        res.status(500).send("Error deleting notification");
    }
};

exports.deleteAllNotifications = async (req, res) => {
    try {
        // Delete all notifications
        await exe("DELETE FROM notifications");
        
        res.redirect('/admin/notifications');
    } catch(err) {
        console.log(err);
        res.status(500).send("Error deleting notifications");
    }
};

exports.markAllAsRead = async (req, res) => {
    try {
        await exe("UPDATE notifications SET is_read = 1");
        res.redirect('/admin/notifications');
    } catch(err) {
        console.log(err);
        res.status(500).send("Error marking notifications");
    }
};
// Show Login Page
exports.loginPage = (req, res) => {
    // Check if already logged in via JWT
    const token = req.cookies.adminToken;
    if (token) {
        try {
            jwt.verify(token, process.env.JWT_SECRET);
            return res.redirect('/admin/dashboard');
        } catch (err) {
            res.clearCookie('adminToken');
        }
    }
    res.render('admin/login.ejs', { 
        error: null,
        message: req.query.message || null 
    });
};

// Process Login (with JWT)
exports.adminLogin = async (req, res) => {
    try {
        const { username, password } = req.body;

        // Validate input
        if (!username || !password) {
            return res.render('admin/login.ejs', { 
                error: 'Username and password are required',
                message: null
            });
        }

        // Check if admin exists (by username or email)
        let sql = "SELECT * FROM admin_users WHERE (username = ? OR email = ?) AND status = 'active'";
        let admins = await exe(sql, [username, username]);

        if (admins.length === 0) {
            return res.render('admin/login.ejs', { 
                error: 'Invalid credentials or account inactive',
                message: null
            });
        }

        const admin = admins[0];

        // Compare password
        const isValidPassword = await bcrypt.compare(password, admin.password);
        
        if (!isValidPassword) {
            return res.render('admin/login.ejs', { 
                error: 'Invalid credentials',
                message: null
            });
        }

        // Update last login time
        await exe("UPDATE admin_users SET last_login = NOW() WHERE id = ?", [admin.id]);

        // Create JWT payload
        const payload = {
            id: admin.id,
            username: admin.username,
            email: admin.email,
            full_name: admin.full_name,
            role: admin.role
        };

        // Generate JWT token
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

        // Set cookie
        res.cookie('adminToken', token, {
            httpOnly: true,
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        // Redirect to dashboard
        res.redirect('/admin/dashboard');

    } catch (err) {
        console.error("Login Error:", err);
        res.render('admin/login.ejs', { 
            error: 'Server error, please try again',
            message: null
        });
    }
};

// Admin logout
exports.adminLogout = (req, res) => {
    res.clearCookie('adminToken');
    res.redirect('/admin/login');
};

// Make admin available in all admin views
exports.setAdminLocals = (req, res, next) => {
    const token = req.cookies.adminToken;
    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            res.locals.admin = decoded;
        } catch (err) {
            res.locals.admin = null;
        }
    } else {
        res.locals.admin = null;
    }
    next();
};

// Dashboard Page
exports.dashboardPage = async (req, res) => {
    try {

        // Total Events
        let totalEvents = await exe(`
            SELECT COUNT(*) as total 
            FROM events
        `);

        // Upcoming Events
        let upcomingEvents = await exe(`
            SELECT COUNT(*) as total 
            FROM events
            WHERE status = 'active'
        `);

        // Completed Events
        let completedEvents = await exe(`
            SELECT COUNT(*) as total 
            FROM events
            WHERE status = 'completed'
        `);

        // Total Students
        let totalStudents = await exe(`
            SELECT COUNT(*) as total
            FROM students
            WHERE status = 'approved'
        `);

        // Total Alumni
        let totalAlumni = await exe(`
            SELECT COUNT(*) as total
            FROM alumni
        `);

        // Total Announcements
        let totalAnnouncements = await exe(`
            SELECT COUNT(*) as total
            FROM announcements
        `);

        // Recent Events
        let recentEvents = await exe(`
            SELECT *
            FROM events
            ORDER BY id DESC
            LIMIT 5
        `);

        // Monthly Events Chart
        let monthlyEvents = await exe(`
            SELECT 
                MONTH(date) as month,
                COUNT(*) as total
            FROM events
            WHERE YEAR(date) = YEAR(CURDATE())
            GROUP BY MONTH(date)
        `);

        // Notifications
        let notifications = await exe(`
            SELECT *
            FROM notifications
            ORDER BY id DESC
            LIMIT 5
        `);

        let unread = await exe(`
            SELECT COUNT(*) as total
            FROM notifications
            WHERE is_read = 0
        `);

        res.render('admin/dashboard.ejs', {

            admin: req.admin,

            totalEvents: totalEvents[0].total,
            upcomingEvents: upcomingEvents[0].total,
            completedEvents: completedEvents[0].total,
            totalStudents: totalStudents[0].total,
            totalAlumni: totalAlumni[0].total,
            totalAnnouncements: totalAnnouncements[0].total,

            recentEvents,
            monthlyEvents,

            notifications,
            unreadCount: unread[0].total

        });

    } catch(err) {

        console.log("Dashboard Error:", err);
        res.status(500).send("Dashboard Error");

    }
};

// Profile Page using JWT
exports.profilePage = async (req, res) => {
    try {
        const adminId = req.admin.id;
        let admins = await exe("SELECT id, username, email, full_name, role, last_login, created_at FROM admin_users WHERE id = ?", [adminId]);
        
        if (admins.length === 0) {
            return res.redirect('/admin/logout');
        }

        res.render('admin/profile.ejs', { admin: admins[0], success: req.query.success || null, error: req.query.error || null });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
};

// Update Profile using JWT
exports.updateProfile = async (req, res) => {
    try {
        const { full_name, email } = req.body;
        const adminId = req.admin.id;

        // Check if email exists for other users
        let check = await exe("SELECT id FROM admin_users WHERE email = ? AND id != ?", [email, adminId]);
        
        if (check.length > 0) {
            return res.status(400).json({ error: 'Email already exists' });
        }

        await exe("UPDATE admin_users SET full_name = ?, email = ? WHERE id = ?", [full_name, email, adminId]);

        // Update JWT payload
        const newPayload = {
            id: req.admin.id,
            username: req.admin.username,
            email: email,
            full_name: full_name,
            role: req.admin.role
        };
        const newToken = jwt.sign(newPayload, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.cookie('adminToken', newToken, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });

        res.json({ success: true, message: 'Profile updated successfully' });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

// Change Password using JWT
exports.changePassword = async (req, res) => {
    try {
        const { current_password, new_password, confirm_password } = req.body;
        const adminId = req.admin.id;

        if (new_password !== confirm_password) {
            return res.status(400).json({ error: 'New passwords do not match' });
        }

        if (new_password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        let admins = await exe("SELECT * FROM admin_users WHERE id = ?", [adminId]);
        
        if (admins.length === 0) {
            return res.status(404).json({ error: 'Admin not found' });
        }

        const isValid = await bcrypt.compare(current_password, admins[0].password);
        
        if (!isValid) {
            return res.status(400).json({ error: 'Current password is incorrect' });
        }

        const hashedPassword = await bcrypt.hash(new_password, 10);
        await exe("UPDATE admin_users SET password = ? WHERE id = ?", [hashedPassword, adminId]);

        res.json({ success: true, message: 'Password changed successfully' });

    } catch (err) {
        console.error("Change Password Error:", err);
        res.status(500).json({ error: 'Server error' });
    }
};

// ============= EVENT HEADER =============

exports.event_header = async (req, res) => {
    try{
        let sql = "SELECT * FROM event_header LIMIT 1";
        var data = await exe(sql);
        res.render('admin/event/event_header.ejs', { "header": data[0] });
    }catch(err){
        console.log(err);
    }   
}

exports.event_header_update = async (req, res) => {
    try {
        let { title, subtitle } = req.body;
        
        let oldData = await exe("SELECT * FROM event_header WHERE id = 1");
        let oldImage = oldData[0].image;
        let newImage = oldImage;

        if (req.file) {
            newImage = req.file.filename;
            if (oldImage && fs.existsSync(path.join("public/uploads/", oldImage))) {
                fs.unlinkSync(path.join("public/uploads/", oldImage));
            }
        }
        
        let sql = "UPDATE event_header SET `title` = ?, `subtitle` = ?, `image` = ? WHERE `id` = ?";
        await exe(sql, [title, subtitle, newImage, 1]);
        res.redirect('/admin/event_header');
    } catch (err) {
        console.log(err);
    }
};

// ============= EVENTS =============

exports.add_event = async (req, res) => {
    res.render('admin/event/add_event.ejs', { event: null });
};

exports.edit_event = async (req, res) => {
    try {
        const eventId = req.params.id;
        let eventSql = "SELECT * FROM events WHERE id = ?";
        let events = await exe(eventSql, [eventId]);
        if (events.length === 0) {
            return res.status(404).send("Event not found");
        }
        let fieldsSql = "SELECT * FROM event_form_fields WHERE event_id = ? ORDER BY sort_order";
        let fields = await exe(fieldsSql, [eventId]);

        res.render('admin/event/add_event.ejs', {
            event: events[0],
            fields: fields
        });
    } catch (err) {
        console.error("Edit Event Error:", err);
        res.status(500).send("Server error");
    }
};

exports.update_event = async (req, res) => {
    try {
        const eventId = req.params.id;
        const {
            title, description, date, time, venue, seats,
            organizer, contactEmail, contactPhone, registrationDeadline,
            existingImage, status
        } = req.body;

        let imageName = existingImage || null;

        if (req.file) {
            imageName = req.file.filename;
            if (existingImage && fs.existsSync(path.join("public/uploads/", existingImage))) {
                fs.unlinkSync(path.join("public/uploads/", existingImage));
            }
        }

        let sql = `
            UPDATE events SET
                title = ?, description = ?, date = ?, time = ?, venue = ?,
                seats = ?, image = ?, organizer = ?, contactEmail = ?, contactPhone = ?, registrationDeadline = ?, status = ?
            WHERE id = ?
        `;
        let values = [
            title, description, date, time, venue,
            seats, imageName, organizer, contactEmail, contactPhone, registrationDeadline, status,
            eventId
        ];

        await exe(sql, values);
        res.redirect("/admin/event_list");
    } catch (err) {
        console.error("Update Event Error:", err);
        res.status(500).send("Error updating event");
    }
};

exports.add_event_post = async (req, res) => {
    try {
        let {
            title,
            description,
            date,
            time,
            venue,
            seats,
            organizer,
            contactEmail,
            contactPhone,
            registrationDeadline,
            status
        } = req.body;

        let imageName = null;
        if (req.file) {
            imageName = req.file.filename;
        }

        let sql = `
            INSERT INTO events
            (title, description, date, time, venue, seats, image, organizer, contactEmail, contactPhone, registrationDeadline,status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        let values = [
            title, description, date, time, venue, seats,
            imageName, organizer, contactEmail, contactPhone, registrationDeadline, status
        ];

        await exe(sql, values);
        res.redirect('/admin/event_list');
    } catch (err) {
        console.error("Add Event Error:", err);
        res.send("Error adding event. Please check form and try again.");
    }
};

exports.event_list = async (req, res) => {
    try {
        let sql = "SELECT * FROM events ORDER BY created_at DESC";  
        let events = await exe(sql);
        res.render('admin/event/events_list.ejs', { events });
    }catch(err){
        console.log(err);
    }   
}

exports.addEventFields = async (req, res) => {
    try {
        const { event_id, fields } = req.body;
        for (let field of fields) {
            let sql = `INSERT INTO event_form_fields
                        (event_id, field_label, field_name, field_type, options, is_required)
                        VALUES (?, ?, ?, ?, ?, ?)`;
            await exe(sql, [
                event_id,
                field.label,
                field.name,
                field.type,
                field.options || null,
                field.is_required ? 1 : 0
            ]);
        }
        res.redirect('/admin/event_list');
    } catch (err) {
        console.error("Add Event Fields Error:", err);
        res.send("Error adding fields");
    }
};

exports.getEventRegistrationForm = async (req, res) => {
    try {
        const eventId = req.params.id;
        let eventSql = "SELECT * FROM events WHERE id = ?";
        let events = await exe(eventSql, [eventId]);
        if (!events.length) return res.status(404).send("Event not found");

        let fieldsSql = "SELECT * FROM event_form_fields WHERE event_id = ?";
        let fields = await exe(fieldsSql, [eventId]);

        res.render('student/event-register.ejs', {
            event: events[0],
            fields
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
};

exports.submitEventRegistration = async (req, res) => {
    try {
        const eventId = req.params.id;
        const formData = req.body;
        let sql = "INSERT INTO event_registrations (event_id, form_data) VALUES (?, ?)";
        await exe(sql, [eventId, JSON.stringify(formData)]);
        res.redirect('/admin/event_list');
    } catch (err) {
        console.error(err);
        res.status(500).send("Error saving registration");
    }
};

exports.manageEventFields = async (req, res) => {
    const eventId = req.params.eventId;
    let eventSql = "SELECT * FROM events WHERE id = ?";
    let events = await exe(eventSql, [eventId]);
    if (events.length === 0) return res.status(404).send("Event not found");
    
    let fieldsSql = "SELECT * FROM event_form_fields WHERE event_id = ? ORDER BY sort_order";
    let fields = await exe(fieldsSql, [eventId]);
    
    res.render('admin/event/manage_fields', {
        event: events[0],
        fields: fields
    });
};

exports.saveEventFields = async (req, res) => {
    try {
        const { event_id, fields } = req.body;
        await exe("DELETE FROM event_form_fields WHERE event_id = ?", [event_id]);
        
        for (let i = 0; i < fields.length; i++) {
            let f = fields[i];
            let sql = `INSERT INTO event_form_fields 
                        (event_id, field_label, field_name, field_type, options, is_required, sort_order) 
                        VALUES (?, ?, ?, ?, ?, ?, ?)`;
            await exe(sql, [
                event_id,
                f.label,
                f.name,
                f.type,
                f.options || null,
                f.is_required ? 1 : 0,
                i
            ]);
        }
        res.json({ success: true });
    } catch(err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
    }
};

exports.deleteEventField = async (req, res) => {
    try {
        const fieldId = req.params.fieldId;
        await exe("DELETE FROM event_form_fields WHERE id = ?", [fieldId]);
        res.redirect('back');
    } catch(err) {
        console.error(err);
        res.status(500).send("Error deleting field");
    }
};

exports.eventRegistrations = async (req, res) => {
    try {
        let eventId = req.params.id;
        let event = await exe("SELECT * FROM events WHERE id = ?", [eventId]);
        let registrations = await exe("SELECT * FROM event_registrations WHERE event_id = ? ORDER BY id DESC", [eventId]);
        let fields = await exe("SELECT * FROM event_form_fields WHERE event_id = ? ORDER BY sort_order", [eventId]);

        res.render('admin/event/event_registrations.ejs', {
            event: event[0],
            registrations,
            fields
        });
    } catch (err) {
        console.log(err);
        res.send("Error loading registrations");
    }
};

// ============= GALLERY =============

exports.gallery_header = async (req, res) => {
    try{
        let sql = "SELECT * FROM gallery_header LIMIT 1";
        var data = await exe(sql);
        res.render('admin/gallery/gallery_header.ejs', { "header": data[0] });
    }catch(err){
        console.log(err);
    }   
}

exports.gallery_header_update = async (req, res) => {
    try {
        let { title, subtitle } = req.body;
        let oldData = await exe("SELECT * FROM gallery_header WHERE id = 1");
        let oldImage = oldData[0].image;
        let newImage = oldImage;

        if (req.file) {
            newImage = req.file.filename;
            if (oldImage && fs.existsSync(path.join("public/uploads/", oldImage))) {
                fs.unlinkSync(path.join("public/uploads/", oldImage));
            }
        }
        
        let sql = "UPDATE gallery_header SET `title` = ?, `subtitle` = ?, `image` = ? WHERE `id` = ?";
        await exe(sql, [title, subtitle, newImage, 1]);
        res.redirect('/admin/gallery_header');
    } catch (err) {
        console.log(err);
    }
};

exports.add_gallery = async (req, res) => {     
    res.render('admin/gallery/add_gallery.ejs', { gallery: null });
}

exports.add_gallery_post = async (req, res) => {
    let { title, description, event_date } = req.body;
    let imageName = null;
    if (req.file) {
        imageName = req.file.filename;
    }
    let sql = `INSERT INTO gallery (title, description, image_url, event_date) VALUES (?, ?, ?, ?)`;
    await exe(sql, [title, description, imageName, event_date]);
    res.redirect('/admin/gallery_list');
};

exports.edit_gallery = async (req, res) => {
    try {
        const id = req.params.id;
        let sql = "SELECT * FROM gallery WHERE id = ?";
        let data = await exe(sql, [id]);
        res.render('admin/gallery/add_gallery.ejs', { gallery: data[0] });
    } catch (err) {
        console.log(err);
    }
}

exports.update_gallery = async (req, res) => {
    try {
        const galleryId = req.params.id;
        let { title, description, event_date, existingImage } = req.body;
        let imageName = existingImage || null;

        if (req.file) {
            imageName = req.file.filename;
            if (existingImage && fs.existsSync(path.join("public/uploads/", existingImage))) {
                fs.unlinkSync(path.join("public/uploads/", existingImage));
            }
        }

        let sql = `UPDATE gallery SET title = ?, description = ?, image_url = ?, event_date = ? WHERE id = ?`;
        await exe(sql, [title, description, imageName, event_date, galleryId]);
        res.redirect('/admin/gallery_list');
    } catch (err) {
        console.error("Update Gallery Error:", err);
        res.status(500).send("Error updating gallery");
    }
};

exports.gallery_list = async (req, res) => {
    try {
        let sql = "SELECT * FROM gallery ORDER BY id DESC";
        let gallery = await exe(sql);
        res.render('admin/gallery/gallery_list.ejs', { gallery });
    } catch (err) {
        console.error(err);
    }
};

exports.delete_gallery = async (req, res) => {
    try {
        const id = req.params.id;
        let data = await exe("SELECT * FROM gallery WHERE id = ?", [id]);
        let image = data[0].image_url;
        if (image && fs.existsSync(path.join("public/uploads/", image))) {
            fs.unlinkSync(path.join("public/uploads/", image));
        }
        await exe("DELETE FROM gallery WHERE id = ?", [id]);
        res.redirect('/admin/gallery_list');
    } catch (err) {
        console.error(err);
    }
};

// ============= CONTACT =============

exports.contact_header = async (req, res) => {
    try{
        let sql = "SELECT * FROM contact_header LIMIT 1";      
        var data = await exe(sql);
        res.render('admin/contact/contact_header.ejs', { "header": data[0] });
    }catch(err){
        console.log(err);
    }   
}

exports.contact_header_update = async (req, res) => {
    try {
        let { title, subtitle } = req.body;
        let oldData = await exe("SELECT * FROM contact_header WHERE id = 1");
        if (!oldData || oldData.length === 0) {
            return res.send("No contact header data found in database");
        }
        let oldImage = oldData[0].image;
        let newImage = oldImage;

        if (req.file) {
            newImage = req.file.filename;
            if (oldImage && fs.existsSync(path.join("public/uploads/", oldImage))) {
                fs.unlinkSync(path.join("public/uploads/", oldImage));
            }
        }

        let sql = `UPDATE contact_header SET title = ?, subtitle = ?, image = ? WHERE id = ?`;
        await exe(sql, [title, subtitle, newImage, 1]);
        res.redirect('/admin/contact_header');
    } catch (err) {
        console.log(err);
    }
};

exports.contact_messages = async (req, res) => {
    try {
        let sql = "SELECT * FROM contact_messages ORDER BY id DESC";
        let messages = await exe(sql);
        res.render('admin/contact/messages.ejs', { messages });
    } catch (err) {
        console.error("Fetch Messages Error:", err);
        res.status(500).send("Server Error");
    }
};

exports.delete_contact_message = async (req, res) => {
    try {
        const id = req.params.id;
        await exe("DELETE FROM contact_messages WHERE id = ?", [id]);
        res.redirect('/admin/messages');
    } catch (err) {
        console.error("Delete Message Error:", err);
        res.status(500).send("Error deleting message");
    }
};

exports.contact_info = async (req, res) => {
    try {
        let sql = "SELECT * FROM contact_info LIMIT 1";
        let data = await exe(sql);
        res.render('admin/contact/contact_info.ejs', { info: data[0] });
    } catch (err) {
        console.log(err);
    }
};

exports.contact_info_update = async (req, res) => {
    try {
        let {
            address,
            email1,
            email2,
            phone1,
            phone2,
            office_hours_weekdays,
            office_hours_saturday,
            facebook_link,
            instagram_link,
            youtube_link
        } = req.body;

        let updateSql = `
            UPDATE contact_info SET
                address = ?, email1 = ?, email2 = ?, phone1 = ?, phone2 = ?, 
                office_hours_weekdays = ?, office_hours_saturday = ?, 
                facebook_link = ?, instagram_link = ?, youtube_link = ?
            WHERE id = 1
        `;
        await exe(updateSql, [
            address, email1, email2, phone1, phone2,
            office_hours_weekdays, office_hours_saturday,
            facebook_link, instagram_link, youtube_link
        ]);
        res.redirect('/admin/contact_info');
    } catch (err) {
        console.log(err);
    }
};

// ============= EVENT RESULTS =============

exports.event_results_page = async (req, res) => {
    try {
        let events = await exe("SELECT id, title FROM events ORDER BY id DESC");
        res.render('admin/event/event_result.ejs', { events: events, result: null });
    } catch (err) {
        console.log(err);
    }
};

exports.add_event_result = async (req, res) => {
    try {
        let { event_id, name, branch, year, position, score } = req.body;
        let sql = `INSERT INTO event_results (event_id, name, branch, year, position, score) VALUES (?, ?, ?, ?, ?, ?)`;
        await exe(sql, [event_id, name, branch, year, position, score]);
        res.redirect('/admin/results_list');
    } catch (err) {
        console.log(err);
    }
};

exports.results_list = async (req, res) => {
    try {
        let sql = `SELECT r.*, e.title FROM event_results r JOIN events e ON r.event_id = e.id ORDER BY r.id DESC`;
        let results = await exe(sql);
        res.render('admin/event/results_list.ejs', { results });
    } catch (err) {
        console.log(err);
    }
};

exports.edit_result = async (req, res) => {
    try {
        let id = req.params.id;
        let result = await exe("SELECT * FROM event_results WHERE id = ?", [id]);
        let events = await exe("SELECT * FROM events");
        res.render('admin/event/event_result.ejs', { events: events, result: result[0] });
    } catch (err) {
        console.log(err);
    }
};

exports.update_result = async (req, res) => {
    try {
        let id = req.params.id;
        let { event_id, name, branch, year, position, score } = req.body;
        let sql = `UPDATE event_results SET event_id=?, name=?, branch=?, year=?, position=?, score=? WHERE id=?`;
        await exe(sql, [event_id, name, branch, year, position, score, id]);
        res.redirect('/admin/results_list');
    } catch (err) {
        console.log(err);
    }
};

exports.delete_result = async (req, res) => {
    try {
        let id = req.params.id;
        await exe("DELETE FROM event_results WHERE id = ?", [id]);
        res.redirect('/admin/results_list');
    } catch (err) {
        console.log(err);
    }
};

// ============= ANNOUNCEMENTS =============

exports.announcementPage = async (req, res) => {
    res.render('admin/announcement/announcement.ejs', { announcement: null });
};

exports.addAnnouncement = async (req, res) => {
    try {
        const { title } = req.body;
        let sql = `INSERT INTO announcements (title, status) VALUES (?, ?)`;
        await exe(sql, [title, "active"]);
        res.redirect('/admin/announcement_list');
    } catch (err) {
        console.error(err);
        res.send("Error adding announcement");
    }
};

exports.announcementList = async (req, res) => {
    try {
        let sql = "SELECT * FROM announcements ORDER BY id DESC";
        let data = await exe(sql);
        res.render('admin/announcement/announcement_list.ejs', { announcements: data });
    } catch (err) {
        console.error(err);
        res.send("Error fetching announcements");
    }
};

exports.editAnnouncementPage = async (req, res) => {
    let id = req.params.id;
    let sql = "SELECT * FROM announcements WHERE id = ?";
    let data = await exe(sql, [id]);
    res.render('admin/announcement/announcement.ejs', { announcement: data[0] });
};

exports.updateAnnouncement = async (req, res) => {
    let id = req.params.id;
    let { title, status } = req.body;
    let sql = "UPDATE announcements SET title=?, status=? WHERE id=?";
    await exe(sql, [title, status, id]);
    res.redirect('/admin/announcement_list');
};

exports.deleteAnnouncement = async (req, res) => {
    try {
        let id = req.params.id;
        let sql = "DELETE FROM announcements WHERE id = ?";
        await exe(sql, [id]);
        res.redirect('/admin/announcement_list');
    } catch (err) {
        console.error(err);
        res.send("Error deleting");
    }
};

// ============= ALUMNI =============

exports.alumniPage = async (req, res) => {
    let data = await exe("SELECT * FROM alumni ORDER BY id DESC");
    res.render('admin/alumni/alumni_list.ejs', { alumni: data });
};

exports.updateAlumniStatus = async (req, res) => {
    try {
        let id = req.params.id;
        let status = req.query.status;
        let sql = "UPDATE alumni SET status=? WHERE id=?";
        await exe(sql, [status, id]);
        res.redirect('/admin/alumni');
    } catch (err) {
        console.error(err);
        res.send("Error updating status");
    }
};

exports.viewAlumni = async (req, res) => {
    let id = req.params.id;
    let sql = "SELECT * FROM alumni WHERE id = ?";
    let result = await exe(sql, [id]);
    res.render('admin/alumni/view_alumni.ejs', { alumni: result[0] });
};

// ============= EVENT DETAILS & FEEDBACK =============

exports.adminEventDetails = async (req, res) => {
    try {
        let eventId = req.params.id;
        let event = await exe("SELECT * FROM events WHERE id = ?", [eventId]);
        let fields = await exe("SELECT * FROM event_form_fields WHERE event_id = ?", [eventId]);
        res.render('admin/event/event-details.ejs', { event: event[0], fields });
    } catch (err) {
        console.error(err);
        res.send("Error loading details");
    }
};

exports.feedbackEvents = async (req, res) => {
    try {
        let sql = `
            SELECT e.id, e.title, COUNT(f.id) as total_feedback, AVG(f.rating) as avg_rating
            FROM events e
            LEFT JOIN event_feedback f ON e.id = f.event_id
            GROUP BY e.id, e.title
            ORDER BY e.id DESC
        `;
        let events = await exe(sql);
        events.forEach(e => {
            e.avg_rating = e.avg_rating ? parseFloat(e.avg_rating) : 0;
        });
        res.render('admin/feedback/events_feedback.ejs', { events });
    } catch (err) {
        console.log(err);
    }
};

exports.eventFeedback = async (req, res) => {
    try {
        let eventId = req.params.id;
        let eventData = await exe("SELECT * FROM events WHERE id = ?", [eventId]);
        let sql = `SELECT * FROM event_feedback WHERE event_id = ? ORDER BY created_at DESC`;
        let feedbacks = await exe(sql, [eventId]);
        res.render('admin/feedback/event_feedback_list.ejs', { feedbacks, event: eventData.length > 0 ? eventData[0] : null });
    } catch (err) {
        console.log(err);
    }
};

exports.eventAttendance = async (req, res) => {
    try {
        let eventId = req.params.id;
        let eventData = await exe("SELECT * FROM events WHERE id = ?", [eventId]);
        let attendance = await exe("SELECT * FROM event_attendance WHERE event_id = ? ORDER BY id DESC", [eventId]);
        res.render('admin/attendance/attendance_list.ejs', { event: eventData[0], attendance,students });
    } catch (err) {
        console.log(err);
        res.send("Error loading attendance");
    }
};

// ============= STUDENT MANAGEMENT =============

exports.pendingStudents = async (req, res) => {
    let students = await exe("SELECT * FROM students WHERE status = 'pending'");
    res.render('admin/student/pending_students.ejs', { students });
};

exports.approveStudent = async (req, res) => {
    try {
        let id = req.params.id;
        let students = await exe("SELECT * FROM students WHERE id=?", [id]);
        if (students.length === 0) return res.send("Student not found");
        let student = students[0];
        await exe("UPDATE students SET status='approved' WHERE id=?", [id]);
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: student.email,
            subject: "Student Account Approved",
            html: `<div style="font-family: Arial; padding:20px;"><h2 style="color:green;">Registration Approved ✅</h2><p>Hello <b>${student.name}</b>,</p><p>Your account has been approved successfully.</p><p>You can now login to the Department Event Management System.</p><br><a href="http://localhost:3000/login" style="background:#4CAF50;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;">Login Now</a><br><br><p>Thank you.</p></div>`
        });
        res.redirect('/admin/pending-students');
    } catch (err) {
        console.log(err);
        res.send("Error approving student");
    }
};

exports.rejectStudent = async (req, res) => {
    try {
        let id = req.params.id;
        let students = await exe("SELECT * FROM students WHERE id=?", [id]);
        if (students.length === 0) return res.send("Student not found");
        let student = students[0];
        await exe("UPDATE students SET status='rejected' WHERE id=?", [id]);
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: student.email,
            subject: "Student Registration Rejected",
            html: `<div style="font-family: Arial; padding:20px;"><h2 style="color:red;">Registration Rejected ❌</h2><p>Hello <b>${student.name}</b>,</p><p>We regret to inform you that your registration request has been rejected.</p><p>Please contact the department admin for more information.</p><br><p>Thank you.</p></div>`
        });
        res.redirect('/admin/pending-students');
    } catch (err) {
        console.log(err);
        res.send("Error rejecting student");
    }
};

// Get all students (approved)


exports.studentDetails = async (req, res) => {
    try {
        const studentId = req.params.id;
        
        let sql = `SELECT 
                    id, name, email, mobile, prn, department, year, 
                    semester, dob, parents_name, parents_mobile, 
                    profile_image, status, created_at
                   FROM students 
                   WHERE id = ?`;
        
        let students = await exe(sql, [studentId]);
        
        if(students.length === 0) {
            // Send simple error message instead of rendering error.ejs
            return res.status(404).send(`
                <h1>Student Not Found</h1>
                <p>The student with ID ${studentId} does not exist.</p>
                <a href="/admin/students">Back to Students List</a>
            `);
        }
        
        res.render('admin/student/student-details', { 
            student: students[0],
            title: 'Student Details'
        });
        
    } catch(err) {
        console.error("Student Details Error:", err);
        // Send simple error message
        res.status(500).send(`
            <h1>Error Loading Student Details</h1>
            <p>${err.message}</p>
            <a href="/admin/students">Back to Students List</a>
        `);
    }
};
// Update allStudents to include link to details
// Get all students (approved) - KEEP ONLY THIS ONE
// Get all students (approved)
// Get all students (approved)
exports.allStudents = async (req, res) => {
    try {
        let sql = "SELECT * FROM students WHERE status = 'approved' ORDER BY id DESC";
        let students = await exe(sql);
        
        if (!students) {
            students = [];
        }
        
        // 🔴 IMPORTANT: Fetch notifications for sidebar
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
        
        res.render('admin/student/students-list', { 
            students: students,
            title: "All Students",
            notifications: notifications || [],
            unreadCount: (unread && unread[0]) ? unread[0].total : 0
        });
        
    } catch(err) {
        console.log("All Students Error:", err);
        res.status(500).send("Error loading students: " + err.message);
    }
};
// Delete Student Function
// Delete Student Function - Simple version without flash
exports.deleteStudent = async (req, res) => {
    try {
        const studentId = req.params.id;
        
        console.log("Deleting student ID:", studentId); // Debug log
        
        // Get student details first
        let students = await exe("SELECT * FROM students WHERE id = ?", [studentId]);
        
        if(students.length === 0) {
            console.log("Student not found");
            return res.redirect('/admin/students');
        }
        
        const student = students[0];
        
        // Delete profile image if exists
        if(student.profile_image && student.profile_image !== 'default.png') {
            const imagePath = path.join(__dirname, '../public/uploads/', student.profile_image);
            if(fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
                console.log("Deleted profile image");
            }
        }
        
        // Delete student from database
        await exe("DELETE FROM students WHERE id = ?", [studentId]);
        console.log("Student deleted from database");
        
        // Add notification (optional)
        await addNotification(
            "Student Deleted",
            `${student.name} (${student.prn}) has been deleted`,
            "student"
        );
        
        // Simple redirect - NO FLASH
        res.redirect('/admin/students');
        
    } catch(err) {
        console.error("Delete Student Error:", err);
        // On error, still redirect back
        res.redirect('/admin/students');
    }
};


// ============= ABOUT PAGE MANAGEMENT =============

// Show about page admin form
exports.aboutPageAdmin = async (req, res) => {
    try {
        let about = await exe("SELECT * FROM about_page WHERE id = 1");
        
        // Fetch notifications for sidebar
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
        
        res.render('admin/about/about', { 
            about: about[0] || {},
            notifications: notifications || [],
            unreadCount: (unread && unread[0]) ? unread[0].total : 0,
            success: req.query.success || null,
            error: req.query.error || null
        });
    } catch(err) {
        console.error("About Page Admin Error:", err);
        res.status(500).send("Error loading about page");
    }
};

// Update about page
exports.updateAboutPage = async (req, res) => {
    try {
        const { title, description, accreditation, vision, mission } = req.body;
        
        let imageName = null;
        
        // Handle image upload
        if (req.file) {
            // Get old image to delete
            let oldData = await exe("SELECT image FROM about_page WHERE id = 1", []);
            if (oldData[0]?.image && oldData[0].image !== 'default-about.jpg') {
                const oldPath = path.join(__dirname, '../public/uploads/', oldData[0].image);
                if (fs.existsSync(oldPath)) {
                    fs.unlinkSync(oldPath);
                }
            }
            imageName = req.file.filename;
            
            await exe(
                `UPDATE about_page SET 
                    title = ?, 
                    description = ?, 
                    image = ?, 
                    accreditation = ?, 
                    vision = ?, 
                    mission = ?
                WHERE id = 1`,
                [title, description, imageName, accreditation, vision, mission]
            );
        } else {
            await exe(
                `UPDATE about_page SET 
                    title = ?, 
                    description = ?, 
                    accreditation = ?, 
                    vision = ?, 
                    mission = ?
                WHERE id = 1`,
                [title, description, accreditation, vision, mission]
            );
        }
        
        // Add notification
        await addNotification(
            "About Page Updated",
            "Department about page content has been updated",
            "admin"
        );
        
        res.redirect('/admin/about?success=About page updated successfully');
        
    } catch(err) {
        console.error("Update About Page Error:", err);
        res.redirect('/admin/about?error=Error updating about page');
    }
};

// ============= FACULTY MANAGEMENT =============

// Show faculty list with drag-drop
// ============= FACULTY MANAGEMENT =============

// Show faculty list with drag-drop
exports.facultyList = async (req, res) => {
    try {
        let faculty = await exe("SELECT * FROM faculty WHERE status = 'active' ORDER BY display_order ASC");
        
        // Fetch notifications for sidebar
        let notifications = await exe(`SELECT * FROM notifications ORDER BY id DESC LIMIT 5`);
        let unread = await exe(`SELECT COUNT(*) as total FROM notifications WHERE is_read = 0`);
        
        res.render('admin/about/list', { 
            faculty: faculty,
            notifications: notifications || [],
            unreadCount: (unread && unread[0]) ? unread[0].total : 0,
            success: req.query.success || null,
            error: req.query.error || null
        });
    } catch(err) {
        console.error("Faculty List Error:", err);
        res.status(500).send("Error loading faculty list");
    }
};

// Add faculty form
exports.addFaculty = async (req, res) => {
    try {
        let notifications = await exe(`SELECT * FROM notifications ORDER BY id DESC LIMIT 5`);
        let unread = await exe(`SELECT COUNT(*) as total FROM notifications WHERE is_read = 0`);
        
        res.render('admin/about/add_faculty', { 
            faculty: null,
            notifications: notifications || [],
            unreadCount: (unread && unread[0]) ? unread[0].total : 0
        });
    } catch(err) {
        console.error("Add Faculty Error:", err);
        res.status(500).send("Error loading form");
    }
};

// Edit faculty form
exports.editFaculty = async (req, res) => {
    try {
        const facultyId = req.params.id;
        let faculty = await exe("SELECT * FROM faculty WHERE id = ?", [facultyId]);
        
        if(faculty.length === 0) {
            return res.redirect('/admin/faculty?error=Faculty not found');
        }
        
        let notifications = await exe(`SELECT * FROM notifications ORDER BY id DESC LIMIT 5`);
        let unread = await exe(`SELECT COUNT(*) as total FROM notifications WHERE is_read = 0`);
        
        res.render('admin/about/add_faculty', { 
            faculty: faculty[0],
            notifications: notifications || [],
            unreadCount: (unread && unread[0]) ? unread[0].total : 0
        });
    } catch(err) {
        console.error("Edit Faculty Error:", err);
        res.status(500).send("Error loading form");
    }
};

// Save faculty (insert/update)
exports.saveFaculty = async (req, res) => {
    try {
        const { id, name, designation, qualification, specialization, email, status } = req.body;
        
        if (id) {
            // UPDATE existing faculty
            await exe(
                `UPDATE faculty SET 
                    name = ?, 
                    designation = ?, 
                    qualification = ?, 
                    specialization = ?, 
                    email = ?, 
                    status = ?
                WHERE id = ?`,
                [name, designation, qualification, specialization, email, status, id]
            );
            await addNotification("Faculty Updated", `${name} has been updated`, "faculty");
            res.redirect('/admin/faculty?success=Faculty updated successfully');
            
        } else {
            // INSERT new faculty - get max order
            let maxOrder = await exe("SELECT MAX(display_order) as max FROM faculty");
            let newOrder = (maxOrder[0].max || 0) + 1;
            
            await exe(
                `INSERT INTO faculty 
                    (name, designation, qualification, specialization, email, display_order, status)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [name, designation, qualification, specialization, email, newOrder, status || 'active']
            );
            await addNotification("New Faculty Added", `${name} has been added to faculty`, "faculty");
            res.redirect('/admin/faculty?success=Faculty added successfully');
        }
        
    } catch(err) {
        console.error("Save Faculty Error:", err);
        res.redirect('/admin/faculty?error=Error saving faculty');
    }
};

// Delete faculty
exports.deleteFaculty = async (req, res) => {
    try {
        const facultyId = req.params.id;
        let faculty = await exe("SELECT * FROM faculty WHERE id = ?", [facultyId]);
        
        if(faculty.length > 0) {
            await exe("DELETE FROM faculty WHERE id = ?", [facultyId]);
            await addNotification("Faculty Deleted", `${faculty[0].name} has been deleted`, "faculty");
        }
        
        res.redirect('/admin/faculty?success=Faculty deleted successfully');
        
    } catch(err) {
        console.error("Delete Faculty Error:", err);
        res.redirect('/admin/faculty?error=Error deleting faculty');
    }
};

// Update faculty order (drag-drop)
exports.updateFacultyOrder = async (req, res) => {
    try {
        const { order } = req.body; // Expecting array of IDs in order
        
        if (order && Array.isArray(order)) {
            for (let i = 0; i < order.length; i++) {
                await exe("UPDATE faculty SET display_order = ? WHERE id = ?", [i + 1, order[i]]);
            }
            return res.json({ success: true, message: "Order updated successfully" });
        }
        
        return res.json({ success: false, message: "Invalid order data" });
        
    } catch(err) {
        console.error("Update Order Error:", err);
        return res.json({ success: false, message: err.message });
    }
};


// ============= FACILITIES MANAGEMENT =============

// Show facilities list with drag-drop
exports.facilitiesList = async (req, res) => {
    try {
        let facilities = await exe("SELECT * FROM facilities WHERE status = 'active' ORDER BY display_order ASC");
        
        // Fetch notifications for sidebar
        let notifications = await exe(`SELECT * FROM notifications ORDER BY id DESC LIMIT 5`);
        let unread = await exe(`SELECT COUNT(*) as total FROM notifications WHERE is_read = 0`);
        
        res.render('admin/facilities/list', { 
            facilities: facilities,
            notifications: notifications || [],
            unreadCount: (unread && unread[0]) ? unread[0].total : 0,
            success: req.query.success || null,
            error: req.query.error || null
        });
    } catch(err) {
        console.error("Facilities List Error:", err);
        res.status(500).send("Error loading facilities list");
    }
};

// Add facility form
exports.addFacility = async (req, res) => {
    try {
        let notifications = await exe(`SELECT * FROM notifications ORDER BY id DESC LIMIT 5`);
        let unread = await exe(`SELECT COUNT(*) as total FROM notifications WHERE is_read = 0`);
        
        res.render('admin/facilities/add', { 
            facility: null,
            notifications: notifications || [],
            unreadCount: (unread && unread[0]) ? unread[0].total : 0
        });
    } catch(err) {
        console.error("Add Facility Error:", err);
        res.status(500).send("Error loading form");
    }
};

// Edit facility form
exports.editFacility = async (req, res) => {
    try {
        const facilityId = req.params.id;
        let facilities = await exe("SELECT * FROM facilities WHERE id = ?", [facilityId]);
        
        if(facilities.length === 0) {
            return res.redirect('/admin/facilities?error=Facility not found');
        }
        
        let notifications = await exe(`SELECT * FROM notifications ORDER BY id DESC LIMIT 5`);
        let unread = await exe(`SELECT COUNT(*) as total FROM notifications WHERE is_read = 0`);
        
        res.render('admin/facilities/add', { 
            facility: facilities[0],
            notifications: notifications || [],
            unreadCount: (unread && unread[0]) ? unread[0].total : 0
        });
    } catch(err) {
        console.error("Edit Facility Error:", err);
        res.status(500).send("Error loading form");
    }
};

// Save facility (insert/update)
exports.saveFacility = async (req, res) => {
    try {
        const { id, icon_class, title, description, status } = req.body;
        
        if (id) {
            // UPDATE existing facility
            await exe(
                `UPDATE facilities SET 
                    icon_class = ?, 
                    title = ?, 
                    description = ?, 
                    status = ?
                WHERE id = ?`,
                [icon_class, title, description, status, id]
            );
            await addNotification("Facility Updated", `${title} has been updated`, "facility");
            res.redirect('/admin/facilities?success=Facility updated successfully');
            
        } else {
            // INSERT new facility - get max order
            let maxOrder = await exe("SELECT MAX(display_order) as max FROM facilities");
            let newOrder = (maxOrder[0].max || 0) + 1;
            
            await exe(
                `INSERT INTO facilities 
                    (icon_class, title, description, display_order, status)
                VALUES (?, ?, ?, ?, ?)`,
                [icon_class, title, description, newOrder, status || 'active']
            );
            await addNotification("New Facility Added", `${title} has been added to facilities`, "facility");
            res.redirect('/admin/facilities?success=Facility added successfully');
        }
        
    } catch(err) {
        console.error("Save Facility Error:", err);
        res.redirect('/admin/facilities?error=Error saving facility');
    }
};

// Delete facility
exports.deleteFacility = async (req, res) => {
    try {
        const facilityId = req.params.id;
        let facilities = await exe("SELECT * FROM facilities WHERE id = ?", [facilityId]);
        
        if(facilities.length > 0) {
            await exe("DELETE FROM facilities WHERE id = ?", [facilityId]);
            await addNotification("Facility Deleted", `${facilities[0].title} has been deleted`, "facility");
        }
        
        res.redirect('/admin/facilities?success=Facility deleted successfully');
        
    } catch(err) {
        console.error("Delete Facility Error:", err);
        res.redirect('/admin/facilities?error=Error deleting facility');
    }
};

// Update facility order (drag-drop)
exports.updateFacilityOrder = async (req, res) => {
    try {
        const { order } = req.body;
        
        if (order && Array.isArray(order)) {
            for (let i = 0; i < order.length; i++) {
                await exe("UPDATE facilities SET display_order = ? WHERE id = ?", [i + 1, order[i]]);
            }
            return res.json({ success: true, message: "Order updated successfully" });
        }
        
        return res.json({ success: false, message: "Invalid order data" });
        
    } catch(err) {
        console.error("Update Order Error:", err);
        return res.json({ success: false, message: err.message });
    }
};