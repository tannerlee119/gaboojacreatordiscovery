#!/bin/bash

# AWS Lightsail Setup Script for Gabooja Creator Discovery
# Run this script on your Lightsail instance

echo "🚀 Setting up Gabooja Creator Discovery on AWS Lightsail..."

# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.21.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Install Git
sudo apt install -y git

# Clone your repository (replace with your actual repo)
echo "📦 Cloning repository..."
git clone https://github.com/tannerlee119/gaboojacreatordiscovery.git
cd gaboojacreatordiscovery

# Create environment file
echo "📝 Creating environment file..."
cat > .env.production << 'EOF'
NODE_ENV=production
REDIS_URL=redis://redis:6379

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here

# OpenAI API Key
OPENAI_API_KEY=your_openai_api_key_here

# Instagram Cookies (JSON format)
INSTAGRAM_COOKIES_JSON=your_instagram_cookies_here

# TikTok Cookies (optional)
TIKTOK_COOKIES_JSON=your_tiktok_cookies_here
EOF

echo "✅ Setup complete! Next steps:"
echo "1. Edit .env.production with your actual environment variables"
echo "2. Run: docker-compose -f docker/docker-compose.yml --env-file .env.production up -d"
echo "3. Your app will be available at http://your-lightsail-ip"
echo ""
echo "💡 Don't forget to:"
echo "- Configure your domain to point to this Lightsail instance"
echo "- Set up SSL certificates for HTTPS"
echo "- Configure backups for your Redis data"