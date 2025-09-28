# Vercel Environment Variables Setup

## Required Environment Variables

Add these environment variables in your Vercel project settings:

### 1. Database (Already Added)
- `viktor_POSTGRES_URL` - ✅ Already configured

### 2. JWT Secret (Need to Add)
- **Name:** `JWT_SECRET`
- **Value:** `your-super-secret-jwt-key-2024-trading-notes`
- **Environment:** All (Development, Preview, Production)

## How to Add JWT_SECRET:

1. Go to your Vercel project dashboard
2. Click on **"Settings"** tab
3. Click on **"Environment Variables"** in the left sidebar
4. Click **"Add New"**
5. Fill in:
   - **Name:** `JWT_SECRET`
   - **Value:** `your-super-secret-jwt-key-2024-trading-notes`
   - **Environment:** Select all three (Development, Preview, Production)
6. Click **"Save"**

## After Adding Variables:

1. **Redeploy** your project (or it will auto-redeploy)
2. **Initialize the database** by visiting: `https://trading-notes.vercel.app/api/init-db`
3. **Test registration** at: `https://trading-notes.vercel.app`

## Current Status:
- ✅ Database connection configured
- ⏳ JWT_SECRET needs to be added
- ⏳ Database needs to be initialized
