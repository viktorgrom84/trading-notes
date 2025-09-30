# Trading Notes App

A full-stack trading notes application built with React, Vite, and PostgreSQL. Track your trading performance with detailed notes, statistics, and charts.

## 🚀 Features

- **User Authentication** - Secure login/registration with JWT tokens
- **Trading Notes** - Add, edit, and delete trading entries
- **Statistics Dashboard** - View profit/loss, win rate, and performance metrics
- **Responsive Design** - Modern UI with Mantine components
- **Real-time Data** - Connected to PostgreSQL database

## 🛠️ Tech Stack

- **Frontend:** React 18, Vite, Mantine UI
- **Backend:** Node.js, Express (local dev), Vercel Functions (production)
- **Database:** PostgreSQL with node-postgres
- **Authentication:** JWT tokens with bcrypt password hashing
- **Charts:** Recharts for data visualization

## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd trading-notes
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Create a `.env` file in the root directory:
   ```
   viktor_POSTGRES_URL="your-postgres-connection-string"
   JWT_SECRET="your-jwt-secret"
   ADMIN_USERNAME="your-admin-email@example.com"
   ```

## 🏃‍♂️ Development

### **Local Development with Real Database**

1. **Start the local API server**
   ```bash
   npm run dev:api
   ```

2. **Start the frontend** (in a new terminal)
   ```bash
   npm run dev
   ```

3. **Or run both together**
   ```bash
   npm run dev:full
   ```

4. **Open your browser** to `http://localhost:5173`

### **API Endpoints**

The application uses Vercel serverless functions for the API:

- `POST /api/init-db` - Initialize database tables
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/trades` - Get user's trades
- `POST /api/trades` - Create new trade
- `PUT /api/trades/:id` - Update trade
- `DELETE /api/trades/:id` - Delete trade
- `GET /api/statistics` - Get trading statistics

## 🚀 Production Deployment

### **Vercel Deployment**

1. **Connect to Vercel**
   ```bash
   vercel link
   ```

2. **Set environment variables in Vercel dashboard:**
   - `viktor_POSTGRES_URL` - Your PostgreSQL connection string
   - `JWT_SECRET` - Your JWT secret key
   - `ADMIN_USERNAME` - Admin user email for admin panel access

3. **Deploy**
   ```bash
   git push origin main
   ```

### **Database Setup**

The app uses PostgreSQL with node-postgres for database management:

1. **Initialize database tables**
   Visit: `https://your-app.vercel.app/api/init-db`

## 📊 Database Schema

### **Users Table**
- `id` - Primary key
- `username` - Unique username
- `password_hash` - Hashed password
- `created_at` - Account creation timestamp

### **Trades Table**
- `id` - Primary key
- `user_id` - Foreign key to users
- `symbol` - Stock symbol (e.g., AAPL)
- `shares` - Number of shares
- `buy_price` - Purchase price per share
- `buy_date` - Purchase date
- `sell_price` - Sale price per share (optional)
- `sell_date` - Sale date (optional)
- `notes` - Additional notes (optional)
- `created_at` - Trade creation timestamp
- `updated_at` - Last update timestamp

## 🔧 Configuration

### **Environment Variables**

| Variable | Description | Required |
|----------|-------------|----------|
| `viktor_POSTGRES_URL` | PostgreSQL connection string | Yes |
| `JWT_SECRET` | Secret key for JWT tokens | Yes |
| `ADMIN_USERNAME` | Admin user email for admin panel | Yes |

### **Vite Configuration**

The app uses Vite for local development:
- Frontend: `http://localhost:5173`
- API: Vercel serverless functions (production)

## 📱 Usage

1. **Register** a new account or **login** with existing credentials
2. **Add trading notes** with buy/sell information
3. **View statistics** on the dashboard
4. **Track performance** with detailed metrics

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

If you encounter any issues:

1. Check the console for error messages
2. Verify environment variables are set correctly
3. Ensure the database connection is working
4. Check the API server logs

For additional help, please open an issue on GitHub.