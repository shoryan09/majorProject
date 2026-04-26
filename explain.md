# Hospital Management System (HMS) - MedFlow AI

## Project Overview

This is a **Hospital Management System** called "MedFlow AI" that helps manage hospital appointments, patients, and user authentication. It's built as a full-stack web application with a backend API and a frontend user interface. The system supports three types of users: **patients**, **doctors**, and **administrators**, each with different permissions and views.

The project uses modern web technologies to create a clean, responsive, and secure system for managing healthcare appointments. It features a comprehensive dark mode system for comfortable viewing in all lighting conditions. It's designed to be simple yet extensible, starting with core features like user authentication and appointment booking.

---

## Backend Architecture

The backend is the "brain" of the system - it handles all the data storage, business logic, and security. It's built using **Node.js** with **Express.js** framework, which is a popular choice for building web APIs.

### Technology Stack
- **Runtime**: Node.js (JavaScript execution environment)
- **Framework**: Express.js (web application framework for Node.js)
- **Authentication**: JSON Web Tokens (JWT) for secure user sessions
- **Password Security**: bcrypt for hashing passwords
- **Data Storage**: JSON file (simple file-based database for development)
- **Cross-Origin**: CORS middleware for frontend-backend communication
- **Environment**: dotenv for configuration management

### Core Dependencies
```json
{
  "bcrypt": "^6.0.0",        // Password hashing
  "cors": "^2.8.6",          // Cross-origin resource sharing
  "dotenv": "^17.3.1",       // Environment variables
  "express": "^5.2.1",       // Web framework
  "jsonwebtoken": "^9.0.3"   // JWT tokens
}
```

### Data Structure

The system stores data in a `data.json` file with three main collections:

#### Users Collection
```json
{
  "users": [
    {
      "id": "1773657419389",
      "name": "roy",
      "email": "roy@gmail.com",
      "password": "$2b$10$Qi5oFF1ZdZOn8qFI60R5G.WPWclOugCtr4kwXqMNhrZiaGHJ6ndMy",
      "role": "patient"
    }
  ]
}
```

Each user has:
- **id**: Unique identifier (timestamp-based)
- **name**: Full name of the user
- **email**: Email address (used for login)
- **password**: Hashed password (never stored in plain text)
- **role**: User type ("patient", "doctor", or "admin")

#### Appointments Collection
```json
{
  "appointments": [
    {
      "id": "1774291383380",
      "patientId": "1774291127169",
      "doctorId": "doc1",
      "date": "20206-04-12",
      "time": "11:22",
      "status": "pending"
    }
  ]
}
```

Each appointment contains:
- **id**: Unique appointment identifier
- **patientId**: ID of the patient booking the appointment
- **doctorId**: ID of the assigned doctor
- **date**: Appointment date (YYYY-MM-DD format)
- **time**: Appointment time (HH:MM format)
- **status**: Current status ("pending", "confirmed", "cancelled")

#### Patients Collection
```json
{
  "patients": [
    {
      "id": "1774044080753",
      "name": "ash",
      "age": "20",
      "contact": "1234567890"
    }
  ]
}
```

Patient records include:
- **id**: Unique patient identifier
- **name**: Patient's full name
- **age**: Patient's age
- **contact**: Contact information (phone number)

### API Endpoints

The backend exposes several REST API endpoints for frontend communication:

#### Authentication Endpoints

**POST /auth/signup**
- **Purpose**: Register a new user account
- **Input**: `{ name, email, password, role }`
- **Process**:
  1. Validate required fields (name, email, password)
  2. Check if email already exists
  3. Hash password using bcrypt (10 salt rounds)
  4. Create user object with generated ID
  5. Generate JWT token
  6. Return token and user data
- **Response**: `{ token, user: { id, name, email, role } }`

**POST /auth/login**
- **Purpose**: Authenticate existing user
- **Input**: `{ email, password }`
- **Process**:
  1. Validate email and password provided
  2. Find user by email in data store
  3. Compare provided password with stored hash using bcrypt
  4. Generate JWT token if authentication successful
  5. Return token and user data
- **Response**: `{ token, user: { id, name, email, role } }`

**GET /me**
- **Purpose**: Get current authenticated user information
- **Authentication**: Required (JWT token in Authorization header)
- **Process**: Decode JWT token and return user data
- **Response**: `{ user: { id, name, email, role } }`

#### Appointment Endpoints

**GET /appointments**
- **Purpose**: Retrieve appointments based on user role
- **Authentication**: Required
- **Logic**:
  - Patients see only their own appointments
  - Doctors see appointments assigned to them
  - Admins see all appointments
- **Response**: Array of appointment objects

**POST /appointments**
- **Purpose**: Book a new appointment
- **Authentication**: Required
- **Input**: `{ doctorId, date, time, status }`
- **Process**:
  1. Validate required fields
  2. Create appointment with current user as patient
  3. Set status to "pending" by default
  4. Generate unique ID and save
- **Response**: Created appointment object

#### Patient Management Endpoints

**GET /patients**
- **Purpose**: Retrieve patient records
- **Authentication**: Required (doctors and admins only)
- **Access Control**: Returns 403 if user is not doctor or admin
- **Response**: Array of patient objects

**POST /patients**
- **Purpose**: Add a new patient record
- **Authentication**: Required (doctors and admins only)
- **Input**: `{ name, age, contact }`
- **Process**:
  1. Validate required fields
  2. Create patient object with generated ID
  3. Save to data store
- **Response**: Created patient object

### Security Implementation

#### JWT Authentication
- **Token Generation**: Uses jsonwebtoken library with HS256 algorithm
- **Secret Key**: Stored in environment variable `JWT_SECRET`
- **Token Payload**: Contains user `id`, `email`, and `role`
- **Expiration**: Not set (tokens don't expire for simplicity)

#### Password Security
- **Hashing Algorithm**: bcrypt with 10 salt rounds
- **Storage**: Only hashed passwords stored, never plain text
- **Comparison**: bcrypt.compare() for login verification

#### Middleware Protection
```javascript
const authenticate = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ message: 'Access denied' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Invalid token' });
  }
};
```

#### Role-Based Access Control
- **Patient**: Can view own appointments, book new appointments
- **Doctor**: Can view assigned appointments, manage patients
- **Admin**: Full access to all appointments and patients

### Server Configuration

```javascript
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());              // Enable cross-origin requests
app.use(express.json());      // Parse JSON request bodies

// Routes
app.post('/auth/signup', ...);
app.post('/auth/login', ...);
// ... other routes

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

---

## Frontend Architecture

The frontend is the "face" of the system - what users see and interact with. It's built using **React** with **Vite** as the build tool, creating a modern single-page application (SPA).

### Technology Stack
- **Framework**: React 18 (component-based UI library)
- **Build Tool**: Vite (fast development server and bundler)
- **Routing**: React Router DOM (client-side navigation)
- **HTTP Client**: Axios (API communication)
- **Styling**: Inline styles with CSS custom properties and dark mode support
- **State Management**: React hooks (useState, useEffect)

### Core Dependencies
```json
{
  "react": "^18.2.0",           // UI framework
  "react-dom": "^18.2.0",       // React DOM rendering
  "react-router-dom": "^6.14.1", // Routing
  "axios": "^1.5.0"            // HTTP client
}
```

### Application Structure

#### Main Entry Point (main.jsx)
```javascript
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
```

#### App Component (App.jsx)
The main application component handles:
- **Theme Management**: Complete light/dark mode system with toggle button
- **Routing**: Defines all application routes with authentication guards
- **Theme Persistence**: Saves user theme preference in localStorage

```javascript
const PrivateRoute = ({ children }) => {
  return getAuthToken() ? children : <Navigate to="/login" replace />;
};

function App() {
  // Theme state and toggle logic
  // Route definitions
  return (
    <>
      <button className="theme-toggle">🌙/☀️</button>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/dashboard" element={
          <PrivateRoute>
            <Dashboard />
          </PrivateRoute>
        } />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </>
  );
}
```

### Authentication System

#### Login Component
The login page provides a beautiful, professional interface for user authentication.

**Key Features**:
- **Form Validation**: Email and password required
- **Error Handling**: Displays backend error messages
- **Loading States**: Shows "Signing in..." during authentication
- **Navigation**: Redirects to dashboard on success
- **Responsive Design**: Works on all screen sizes

**Authentication Flow**:
1. User enters email and password
2. Form submission calls `/auth/login` API
3. On success: Store JWT token and user data in localStorage
4. Redirect to dashboard
5. On failure: Display error message

**UI Elements**:
- **Logo**: "MedFlow AI" branding
- **Form Fields**: Email input, password input
- **Submit Button**: "Sign In" with loading state
- **Links**: "Forgot password?" and "Request access" (signup)
- **Decorative Elements**: Gradient backgrounds, geometric patterns
- **Trust Badges**: HIPAA, SOC 2, ISO 27001 compliance indicators

#### Signup Component
The signup page allows new users to create accounts with role selection.

**Key Features**:
- **Role Selection**: Dropdown for patient/doctor/admin
- **Form Validation**: All fields required, password minimum 6 characters
- **Success Handling**: Automatic login after successful registration
- **Professional Design**: Consistent with login page styling

**Registration Flow**:
1. User fills name, email, password, and selects role
2. Form submission calls `/auth/signup` API
3. On success: Store JWT token and user data, redirect to dashboard
4. On failure: Display error message

**UI Elements**:
- **Role Dropdown**: Patient, Doctor, Admin options
- **Form Fields**: Name, email, password inputs
- **Submit Button**: "Create Account" with loading state
- **Navigation**: Link to login page

### Dashboard System

The dashboard is the main application interface after login, with different views based on user roles.

#### Common Features
- **Header Navigation**: Logo, user info, role badge, logout button
- **Theme Toggle**: Light/dark mode switcher
- **Responsive Layout**: Grid-based design that adapts to screen size
- **Real-time Data**: Fetches latest data on component mount

#### Patient Dashboard

**Access Level**: Limited to personal data only

**Statistics Cards**:
- **Total Appointments**: Count of patient's appointments
- **Next Appointment**: Upcoming appointment date and time
- **Quick Actions**: Book new appointment

**Main Sections**:

**Appointment Booking Form**:
- **Doctor ID**: Text input for doctor identifier
- **Date Picker**: HTML5 date input
- **Time Picker**: HTML5 time input
- **Submit**: "Book Appointment" button

**Appointments Table**:
- **Columns**: ID, Doctor, Patient, Date, Time, Status
- **Data**: Only shows patient's own appointments
- **Status Indicators**: Color-coded badges (pending=yellow, confirmed=green)

**UI Restrictions**:
- No patient management section
- Cannot view other patients' data
- Limited to personal appointment management

#### Doctor Dashboard

**Access Level**: Can manage appointments and patients

**Statistics Cards**:
- **Total Appointments**: All appointments assigned to doctor
- **Total Patients**: Count of registered patients
- **Next Appointment**: Doctor's next scheduled appointment

**Main Sections**:

**Appointment Management**:
- **View Appointments**: See all appointments assigned to them
- **Status Tracking**: Monitor appointment statuses

**Patient Management**:
- **Add Patient Form**:
  - Name input
  - Age input (number)
  - Contact input
  - "Save Patient" button
- **Patient List Table**:
  - Columns: ID, Name, Age, Contact
  - Shows all registered patients

**UI Features**:
- Two-column layout (appointments + patients)
- Full access to patient data
- Can add new patients to system

#### Admin Dashboard

**Access Level**: Full system access

**Statistics Cards**:
- **Total Appointments**: All appointments in system
- **Total Patients**: All registered patients
- **System Overview**: Complete system metrics

**Main Sections**:

**Complete Appointment Management**:
- **View All Appointments**: Every appointment in the system
- **Cross-User Visibility**: See appointments for all patients/doctors

**Complete Patient Management**:
- **Add New Patients**: Register patients in system
- **View All Patients**: Complete patient directory
- **System Administration**: Full patient data access

**UI Features**:
- Comprehensive data tables
- Administrative controls
- System-wide statistics

### API Integration

#### Axios Configuration (services/api.js)
```javascript
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor: Add JWT token to all requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('hms_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
```

#### Data Fetching Logic
- **Authentication State**: Token stored in localStorage
- **Automatic Headers**: JWT token added to all API calls
- **Error Handling**: User-friendly error messages
- **Loading States**: UI feedback during API calls

### Styling System

#### Design Philosophy
- **Modern UI**: Clean, professional healthcare interface
- **Consistent Colors**: Navy blue (#1E3A5F) as primary, blue accents (#2563EB)
- **Typography**: Inter font family for readability
- **Spacing**: Consistent padding and margins using rem units
- **Interactive Elements**: Hover states and focus indicators

#### CSS Custom Properties
```css
:root {
  --bg: linear-gradient(140deg, #f4fbff 25%, #e6f3ff 100%);
  --page-bg: #f8fafc;
  --text: #1e293b;
  --card-bg: #ffffff;
  --border: #d8e6f2;
  --shadow: 0 6px 20px rgba(13, 30, 59, 0.08);
  --body-bg: #f4fbff;
  --input-bg: #ffffff;
  --input-border: #cbd5e1;
  --input-text: #0f172a;
  --btn-text: #fff;
  --btn-primary: linear-gradient(120deg, #2d8cf0, #0f5bc7);
  --btn-danger: #e11d48;
  /* ... more color variables */
}
```

#### Component Styling
- **Inline Styles**: Direct style objects for dynamic styling
- **CSS Classes**: Theme classes for light/dark mode
- **Responsive Design**: Flexbox and grid layouts
- **Accessibility**: Proper focus states and ARIA labels

### Dark Mode Implementation

The application features a comprehensive dark mode system that provides users with a comfortable viewing experience in low-light conditions while maintaining full functionality and design consistency.

#### Theme Management Architecture
- **Theme Toggle**: Interactive button (🌙/☀️) located in the top-left corner of every page
- **System Detection**: Automatically detects user's system preference on first visit
- **Persistent Storage**: Theme choice saved in localStorage for consistent experience
- **Instant Switching**: Seamless transitions between light and dark themes

#### Theme State Management
```javascript
const getInitialTheme = () => {
  const stored = localStorage.getItem('hms_theme');
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

function App() {
  const [theme, setTheme] = useState(getInitialTheme());

  useEffect(() => {
    document.documentElement.classList.remove('theme-light', 'theme-dark');
    document.documentElement.classList.add(`theme-${theme}`);
    localStorage.setItem('hms_theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme((curr) => (curr === 'light' ? 'dark' : 'light'));
}
```

#### Dark Theme Color Palette
```css
.theme-dark {
  --bg: linear-gradient(140deg, #0f172a 25%, #111827 100%);
  --page-bg: #0b1120;
  --text: #e2e8f0;
  --card-bg: #1e293b;
  --border: #334155;
  --shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
  --body-bg: #0b1120;
  --input-bg: #15263f;
  --input-border: #334155;
  --input-text: #e2e8f0;
  --btn-text: #fff;
  --btn-primary: linear-gradient(120deg, #38bdf8, #0ea5e9);
  --btn-danger: #ef4444;
  --alert-bg: #fef2f2;
  --alert-border: #fca5a5;
  --alert-text: #7f1d1d;
  --alert-success-bg: #dcfce7;
  --alert-success-border: #22c55e;
  --alert-success-text: #166534;
  --table-head: #1e293b;
  --table-border: #475569;
}
```

#### Component Integration
All React components use CSS custom properties (`var(--css-variable)`) instead of hardcoded colors, enabling automatic theme adaptation:

- **Background Colors**: `var(--card-bg)`, `var(--body-bg)`, `var(--page-bg)`
- **Text Colors**: `var(--text)`, `var(--input-text)`
- **Borders**: `var(--border)`, `var(--input-border)`, `var(--table-border)`
- **Interactive Elements**: Form inputs, buttons, and navigation elements
- **Data Tables**: Headers, rows, and borders adapt to theme

#### Theme-Aware Components
- **Authentication Pages**: Login and signup forms with themed inputs and backgrounds
- **Dashboard Interface**: Cards, tables, and navigation elements
- **Form Elements**: Input fields, buttons, and status indicators
- **Data Visualization**: Statistics cards and appointment listings

#### User Experience Features
- **Accessibility**: Proper contrast ratios maintained in both themes
- **Visual Consistency**: All UI elements adapt harmoniously
- **Performance**: CSS-only theme switching with no JavaScript overhead
- **Persistence**: Theme preference remembered across sessions
- **System Integration**: Respects user's OS-level dark mode preference

### State Management

#### Local State (useState)
- **User Data**: Current authenticated user information
- **Form Data**: Controlled inputs for forms
- **UI State**: Loading states, error messages, success notifications
- **Theme State**: Light/dark mode preference

#### Local Storage
- **Authentication Token**: `hms_token` - JWT for API authentication
- **User Data**: `hms_user` - Parsed user object
- **Theme Preference**: `hms_theme` - Light or dark mode

#### Data Fetching
- **useEffect**: Load data on component mount
- **Promise.all**: Fetch multiple endpoints simultaneously
- **Error Boundaries**: Graceful error handling

---

## System Integration

### Development Workflow

#### Backend Development
```bash
cd backend
npm install
npm start  # Runs on port 5000
```

#### Frontend Development
```bash
cd frontend
npm install
npm run dev  # Runs on port 5173 (Vite default)
```

### Production Build
```bash
# Backend
npm start

# Frontend
npm run build  # Creates dist/ folder
npm run preview  # Serve built files
```

### Environment Configuration

#### Backend (.env)
```
PORT=5000
JWT_SECRET=your-secret-key-here
```

#### Frontend (Environment Variables)
```javascript
// Can be configured via .env.local
VITE_API_URL=http://localhost:5000
```

### CORS Configuration
- **Backend**: `app.use(cors())` allows all origins in development
- **Production**: Should be configured to allow specific frontend domain

---

## Security Considerations

### Authentication Security
- **Token Storage**: localStorage (vulnerable to XSS)
- **Password Policies**: Minimum 6 characters
- **Session Management**: No token expiration implemented
- **HTTPS**: Should be used in production

### Data Protection
- **Password Hashing**: bcrypt with salt rounds
- **Input Validation**: Basic required field checks
- **SQL Injection**: Not applicable (JSON file storage)
- **XSS Protection**: React's built-in sanitization

### Access Control
- **Role-Based**: Frontend and backend role checking
- **API Guards**: Middleware authentication on protected routes
- **Data Filtering**: Users only see authorized data

---

## Future Enhancements

### Backend Improvements
- **Database**: Replace JSON with PostgreSQL/MySQL
- **Validation**: Add comprehensive input validation
- **Error Handling**: Structured error responses
- **Rate Limiting**: Prevent API abuse
- **Logging**: Request/response logging

### Frontend Improvements
- **Dark Mode**: ✅ Implemented - Complete light/dark theme system with persistence
- **State Management**: Redux or Context API for complex state
- **Component Library**: Styled-components or Tailwind CSS
- **Testing**: Unit and integration tests
- **Performance**: Code splitting and lazy loading
- **PWA**: Service workers for offline capability

### Feature Additions
- **Email Notifications**: Appointment reminders
- **Calendar Integration**: Visual appointment scheduling
- **Medical Records**: Detailed patient history
- **Payment Integration**: Billing and insurance
- **Mobile App**: React Native companion app

---

## Conclusion

This Hospital Management System demonstrates a complete full-stack application with modern web technologies. The backend provides a secure REST API with JWT authentication and role-based access control, while the frontend delivers a polished user experience with React and responsive design.

The system successfully implements core healthcare management features:
- **User Authentication**: Secure login/signup with role management
- **Appointment Scheduling**: Book and manage medical appointments
- **Patient Management**: Register and track patient information
- **Role-Based Dashboards**: Different interfaces for patients, doctors, and admins

The architecture is designed for scalability, with clear separation of concerns between frontend and backend, making it easy to extend with additional features as the healthcare system grows.</content>
<parameter name="filePath">c:\Users\roysh\OneDrive\Desktop\majorProject\explain.md