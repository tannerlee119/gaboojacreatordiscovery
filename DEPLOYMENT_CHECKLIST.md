# AWS Deployment Checklist ✅

Quick checklist to deploy your app to AWS Lightsail:

## Before You Start
- [ ] AWS account created
- [ ] Credit card added to AWS (for billing, but we'll stay in free tier)
- [ ] Environment variables ready:
  - [ ] Supabase URL and keys
  - [ ] OpenAI API key  
  - [ ] Instagram cookies (JSON format)

## Step 1: Create Lightsail Instance
- [ ] Go to [AWS Lightsail Console](https://lightsail.aws.amazon.com)
- [ ] Create Ubuntu 22.04 instance ($5/month)
- [ ] Wait for instance to be "Running"
- [ ] Note down the public IP address

## Step 2: Connect and Setup
- [ ] Connect via browser SSH
- [ ] Run setup script:
  ```bash
  curl -fsSL https://raw.githubusercontent.com/tannerlee119/gaboojacreatordiscovery/main/aws/lightsail-setup.sh -o setup.sh
  chmod +x setup.sh
  ./setup.sh
  ```

## Step 3: Configure Environment
- [ ] Edit environment file: `nano .env.production`
- [ ] Replace all placeholder values with your actual keys
- [ ] Save file (Ctrl+X, Y, Enter)

## Step 4: Deploy
- [ ] Run deployment:
  ```bash
  cd gaboojacreatordiscovery
  docker-compose -f docker/docker-compose.yml --env-file .env.production up -d
  ```
- [ ] Check services are running: `docker-compose -f docker/docker-compose.yml ps`

## Step 5: Test
- [ ] Visit `http://YOUR-SERVER-IP` in browser
- [ ] Test discovery page: `http://YOUR-SERVER-IP/discovery`
- [ ] Test creator analysis: `http://YOUR-SERVER-IP/analyze`

## Optional: Domain Setup
- [ ] Point your domain's A record to server IP
- [ ] Set up SSL certificate with Certbot
- [ ] Test HTTPS access

---

## 🚨 Need Help?

1. **Can't connect to server**: Check Lightsail firewall settings
2. **App won't start**: Check logs with `docker-compose logs app`
3. **Performance issues**: Monitor with `htop` and `docker stats`
4. **Environment errors**: Double-check your `.env.production` file

## 📞 Quick Commands

```bash
# Check status
docker-compose -f docker/docker-compose.yml ps

# View logs
docker-compose -f docker/docker-compose.yml logs -f app

# Restart everything
docker-compose -f docker/docker-compose.yml restart

# Update app
git pull && docker-compose -f docker/docker-compose.yml up -d --build
```

**Estimated setup time**: 30-45 minutes
**Monthly cost**: ~$5 USD