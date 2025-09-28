#!/bin/bash

echo "🚀 Deploying Trading Notes App to Vercel..."

# Build the project
echo "📦 Building project..."
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
    
    # Check if Vercel CLI is installed
    if command -v vercel &> /dev/null; then
        echo "🚀 Deploying to Vercel..."
        vercel --prod
    else
        echo "⚠️  Vercel CLI not found. Please install it first:"
        echo "   npm i -g vercel"
        echo ""
        echo "📋 Manual deployment steps:"
        echo "1. Push your code to GitHub"
        echo "2. Go to https://vercel.com"
        echo "3. Import your repository"
        echo "4. Deploy!"
    fi
else
    echo "❌ Build failed. Please fix the errors and try again."
    exit 1
fi
