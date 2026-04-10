#!/bin/bash
# EC2 Setup Script for Chatbot Backend
# Run this script on a fresh Ubuntu EC2 instance

set -e

echo "🚀 Setting up Chatbot Backend on EC2..."

# Update system
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Python 3.11
echo "🐍 Installing Python 3.11..."
sudo apt install -y python3.11 python3.11-venv python3-pip git

# Install system dependencies for ChromaDB
echo "🔧 Installing build dependencies..."
sudo apt install -y gcc g++ build-essential

# Install Node.js and PM2
echo "📦 Installing Node.js and PM2..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2

# Create app directory
echo "📁 Creating app directory..."
mkdir -p /home/ubuntu/chatbot
cd /home/ubuntu/chatbot

# Create virtual environment
echo "🔨 Creating Python virtual environment..."
python3.11 -m venv venv
source venv/bin/activate

# Install Python dependencies
echo "📥 Installing Python dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

# Create necessary directories
echo "📂 Creating directories..."
mkdir -p vector_db DATABSE

# Create .env file template
echo "📝 Creating .env template..."
cat > .env.template << EOF
GOOGLE_GEMINI_API_KEY=your_key_here
AUTH0_DOMAIN=your_domain.auth0.com
AUTH0_AUDIENCE=your_audience
AUTH0_CLIENT_ID=your_client_id
AUTH0_CLIENT_SECRET=your_secret
AUTH0_NEXTJS_URL=https://your-app.amplifyapp.com
DATABASE_PATH=/home/ubuntu/chatbot/chatbot.db
VECTOR_DB_PATH=/home/ubuntu/chatbot/vector_db
KNOWLEDGE_BASE_PATH=/home/ubuntu/chatbot/DATABSE
EOF

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Copy your code to /home/ubuntu/chatbot"
echo "2. Copy .env.template to .env and fill in your values"
echo "3. Upload DATABSE folder files"
echo "4. Run: source venv/bin/activate && python initialize_db.py"
echo "5. Start with PM2: pm2 start 'venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000' --name chatbot"
echo "6. Save PM2: pm2 save && pm2 startup"

