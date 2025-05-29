#!/bin/bash

# Onion Todo API Demo Startup Script

echo "🚀 Starting Onion Todo API Demo..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

echo "📦 Starting PostgreSQL database..."
docker-compose up -d

echo "⏳ Waiting for PostgreSQL to be ready..."
sleep 10

echo "🔧 Setting up database..."
npm run db:setup

echo "🎯 Running demo..."
npm run demo

echo ""
echo "✨ Demo completed! You can now:"
echo "  - Run the API server: npm run dev"
echo "  - Test the API: curl http://localhost:3000/todos/search"
echo "  - View docs: curl http://localhost:3000/docs"
echo ""
echo "🛑 To stop the database: docker-compose down"
