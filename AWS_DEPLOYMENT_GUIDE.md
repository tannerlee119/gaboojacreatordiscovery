# AWS Lightsail Deployment Guide

Complete step-by-step guide to deploy Gabooja Creator Discovery on AWS Lightsail for ~$5/month.

## Prerequisites

- AWS Account (free tier available)
- Your environment variables ready:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` 
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `OPENAI_API_KEY`
  - `INSTAGRAM_COOKIES_JSON`

## Step 1: Create AWS Account & Lightsail Instance

### 1.1 Create AWS Account
1. Go to [aws.amazon.com](https://aws.amazon.com)
2. Click "Create an AWS Account"
3. Follow signup process (requires credit card, but we'll stay in free tier)

### 1.2 Create Lightsail Instance
1. Go to [AWS Lightsail Console](https://lightsail.aws.amazon.com)
2. Click "Create instance"
3. Choose:
   - **Platform**: Linux/Unix
   - **Blueprint**: Ubuntu 22.04 LTS
   - **Instance plan**: $5 USD (1 GB RAM, 1 vCPU, 40 GB SSD)
   - **Instance name**: `gabooja-creator-discovery`
4. Click "Create instance"
5. Wait 2-3 minutes for instance to start

## Step 2: Connect to Your Server

### Option A: Browser-based SSH (Easiest)
1. In Lightsail console, click your instance name
2. Click "Connect using SSH"
3. A browser terminal will open

### Option B: Local SSH (Advanced)
1. Download SSH key from Lightsail console
2. Use terminal: `ssh -i your-key.pem ubuntu@your-server-ip`

## Step 3: Run Setup Script

In your server terminal, run these commands:

```bash
# Download and run the setup script
curl -fsSL https://raw.githubusercontent.com/tannerlee119/gaboojacreatordiscovery/main/aws/lightsail-setup.sh -o setup.sh
chmod +x setup.sh
./setup.sh
```

This will:
- Install Docker and Docker Compose
- Clone your repository
- Create environment template

## Step 4: Configure Environment Variables

Edit the environment file with your actual values:

```bash
nano .env.production
```

Replace the placeholder values:
```env
NODE_ENV=production
REDIS_URL=redis://redis:6379

# Replace these with your actual values
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
OPENAI_API_KEY=sk-your-openai-key-here
INSTAGRAM_COOKIES_JSON='[{"name":"sessionid","value":"your-session-id",...}]'
```

**Save and exit**: Press `Ctrl+X`, then `Y`, then `Enter`

## Step 5: Deploy Application

```bash
# Navigate to project directory
cd gaboojacreatordiscovery

# Start all services
docker-compose -f docker/docker-compose.yml --env-file .env.production up -d

# Check if everything is running
docker-compose -f docker/docker-compose.yml ps
```

You should see 3 services running:
- `app` (your Next.js application)
- `redis` (caching)
- `nginx` (web server)

## Step 6: Test Your Deployment

1. Get your server's IP address from Lightsail console
2. Visit `http://YOUR-SERVER-IP` in your browser
3. Test the discovery page: `http://YOUR-SERVER-IP/discovery`

## Step 7: Configure Domain (Optional)

### 7.1 Point Domain to Server
1. In your domain registrar, create an A record:
   - **Name**: `@` (or your subdomain)
   - **Value**: Your Lightsail server IP
2. Wait for DNS propagation (5-60 minutes)

### 7.2 Set up SSL Certificate
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get SSL certificate (replace with your domain)
sudo certbot --nginx -d yourdomain.com

# Auto-renewal (optional)
sudo crontab -e
# Add this line:
# 0 12 * * * /usr/bin/certbot renew --quiet
```

## Useful Commands

### Monitor Application
```bash
# View logs
docker-compose -f docker/docker-compose.yml logs -f app

# Check service status
docker-compose -f docker/docker-compose.yml ps

# Restart services
docker-compose -f docker/docker-compose.yml restart
```

### Update Application
```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker-compose -f docker/docker-compose.yml up -d --build
```

### Backup Redis Data
```bash
# Create backup
docker exec $(docker-compose -f docker/docker-compose.yml ps -q redis) redis-cli BGSAVE

# Copy backup file
docker cp $(docker-compose -f docker/docker-compose.yml ps -q redis):/data/dump.rdb ./backup-$(date +%Y%m%d).rdb
```

## Monitoring & Maintenance

### Check Resource Usage
```bash
# System resources
htop

# Docker resources
docker stats

# Disk space
df -h
```

### Scaling Up (If Needed)
1. Go to Lightsail console
2. Click your instance → "Manage" → "Snapshots"
3. Create snapshot
4. Create new larger instance from snapshot
5. Update DNS to point to new instance

## Troubleshooting

### Application Won't Start
```bash
# Check logs
docker-compose -f docker/docker-compose.yml logs app

# Common issues:
# - Environment variables not set correctly
# - Port already in use
# - Insufficient memory
```

### Redis Issues
```bash
# Check Redis connection
docker-compose -f docker/docker-compose.yml exec redis redis-cli ping

# Should return: PONG
```

### Performance Issues
```bash
# Check memory usage
free -h

# If low on memory, restart services:
docker-compose -f docker/docker-compose.yml restart
```

## Cost Optimization

- **Monitor usage**: Check Lightsail metrics weekly
- **Enable alerts**: Set up billing alerts in AWS
- **Optimize images**: Use smaller Docker base images
- **Clean up**: Remove unused Docker images regularly

```bash
# Clean up Docker
docker system prune -f
```

## Security Best Practices

1. **Firewall**: Only open ports 80, 443, and 22
2. **Updates**: Regular system updates
3. **Backups**: Weekly Redis backups
4. **Monitoring**: Set up CloudWatch alerts
5. **SSH**: Disable password auth, use keys only

---

## Expected Monthly Cost: ~$5-10 USD

- Lightsail instance: $5/month
- Data transfer: Usually free (1TB included)
- Domain (optional): ~$10-15/year

**Total**: Much cheaper than managed platforms while giving you full control!