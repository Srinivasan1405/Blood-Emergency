# 🩸 Blood Emergency Website

A complete, production-ready **full-stack blood donation and emergency management system** built with HTML/CSS/JS frontend and Node.js/Express/MongoDB backend.

---

## 📁 Project Structure

```
blood-emergency-website/
├── backend/
│   ├── config/
│   │   └── db.js                  # MongoDB connection (Mongoose)
│   ├── middleware/
│   │   └── auth.js                # JWT verify + role-based access
│   ├── models/
│   │   ├── User.js                # Donor & Admin schema
│   │   ├── BloodRequest.js        # Blood request schema
│   │   ├── DonationHistory.js     # Donation records schema
│   │   ├── Hospital.js            # Hospital schema
│   │   └── BloodStock.js          # Blood stock per hospital
│   ├── routes/
│   │   ├── auth.js                # /api/auth/*
│   │   ├── donors.js              # /api/donors/*
│   │   ├── requests.js            # /api/requests/*
│   │   ├── admin.js               # /api/admin/*
│   │   └── hospitals.js           # /api/hospitals/*
│   ├── services/
│   │   ├── alertService.js        # Email + SMS simulation
│   │   └── matchService.js        # Blood compatibility matching
│   ├── utils/
│   │   └── seedAdmin.js           # Admin account seeder
│   ├── .env                       # Environment variables
│   ├── package.json
│   └── server.js                  # Express entry point
│
├── frontend/
│   ├── css/
│   │   └── style.css              # Global design system
│   ├── js/
│   │   └── api.js                 # API wrapper + utilities
│   ├── index.html                 # Home page (hero, live requests)
│   ├── login.html                 # Login page
│   ├── register.html              # Donor registration
│   ├── dashboard.html             # Donor dashboard
│   ├── request.html               # Blood request form
│   ├── search.html                # Search donors
│   └── admin.html                 # Admin panel
│
└── README.md
```

---

## ⚙️ Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | v18+ | [nodejs.org](https://nodejs.org) |
| npm | v8+ | Comes with Node.js |
| MongoDB | v6+ | Local install or MongoDB Atlas |
| Git | Latest | Optional |

---

## 🚀 Setup & Run Instructions

### Step 1 — Clone / Navigate to the Project

```bash
cd blood-emergency-website/backend
```

### Step 2 — Install Dependencies

```bash
npm install
```

### Step 3 — Configure Environment Variables

Edit `backend/.env`:

```env
PORT=5000
NODE_ENV=development

# Replace with your MongoDB connection string
MONGODB_URI=mongodb://localhost:27017/blood_emergency_db

# Change this secret in production!
JWT_SECRET=blood_emergency_super_secret_jwt_key_2024
JWT_EXPIRES_IN=7d

# Admin credentials (for seed script)
ADMIN_EMAIL=admin@bloodemergency.com
ADMIN_PASSWORD=Admin@1234
ADMIN_NAME=System Admin
```

> **MongoDB Atlas (Cloud):** Replace `MONGODB_URI` with your Atlas connection string:
> `mongodb+srv://user:password@cluster.mongodb.net/blood_emergency_db`

### Step 4 — Start MongoDB (Local)

```bash
# Windows
mongod

# macOS/Linux
sudo service mongod start
# or
brew services start mongodb-community
```

### Step 5 — Seed Admin Account

```bash
npm run seed
```

Expected output:
```
✅ Admin created successfully!
   Email:    admin@bloodemergency.com
   Password: Admin@1234
```

### Step 6 — Start the Backend

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

You should see:
```
🩸 ═══════════════════════════════════════════════
   Blood Emergency Website — Backend Server
   🚀 Running on: http://localhost:5000
   🌍 Environment: development
   📡 API Base URL: http://localhost:5000/api
═══════════════════════════════════════════════
✅ MongoDB Connected: localhost
```

### Step 7 — Open the Frontend

Open any of the following in your browser:

| Page | URL | Description |
|------|-----|-------------|
| Home | `frontend/index.html` | Landing page with live stats |
| Register | `frontend/register.html` | Donor registration |
| Login | `frontend/login.html` | Login |
| Dashboard | `frontend/dashboard.html` | Donor profile & history |
| Request Blood | `frontend/request.html` | Submit blood request |
| Search Donors | `frontend/search.html` | Find donors |
| Admin Panel | `frontend/admin.html` | Admin dashboard |

> 💡 **Tip:** Use VS Code's **Live Server** extension for better experience — right-click `index.html` → Open with Live Server.

---

## 🔌 API Endpoints Reference

### Auth (`/api/auth`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | Public | Register new donor |
| POST | `/api/auth/login` | Public | Login and receive JWT |
| GET | `/api/auth/me` | Token | Get current user profile |
| POST | `/api/auth/logout` | Token | Logout confirmation |

**Register Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123",
  "bloodGroup": "O+",
  "phone": "+91 9876543210",
  "city": "Mumbai",
  "state": "Maharashtra"
}
```

**Login Request Body:**
```json
{ "email": "john@example.com", "password": "password123" }
```

**Login Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": { "_id": "...", "name": "John Doe", "role": "donor", ... }
}
```

---

### Donors (`/api/donors`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/donors/search?bloodGroup=O+&city=Mumbai` | Public | Search donors |
| GET | `/api/donors/stats?city=Mumbai` | Public | Blood group statistics |
| GET | `/api/donors/:id` | Public | Public donor profile |
| PUT | `/api/donors/:id` | Token (own) | Update own profile |
| PUT | `/api/donors/:id/availability` | Token (own) | Toggle availability |
| GET | `/api/donors/:id/history` | Token (own/admin) | Donation history |

---

### Blood Requests (`/api/requests`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/requests` | Public | Submit blood request |
| GET | `/api/requests/open` | Public | List open requests |
| GET | `/api/requests` | Admin | All requests (paginated) |
| GET | `/api/requests/:id` | Public | Single request detail |
| PUT | `/api/requests/:id` | Admin | Update request status |
| POST | `/api/requests/:id/respond` | Donor Token | Donor responds to request |

**Create Request Body:**
```json
{
  "patientName": "Jane Smith",
  "bloodGroup": "AB-",
  "unitsRequired": 3,
  "urgency": "critical",
  "hospitalName": "Apollo Hospital",
  "hospitalCity": "Delhi",
  "contactPhone": "+91 9876543210"
}
```

---

### Admin (`/api/admin`) — Admin Token Required

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/dashboard` | Dashboard stats |
| GET | `/api/admin/users` | All users |
| PUT | `/api/admin/users/:id` | Update user role/status |
| DELETE | `/api/admin/users/:id` | Deactivate user |
| POST | `/api/admin/alerts` | Broadcast alert |
| GET | `/api/admin/donations` | All donation history |

**Send Alert Body:**
```json
{
  "subject": "URGENT: O- Blood Needed",
  "message": "Please donate at Apollo Hospital, Delhi",
  "bloodGroup": "O-",
  "city": "Delhi",
  "sendSMS": true
}
```

---

### Hospitals (`/api/hospitals`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/hospitals` | Public | List hospitals |
| GET | `/api/hospitals/:id` | Public | Hospital detail |
| POST | `/api/hospitals` | Admin | Add hospital |
| GET | `/api/hospitals/:id/stock` | Public | Blood stock |
| PUT | `/api/hospitals/:id/stock` | Admin | Update stock |

---

## 🗄️ Database Schema Design

### Users Collection
```
{
  name:             String (required)
  email:            String (unique, indexed)
  password:         String (bcrypt hashed, hidden by default)
  role:             'donor' | 'admin'
  bloodGroup:       'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-'
  phone:            String
  location: {
    city:           String (lowercase, indexed)
    state:          String
    address:        String
  }
  isAvailable:      Boolean (default: true)
  lastDonationDate: Date
  totalDonations:   Number
  isActive:         Boolean
  profileComplete:  Boolean
  createdAt, updatedAt (auto timestamps)
}
Index: { bloodGroup: 1, 'location.city': 1 }
```

### BloodRequests Collection
```
{
  patientName:   String
  bloodGroup:    Enum (8 groups)
  unitsRequired: Number (1-20)
  urgency:       'critical' | 'urgent' | 'normal'
  hospital: {
    name, address, city
  }
  contactPhone, contactEmail: String
  status:         'pending' | 'in-progress' | 'fulfilled' | 'cancelled'
  requestedBy:   ObjectId ref User
  respondedDonors: [{ donor, respondedAt, confirmed }]
  unitsFulfilled: Number
  alertsSent:    Boolean
  fulfilledAt:   Date
  createdAt, updatedAt
}
Index: { status: 1, urgency: 1 }, { bloodGroup: 1, 'hospital.city': 1 }
```

### DonationHistory Collection
```
{
  donor:        ObjectId ref User
  request:      ObjectId ref BloodRequest (nullable)
  donationDate: Date
  bloodGroup:   Enum
  unitsDoanted: Number
  hospital: { name, city }
  status:       'scheduled' | 'completed' | 'cancelled' | 'no-show'
  certificateId: String (auto-generated on completion)
  createdAt, updatedAt
}
```

### Hospital Collection
```
{ name, address, city, state, phone, email, hasBloodBank, isActive, coordinates:{lat,lng} }
```

### BloodStock Collection
```
{
  hospital:        ObjectId ref Hospital
  bloodGroup:      Enum
  unitsAvailable:  Number
  criticalThreshold: Number (default 5)
  lastUpdated:     Date
  updatedBy:       ObjectId ref User
}
Unique compound index: { hospital: 1, bloodGroup: 1 }
```

---

## 🔒 Security Features

- **JWT Authentication** — Tokens expire in 7 days, validated on every protected request
- **Password Hashing** — bcrypt with cost factor 12
- **Rate Limiting** — 100 req/15min globally, 20 req/15min on auth routes
- **Helmet.js** — Security headers (XSS, HSTS, etc.)
- **Input Validation** — express-validator on all form inputs
- **Role-Based Access** — Middleware enforces donor vs admin routes
- **Sanitization** — Emails normalized, strings trimmed

---

## 🧪 Quick API Test

```bash
# 1. Register a donor
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@test.com","password":"password123","bloodGroup":"O+","city":"Mumbai"}'

# 2. Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"password123"}'

# 3. Search donors
curl "http://localhost:5000/api/donors/search?bloodGroup=O+&city=mumbai"

# 4. Submit blood request
curl -X POST http://localhost:5000/api/requests \
  -H "Content-Type: application/json" \
  -d '{"patientName":"Patient A","bloodGroup":"O+","unitsRequired":2,"urgency":"urgent","hospitalName":"City Hospital","hospitalCity":"Mumbai","contactPhone":"9876543210"}'

# 5. Health check
curl http://localhost:5000/api/health
```

---

## 🌐 Technologies Used

| Layer | Technology |
|-------|-----------|
| Frontend | HTML5, CSS3 (Custom), Vanilla JavaScript |
| Backend | Node.js, Express.js |
| Database | MongoDB with Mongoose ODM |
| Authentication | JSON Web Tokens (JWT) |
| Security | bcryptjs, Helmet, express-rate-limit |
| Validation | express-validator |
| Alerts | Nodemailer (Email simulation), SMS simulation |
| Dev Tools | nodemon |

---

## 📧 Alert System

The alert system **simulates** email and SMS delivery in development mode by logging to the console. In production:

- **Email:** Configure SMTP credentials in `.env` (`EMAIL_HOST`, `EMAIL_USER`, `EMAIL_PASS`)
- **SMS:** Integrate Twilio by replacing the `sendSMSAlert` function in `services/alertService.js`

---

## 🛡️ Production Checklist

- [ ] Change `JWT_SECRET` to a strong random 64+ character string
- [ ] Use MongoDB Atlas or a secured MongoDB instance
- [ ] Set `NODE_ENV=production`
- [ ] Configure real SMTP credentials for email
- [ ] Integrate Twilio for real SMS
- [ ] Add HTTPS (SSL certificate via Let's Encrypt)
- [ ] Set up process manager (PM2)
- [ ] Configure proper CORS origins

---

*Built with ❤️ — Every drop saves a life. 🩸*
