const exe = require('../model/connection');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;
const crypto = require('crypto');
const nodemailer = require('nodemailer');

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
// Show Login Page
exports.showLogin = (req, res) => {
    res.render('student/login', { error: null, registered: req.query.registered, message: req.query.message || null });
};

exports.processLogin = async (req, res) => {
    try {
        const { email, password } = req.body;

        const students = await exe("SELECT * FROM students WHERE email = ?", [email]);

        if (students.length === 0) {
            return res.render('student/login', { 
                error: "Invalid email or password",
                registered: null,
                message: null
            });
        }

        const student = students[0];

        // ✅ Approval check FIRST
        if (student.status !== 'approved') {
            return res.render('student/login', {
                error: "⏳ Your account is not approved yet. Please wait for admin approval.",
                registered: null,
                message: null
            });
        }

        // ✅ Password check
        const match = await bcrypt.compare(password, student.password);

        if (!match) {
            return res.render('student/login', { 
                error: "Invalid email or password",
                registered: null,
                message: null
            });
        }

        // ✅ JWT Payload
        const payload = {
            id: student.id,
            name: student.name,
            email: student.email,
            prn: student.prn
        };

        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

        res.cookie('token', token, {
            httpOnly: true,
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        res.redirect('/');

    } catch (err) {
        console.error(err);

        res.render('student/login', { 
            error: "Server error, please try again",
            registered: null,
            message: null
        });
    }
};

exports.showRegister = (req, res) => {
    res.render('student/register', { error: null, formData: {} });
};


exports.processRegister = async (req, res) => {
    try {
        const {
            name, department, year, email, mobile, prn,
            parents_name, parents_mobile, password, confirm_password
        } = req.body;

        if (password !== confirm_password) {
            return res.render('student/register', {
                error: "Passwords do not match",
                formData: req.body
            });
        }

        
        const existing = await exe(
            "SELECT id FROM students WHERE email = ? OR prn = ?",
            [email, prn]
        );
        if (existing.length > 0) {
            return res.render('student/register', {
                error: "Email or PRN already registered",
                formData: req.body
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await exe(
    `INSERT INTO students 
    (name, department, year, email, mobile, prn, parents_name, parents_mobile, password, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [name, department, year, email, mobile, prn, parents_name, parents_mobile, hashedPassword, 'pending']
);

await addNotification(
    "New Student Registration",
    `${name} has registered as a new student`,
    "student"
);

        res.redirect('/login?registered=1');
    } catch (err) {
        console.error(err);
        res.render('student/register', {
            error: "Server error, please try again",
            formData: req.body
        });
    }
};


exports.logout = (req, res) => {
    res.clearCookie('token');
    res.redirect('/');
};
exports.indexPage = async function(req, res) {
    try {
        // Get active announcements
        let sql = "SELECT * FROM announcements WHERE status = 'active' ORDER BY id DESC";
        let announcements = await exe(sql);

        // Get Total Events
        let totalEventsResult = await exe(`SELECT COUNT(*) as total FROM events`);
        let totalEvents = totalEventsResult[0].total || 0;

        // Get Total Participants (students + alumni)
        let totalStudentsResult = await exe(`SELECT COUNT(*) as total FROM students WHERE status = 'approved'`);
        let totalAlumniResult = await exe(`SELECT COUNT(*) as total FROM alumni WHERE status = 'approved'`);
        let totalParticipants = (totalStudentsResult[0].total || 0) + (totalAlumniResult[0].total || 0);

        // ✅ FIX: Get Upcoming Events (active and date >= today)
        let upcomingEvents = await exe(`
            SELECT * FROM events 
            WHERE status = 'active'
            ORDER BY date ASC 
            LIMIT 3
        `, []);
        
        res.render('student/index.ejs', { 
            announcements,
            totalEvents: totalEvents,
            totalParticipants: totalParticipants,
            upcomingEvents: upcomingEvents  // ✅ Pass to view
        });

    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
};

exports.eventPage = async (req, res) => {
    try {
        // Fetch header data
        let headerSql = "SELECT * FROM event_header LIMIT 1";
        let headerData = await exe(headerSql);
        
        // Fetch upcoming events (status = 'active' and date >= today - optional)
        let today = new Date().toISOString().split('T')[0];
        let upcomingSql = "SELECT * FROM events WHERE status = 'active' ORDER BY date ASC";
        let upcomingEvents = await exe(upcomingSql, [today]);
        
        // Fetch completed events (status = 'completed' OR date < today)
        // Using status = 'completed' is simpler
        let completedSql = "SELECT * FROM events WHERE status = 'completed' ORDER BY date ASC";
        let completedEvents = await exe(completedSql);
        
        res.render('student/event.ejs', { 
            header: headerData[0] || { title: 'Upcoming Events', subtitle: '', image: 'default.jpg' },
            upcomingEvents: upcomingEvents,
            completedEvents: completedEvents
        });
    } catch (err) {
        console.error("Event Page Error:", err);
        res.status(500).send("Server error");
    }
};
exports.aboutPage = async function(req, res) {
    try {
        let headerSql = "SELECT * FROM about_header LIMIT 1";
        let headerData = await exe(headerSql);
        let about = await exe("SELECT * FROM about_page WHERE id = 1");
        let faculty = await exe("SELECT * FROM faculty WHERE status = 'active' ORDER BY display_order ASC");
         let facilities = await exe("SELECT * FROM facilities WHERE status = 'active' ORDER BY display_order ASC");
        res.render('student/about.ejs', { 
            header: headerData[0] || {},
            about: about[0] || {},
            faculty: faculty || [],
            facilities: facilities || []
        });
    } catch (err) {
        console.error("About Page Error:", err);
        res.status(500).send("Server error");
    }
};
exports.galleryPage = async function(req, res) {
    try {
        // Header
        let headerSql = "SELECT * FROM gallery_header LIMIT 1";
        let headerData = await exe(headerSql);

        
        let gallerySql = "SELECT * FROM gallery ORDER BY id DESC";
        let galleryData = await exe(gallerySql);

        res.render('student/gallery.ejs', { 
            header: headerData[0],
            gallery: galleryData
        });

    } catch (err) {
        console.error("Gallery Page Error:", err);
        res.status(500).send("Server error");
    }
}

exports.contactPage = async function(req, res) {
     try {
        // Header
        let headerSql = "SELECT * FROM contact_header LIMIT 1";
        let headerData = await exe(headerSql);
        
           let infoSql = "SELECT * FROM contact_info LIMIT 1";
        let infoData = await exe(infoSql);

    res.render('student/contact.ejs', { header: headerData[0], info: infoData[0] });
     
      } catch (err) {
        console.error("Contact Page Error:", err);
        res.status(500).send("Server error");
    }
}

exports.submitContact = async function(req, res) {
    try {
        const { name, email, message } = req.body;      
        let sql = "INSERT INTO contact_messages (name, email, message) VALUES (?, ?, ?)";
        await exe(sql, [name, email, message]);
        res.redirect('/contact');
    } catch (err) {
        console.error("Submit Contact Error:", err);
        res.status(500).send("Error submitting message");
    }
}


exports.resultPage = async function(req, res) {
    try {

        let sql = `
            SELECT er.*, e.title AS eventName, e.date AS eventDate
            FROM event_results er
            JOIN events e ON er.event_id = e.id
            ORDER BY e.date DESC
        `;

        let results = await exe(sql);

       
        let groupedResults = {};

        results.forEach(r => {
            if (!groupedResults[r.event_id]) {
                groupedResults[r.event_id] = {
                    eventName: r.eventName,
                    eventDate: r.eventDate,
                    winners: []
                };
            }

            groupedResults[r.event_id].winners.push({
                name: r.name,
                branch: r.branch,
                year: r.year,
                position: r.position,
                score: r.score
            });
        });
        
        await addNotification(
    "New Contact Message",
    `${name} sent a contact message`,
    "contact"
);

        res.render('student/result.ejs', {
            results: Object.values(groupedResults)
        });

    } catch (err) {
        console.error("Result Page Error:", err);
        res.status(500).send("Server error");
    }
};

exports.alumniPage = async function(req, res) {
    try {
        let sql = "SELECT * FROM alumni WHERE status = 'approved'";
        let alumniData = await exe(sql);

        res.render('student/Alumni.ejs', { alumniData });

    } catch (err) {
        console.log(err);
        res.send("Error loading alumni");
    }
}

exports.registerAlumni = async (req, res) => {
    // try {
        let { name, email, batch, designation, company, quote } = req.body;

        let imageName =  "default-user.png";

        // Image upload handling
        if (req.file) {
            imageName = req.file.filename; 
        }

        let sql = `
            INSERT INTO alumni (name, email, batch, designation, company, quote,status, image)
            VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
        `;

        await exe(sql, [name, email, batch, designation, company, quote, imageName]);
        
        await addNotification(
    "New Alumni Registration",
    `${name} registered as alumni`,
    "alumni"
);

        res.redirect('/alumni');

    // } catch (err) {
    //     console.error("Alumni Register Error:", err);
    //     res.status(500).send("Server Error");
    // }
};


exports.privacyPage = async function(req,res){
    res.render('student/privacy.ejs');
} 

exports.termsPage = async function(req,res){
    res.render('student/terms.ejs');
}

exports.faqPage = async function(req,res){
    res.render('student/faq.ejs');
}

exports.eventDetailsPage = async function(req, res){
    try {
        let eventId = req.query.id;   // URL मधून id घेतो (/event-details?id=1)

        let sql = "SELECT * FROM events WHERE id = ?";
        let result = await exe(sql, [eventId]);

        if(result.length === 0){
            return res.send("Event not found");
        }

        res.render('student/event-details.ejs', {
            event: result[0]
        });

    } catch (err) {
        console.error("Event Details Error:", err);
        res.status(500).send("Server Error");
    }
};

// Show dynamic registration form
exports.getEventRegistrationForm = async (req, res) => {
    try {
        const eventId = req.params.id;
        
        
        let eventSql = "SELECT * FROM events WHERE id = ?";
        let events = await exe(eventSql, [eventId]);
        if (events.length === 0) return res.status(404).send("Event not found");
        
        // Get custom fields for this event
        let fieldsSql = "SELECT * FROM event_form_fields WHERE event_id = ? ORDER BY sort_order ASC";
        let fields = await exe(fieldsSql, [eventId]);
        
        res.render('student/event-register', { 
            event: events[0], 
            fields: fields 
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
};


exports.submitEventRegistration = async (req, res) => {
    try {
        const eventId = req.params.id;
        const formData = req.body; // all form fields
        
        // Optional: server-side validation here
        
        let sql = "INSERT INTO event_registrations (event_id, form_data) VALUES (?, ?)";
        await exe(sql, [eventId, JSON.stringify(formData)]);
        
        res.send("<h3>✅ Registration successful! <a href='/event-details?id=" + eventId + "'>Back to Events</a></h3>");
    } catch (err) {
        console.error(err);
        res.status(500).send("Error saving registration");
    }
};


exports.feedbackForm = async (req, res) => {
    try {
        let eventId = req.params.id;

        let sql = "SELECT * FROM events WHERE id = ?";
        let result = await exe(sql, [eventId]);

        if (result.length === 0) {
            return res.send("Event not found");
        }

        let event = result[0];

        if (event.status !== 'completed') {
            return res.send("Feedback is available only after event completion");
        }

        res.render('student/feedback_form.ejs', { event });

    } catch (err) {
        console.log(err);
    }
};

exports.submitFeedback = async (req, res) => {
    try {
        let {
            event_id,
            name,
            email,
            rating,
            message
        } = req.body;

        let sql = `
            INSERT INTO event_feedback
            (event_id, name, email, rating, message)
            VALUES (?, ?, ?, ?, ?)
        `;

        await exe(sql, [event_id, name, email, rating, message]);
        
        await addNotification(
    "New Feedback Received",
    `New feedback submitted for event`,
    "feedback"
);


        res.redirect('/event'); // Redirect back to events page after submission
    } catch (err) {
        console.log(err);
    }
};



exports.markAttendance = async (req, res) => {
    try {
        let eventId = req.query.event_id;

        let event = await exe("SELECT * FROM events WHERE id = ?", [eventId]);

        if (event.length === 0) {
            return res.send("Invalid Event");
        }

        res.render('student/attendance_form.ejs', {
            event: event[0]
        });

    } catch (err) {
        console.log(err);
        res.send("Error loading page");
    }
};


exports.submitAttendance = async (req, res) => {
    try {
        let { event_id, name, email } = req.body;
       
        let words = name.trim().split(/\s+/);
        if (words.length < 3) {
            return res.send("⚠️ Please enter full name (First Middle Last)");
        }

        // 🔹 2. Normalize name
        let normalizedName = words
            .map(w => w.toLowerCase())
            .sort()
            .join(' ');

      
        let check = await exe(
            `SELECT * FROM event_attendance 
             WHERE event_id=? 
             AND (email=? OR normalized_name=?)`,
            [event_id, email, normalizedName]
        );

        if (check.length > 0) {
            return res.send("⚠️ Attendance already marked!");
        }

        // 🔹 4. Insert
        let sql = `
            INSERT INTO event_attendance 
            (event_id, name, email, normalized_name)
            VALUES (?, ?, ?, ?)
        `;

        await exe(sql, [event_id, name, email, normalizedName]);

        res.render('student/attendance_success.ejs');

    } catch (err) {
        console.log(err);
        res.send("Error saving attendance");
    }
};
exports.profilePage = async (req, res) => {
    try {
        const studentId = req.student.id;  // from JWT middleware

        let sql = `SELECT id, name, email, mobile, prn, department, year, 
                          semester, dob, parents_name, parents_mobile, profile_image
                   FROM students WHERE id = ?`;
        let result = await exe(sql, [studentId]);

        if (result.length === 0) {
            return res.status(404).send("Student not found");
        }

        res.render('student/profile.ejs', {
            student: result[0],
            success: null,
            error: null
        });

    } catch (err) {
        console.error("Profile page error:", err);
        res.status(500).send("Error loading profile");
    }
};


exports.updateProfile = async (req, res) => {
    try {
        const studentId = req.student.id;
        const {
            name, email, mobile, department, year,
            semester, dob, parents_name, parents_mobile
        } = req.body;

        let profileImage = null;
        
        // Handle image upload if file exists
        if (req.file) {
            // Delete old image if exists (optional)
            const oldData = await exe("SELECT profile_image FROM students WHERE id = ?", [studentId]);
            if (oldData[0]?.profile_image && oldData[0].profile_image !== 'default.png') {
                const oldPath = path.join(__dirname, '../public/uploads/', oldData[0].profile_image);
                if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
            }
            profileImage = req.file.filename; // multer saves filename
        }

        let sql;
        let params;

        if (profileImage) {
            sql = `UPDATE students SET 
                   name=?, email=?, mobile=?, department=?, year=?,
                   semester=?, dob=?, parents_name=?, parents_mobile=?, profile_image=?
                   WHERE id=?`;
            params = [name, email, mobile, department, year, semester, dob, parents_name, parents_mobile, profileImage, studentId];
        } else {
            sql = `UPDATE students SET 
                   name=?, email=?, mobile=?, department=?, year=?,
                   semester=?, dob=?, parents_name=?, parents_mobile=?
                   WHERE id=?`;
            params = [name, email, mobile, department, year, semester, dob, parents_name, parents_mobile, studentId];
        }

        await exe(sql, params);

        
        const updated = await exe(`SELECT id, name, email, mobile, prn, department, year, 
                                          semester, dob, parents_name, parents_mobile, profile_image
                                   FROM students WHERE id = ?`, [studentId]);

        res.render('student/profile.ejs', {
            student: updated[0],
            success: "✅ Profile updated successfully!",
            error: null
        });

    } catch (err) {
        console.error("Update error:", err);
        res.status(500).send("Error updating profile");
    }
};

exports.showForgotPassword = (req, res) => {
    res.render('student/forgot-password', { error: null, success: null });
};

// Send OTP to email
exports.sendOTP = async (req, res) => {
    try {
        const { email } = req.body;

        // Check if email exists in database
        const students = await exe("SELECT * FROM students WHERE email = ?", [email]);
        
        if (students.length === 0) {
            return res.render('student/forgot-password', {
                error: "Email not found in our records",
                success: null
            });
        }

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

        // Save OTP in database (you need to add these columns to students table)
        await exe(
            "UPDATE students SET reset_otp = ?, reset_otp_expiry = ? WHERE email = ?",
            [otp, otpExpiry, email]
        );

        // Send email with OTP
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Password Reset OTP - Student Portal',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #4F46E5;">Password Reset Request</h2>
                    <p>Hello ${students[0].name},</p>
                    <p>You requested to reset your password. Use the following OTP to proceed:</p>
                    <div style="background-color: #F3F4F6; padding: 15px; text-align: center; font-size: 32px; letter-spacing: 5px; font-weight: bold; border-radius: 8px;">
                        ${otp}
                    </div>
                    <p>This OTP is valid for <strong>10 minutes</strong>.</p>
                    <p>If you didn't request this, please ignore this email.</p>
                    <hr style="margin: 20px 0;">
                    <p style="color: #6B7280; font-size: 12px;">Student Portal Security</p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);

        res.render('student/verify-otp', { 
            email: email,
            error: null,
            success: "OTP sent successfully to your email!"
        });

    } catch (err) {
        console.error("Send OTP Error:", err);
        res.render('student/forgot-password', {
            error: "Error sending OTP. Please try again.",
            success: null
        });
    }
};

// Verify OTP
exports.verifyOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;

        const students = await exe(
            "SELECT * FROM students WHERE email = ? AND reset_otp = ? AND reset_otp_expiry > NOW()",
            [email, otp]
        );

        if (students.length === 0) {
            return res.render('student/verify-otp', {
                email: email,
                error: "Invalid or expired OTP. Please try again.",
                success: null
            });
        }

        // OTP verified, show reset password form
        res.render('student/reset-password', {
            email: email,
            error: null,
            success: null
        });

    } catch (err) {
        console.error("Verify OTP Error:", err);
        res.status(500).send("Server error");
    }
};


exports.resetPassword = async (req, res) => {
    try {

        const { email, password, confirm_password } = req.body;

        if (password !== confirm_password) {

            return res.render('student/reset-password', {
                email: email,
                error: "Passwords do not match",
                success: null
            });
        }

        if (password.length < 6) {

            return res.render('student/reset-password', {
                email: email,
                error: "Password must be at least 6 characters",
                success: null
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Update password
        await exe(
            `UPDATE students 
             SET password=?, 
                 reset_otp=NULL,
                 reset_otp_expiry=NULL
             WHERE email=?`,
            [hashedPassword, email]
        );

        res.redirect('/login?message=Password reset successful');

    } catch (err) {

        console.error("Reset Password Error:", err);

        res.send("Error resetting password");
    }
};