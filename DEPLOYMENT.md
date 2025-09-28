# Vercel Deployment Guide

This guide will help you deploy your Trading Notes app to Vercel with a full backend using Vercel Functions and Postgres.

## 🚀 **Quick Deploy (Recommended)**

### Step 1: Deploy to Vercel
1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Click "New Project"
4. Import your repository
5. Vercel will automatically detect it's a Vite project

### Step 2: Set up Vercel Postgres
1. In your Vercel dashboard, go to your project
2. Click on the "Storage" tab
3. Click "Create Database" → "Postgres"
4. Name it "trading-notes-db"
5. Copy the connection string

### Step 3: Configure Environment Variables
In your Vercel project settings:
1. Go to "Settings" → "Environment Variables"
2. Add these variables:
   - `POSTGRES_URL`: Your Postgres connection string
   - `JWT_SECRET`: A random secret key (use a password generator)

### Step 4: Initialize Database
1. After deployment, visit: `https://your-app.vercel.app/api/init-db`
2. This will create the necessary database tables

## 🔧 **Manual Setup (Alternative)**

### Option 1: Vercel CLI
```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy
vercel

# Set environment variables
vercel env add POSTGRES_URL
vercel env add JWT_SECRET

# Deploy to production
vercel --prod
```

### Option 2: GitHub Integration
1. Connect your GitHub repository to Vercel
2. Vercel will automatically deploy on every push
3. Set environment variables in Vercel dashboard
4. Visit `/api/init-db` to initialize database

## 📊 **Database Setup**

The app uses Vercel Postgres with these tables:

### Users Table
- `id`: Primary key
- `username`: Unique username
- `password_hash`: Hashed password
- `created_at`: Timestamp

### Trades Table
- `id`: Primary key
- `user_id`: Foreign key to users
- `symbol`: Stock symbol
- `shares`: Number of shares
- `buy_price`: Buy price per share
- `buy_date`: Buy date
- `sell_price`: Sell price (optional)
- `sell_date`: Sell date (optional)
- `notes`: Additional notes
- `created_at`: Timestamp

## 🔐 **Security Features**

- **Password Hashing**: Uses bcryptjs for secure password storage
- **JWT Authentication**: Secure token-based authentication
- **CORS Protection**: Proper CORS headers for API security
- **Input Validation**: Server-side validation for all inputs
- **SQL Injection Protection**: Uses parameterized queries

## 🌐 **API Endpoints**

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user

### Trades
- `GET /api/trades` - Get all trades for user
- `POST /api/trades` - Create new trade
- `PUT /api/trades/[id]` - Update trade
- `DELETE /api/trades/[id]` - Delete trade

### Statistics
- `GET /api/statistics` - Get trading statistics

### Database
- `POST /api/init-db` - Initialize database tables

## 🚨 **Troubleshooting**

### Common Issues

1. **Database Connection Error**
   - Check if `POSTGRES_URL` is set correctly
   - Ensure database is created in Vercel dashboard

2. **Authentication Issues**
   - Verify `JWT_SECRET` is set
   - Check if database tables are initialized

3. **API Errors**
   - Check Vercel function logs
   - Ensure all environment variables are set

### Debug Steps

1. Check Vercel function logs in dashboard
2. Test API endpoints directly
3. Verify database connection
4. Check environment variables

## 📱 **Features**

✅ **User Authentication** - Secure login/register
✅ **Trading Notes** - Add, edit, delete trades
✅ **Statistics Dashboard** - Comprehensive analytics
✅ **Interactive Charts** - Visual performance tracking
✅ **Responsive Design** - Works on all devices
✅ **Real-time Updates** - Live data synchronization
✅ **Data Persistence** - Secure database storage
✅ **Multi-user Support** - Each user has their own data

## 🔄 **Data Migration**

If you have existing data in localStorage:
1. Export your data before deploying
2. After deployment, manually add your trades
3. Or create a migration script to import data

## 💰 **Costs**

- **Vercel**: Free tier includes 100GB bandwidth
- **Vercel Postgres**: Free tier includes 1GB storage
- **Vercel Functions**: Free tier includes 100GB-hours

Perfect for personal use and small-scale applications!

## 🎯 **Next Steps**

After deployment:
1. Test all features
2. Add your first trades
3. Explore the statistics
4. Share with others if needed

Your trading notes app is now live with a full backend! 🎉
