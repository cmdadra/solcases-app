# Privy Wallet Integration

A clean, minimal implementation of Privy's embedded wallet creation for Solana.

## 🚀 Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment:**
   ```bash
   cp env.template .env
   ```

3. **Configure Privy (Required for real wallets):**
   - Go to [Privy Dashboard](https://dashboard.privy.io/)
   - Login and select your app
   - Go to Settings → API Keys
   - Copy your App Secret
   - Edit `.env` and replace `your-privy-app-secret-here` with your real secret

4. **Start the server:**
   ```bash
   npm start
   ```

5. **Open demo:**
   ```
   http://localhost:3001
   ```

## 🔧 API Endpoints

- `POST /api/create-wallet` - Create new Solana wallet via Privy
- `GET /api/wallet` - Get current wallet info
- `POST /api/clear-session` - Clear session data
- `GET /api/health` - Service health check

## 📋 Features

- ✅ **Real Solana wallets** via Privy embedded wallet service
- ✅ **No browser extension needed** - wallets are embedded
- ✅ **Session management** - maintains wallet across page refreshes
- ✅ **Clean API** - simple REST endpoints
- ✅ **Demo page** - test wallet creation immediately

## 🔐 Configuration

The integration requires a Privy App Secret to create real wallets. Without it, the service runs in demo mode.

**Environment Variables:**
```env
PRIVY_APP_ID=your-privy-app-id
PRIVY_APP_SECRET=your-privy-app-secret
PORT=3001
```

## 🎯 Integration Guide

To integrate this into your project:

1. **Copy the core files:**
   - `privy-wallet.js` - Main server with Privy integration
   - `env.template` - Environment configuration

2. **Install dependencies:**
   ```bash
   npm install cors dotenv express node-fetch
   ```

3. **Use the API:**
   ```javascript
   // Create wallet
   const response = await fetch('/api/create-wallet', {
     method: 'POST',
     credentials: 'include'
   });
   const wallet = await response.json();
   
   // wallet.walletAddress contains the Solana address
   ```

## 📦 Dependencies

- `express` - Web server
- `cors` - CORS middleware
- `dotenv` - Environment variables
- `node-fetch` - HTTP client for Privy API

## 🛠️ Development

```bash
npm run dev  # Start with nodemon for auto-restart
```

## 🔗 Links

- [Privy Dashboard](https://dashboard.privy.io/)
- [Privy Documentation](https://docs.privy.io/)
- [Solana Explorer](https://explorer.solana.com/)

---

**Ready to integrate into any Solana project! 🚀**
