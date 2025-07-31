# 🛠️ SUINFI Backend

This is the backend for **SUINFI**, a real-time mobile app that connects users with professionals. Built using Node.js, Express, and MongoDB following best practices (MVC, middlewares, validations, JWT auth, etc.).

---

## 🚀 Tech Stack

- Node.js + Express
- MongoDB + Mongoose
- JWT Authentication
- Faker.js (for seeding)
- Dotenv, Bcrypt, Multer
- MVC architecture + middlewares

---

## 📦 Key Features

- ✅ JWT login/register with role support (`user`, `professional`)
- ✅ Booking system between users and professionals
- ✅ Professional profiles with geolocation + availability
- ✅ Reviews and ratings
- ✅ Favorites list
- ✅ Real-time chat structure
- ✅ Notifications system
- ✅ Seeding with random data for development

---

## 🔑 Main Endpoints (sample)

- `POST /api/auth/login`
- `POST /api/bookings` → Create booking
- `POST /api/reviews` → Leave a review
- `GET /api/professionals?categoryId=...`
- `PATCH /api/professionals/availability-now` → Toggle availability
- `GET /api/favorites` → List favorites
- `POST /api/messages` → Send chat message
- `POST /api/notifications` → Trigger notification

---

## 🧪 Development

```bash
npm install
npm run dev
node src/seed/professionals.seed.js
