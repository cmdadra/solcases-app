const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const WebSocket = require('ws');
const http = require('http');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
    origin: ['https://solcases.fun', 'null', 'file://'],
    credentials: true
}));
app.use(express.json());
app.use(express.static('.'));
app.use('/Downloads', express.static('Downloads'));
app.use('/images', express.static('images'));

// Add debugging for static file requests
app.use('/Downloads', (req, res, next) => {
    console.log(`📁 Downloads request: ${req.url}`);
    next();
});

app.use('/images', (req, res, next) => {
    console.log(`🖼️ Images request: ${req.url}`);
    // Check if file exists
    const filePath = path.join(__dirname, 'images', req.url);
    if (fs.existsSync(filePath)) {
        console.log(`✅ Image found: ${filePath}`);
    } else {
        console.log(`❌ Image not found: ${filePath}`);
        // Try to serve a fallback or return 404 with more info
        console.log(`🔍 Looking for: ${filePath}`);
        console.log(`📁 Images directory contents:`, fs.readdirSync(path.join(__dirname, 'images')));
    }
    next();
});

// Simple session storage
const sessionStore = new Map();

// Load sessions from file
const SESSIONS_FILE = path.join(__dirname, 'sessions.json');

function loadSessions() {
    try {
        if (fs.existsSync(SESSIONS_FILE)) {
            const data = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
            console.log('🔐 Loaded', Object.keys(data).length, 'sessions from file');
            for (const [sessionId, sessionData] of Object.entries(data)) {
                sessionStore.set(sessionId, sessionData);
            }
        }
    } catch (error) {
        console.error('❌ Failed to load sessions:', error);
    }
}

function saveSessions() {
    try {
        const data = Object.fromEntries(sessionStore);
        fs.writeFileSync(SESSIONS_FILE, JSON.stringify(data, null, 2));
        console.log('💾 Saved', sessionStore.size, 'sessions to file');
    } catch (error) {
        console.error('❌ Failed to save sessions:', error);
    }
}

// Load existing sessions
loadSessions();

// Global stats tracking
const globalStats = {
    activeUsers: new Set(),
    userActivity: {},
    packsOpened: 0,
    solWon: 0,
    houseProfits: 0
};

// Collection system configuration
const collectionRewards = {
    common: {
        required: 50,
        reward: {
            type: 'sol',
            value: 0.001 // 0.001 SOL reward
        }
    },
    uncommon: {
        required: 30,
        reward: {
            type: 'sol',
            value: 0.005 // 0.005 SOL reward
        }
    },
    rare: {
        required: 20,
        reward: {
            type: 'sol',
            value: 0.02 // 0.02 SOL reward
        }
    },
    epic: {
        required: 15,
        reward: {
            type: 'sol',
            value: 0.05 // 0.05 SOL reward
        }
    },
    legendary: {
        required: 10,
        reward: {
            type: 'sol',
            value: 0.1 // 0.1 SOL reward
        }
    },
    mythic: {
        required: 10,
        reward: {
            type: 'sol',
            value: 0.2 // 0.2 SOL reward
        }
    },
    divine: {
        required: 5,
        reward: {
            type: 'sol',
            value: 0.5 // 0.5 SOL reward
        }
    }
};

// Calculate total potential rewards (for house edge calculation)
const totalPotentialRewards = Object.values(collectionRewards).reduce((total, collection) => {
    return total + collection.reward.value;
}, 0);

console.log(`🎯 Collection system initialized - Total potential rewards: ${totalPotentialRewards} SOL`);

// Calculate house edge for collection system
function calculateCollectionHouseEdge() {
    // Assuming average pack cost is 0.1 SOL (weighted average of all pack types)
    const averagePackCost = 0.1;
    
    // Calculate total cost to complete all collections
    // This is a rough estimate - in reality, it would depend on drop rates
    const estimatedPacksToCompleteAll = 500; // More realistic estimate
    const totalCost = estimatedPacksToCompleteAll * averagePackCost;
    
    // Total potential rewards
    const totalRewards = totalPotentialRewards;
    
    // House edge calculation
    const houseEdge = ((totalCost - totalRewards) / totalCost) * 100;
    
    console.log(`📊 Collection House Edge Analysis:`);
    console.log(`   Estimated cost to complete all collections: ${totalCost} SOL`);
    console.log(`   Total potential rewards: ${totalRewards} SOL`);
    console.log(`   House edge: ${houseEdge.toFixed(2)}%`);
    console.log(`   Collection system impact: ${(totalRewards / totalCost * 100).toFixed(2)}% of house edge`);
    
    return houseEdge;
}

// Calculate and log house edge
const collectionHouseEdge = calculateCollectionHouseEdge();

// Collection tracking functions
function initializeUserCollections(sessionId) {
    const sessionData = sessionStore.get(sessionId);
    
    
    if (!sessionData.collections) {
        sessionData.collections = {
            common: new Set(),
            uncommon: new Set(),
            rare: new Set(),
            epic: new Set(),
            legendary: new Set(),
            mythic: new Set(),
            divine: new Set()
        };
        sessionData.completedCollections = new Set();
        sessionData.collectionRewards = [];
        sessionStore.set(sessionId, sessionData);
    } else {
        // Convert arrays to Sets if they exist
        for (const rarity of ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'divine']) {
            if (Array.isArray(sessionData.collections[rarity])) {
                
                sessionData.collections[rarity] = new Set(sessionData.collections[rarity]);
            } else if (!(sessionData.collections[rarity] instanceof Set)) {
                sessionData.collections[rarity] = new Set();
            }
        }
        
        // Convert completedCollections to Set if it's an array
        if (Array.isArray(sessionData.completedCollections)) {
            sessionData.completedCollections = new Set(sessionData.completedCollections);
        } else if (!(sessionData.completedCollections instanceof Set)) {
            sessionData.completedCollections = new Set();
        }
        
        sessionStore.set(sessionId, sessionData);
    }
    
    
    return sessionData;
}

function addCardToCollection(sessionId, cardName, rarity) {
    const userData = initializeUserCollections(sessionId);
    
    if (!userData.collections[rarity]) {
        userData.collections[rarity] = new Set();
    }
    
    userData.collections[rarity].add(cardName);
    
    // Check if collection is completed
    const collectionConfig = collectionRewards[rarity];
    if (collectionConfig && userData.collections[rarity].size >= collectionConfig.required) {
        if (!userData.completedCollections.has(rarity)) {
            userData.completedCollections.add(rarity);
            userData.collectionRewards.push({
                rarity: rarity,
                reward: collectionConfig.reward,
                completedAt: new Date().toISOString()
            });
            
            console.log(`🎉 Session ${sessionId} completed ${rarity} collection! Reward: ${collectionConfig.reward.value} SOL`);
            return {
                completed: true,
                rarity: rarity,
                reward: collectionConfig.reward
            };
        }
    }
    
    return { completed: false };
}

function getUserCollectionProgress(sessionId) {
    const userData = initializeUserCollections(sessionId);
    const progress = {};
    
    for (const [rarity, config] of Object.entries(collectionRewards)) {
        const collected = userData.collections[rarity] ? userData.collections[rarity].size : 0;
        const required = config.required;
        const completed = userData.completedCollections.has(rarity);
        
        progress[rarity] = {
            collected: collected,
            required: required,
            completed: completed,
            progress: Math.min(100, (collected / required) * 100)
        };
    }
    
    return progress;
}

function claimCollectionReward(sessionId, rarity) {
    const userData = initializeUserCollections(sessionId);
    
    if (!userData.completedCollections.has(rarity)) {
        return { success: false, error: 'Collection not completed' };
    }
    
    // Find the reward
    const reward = userData.collectionRewards.find(r => r.rarity === rarity && !r.claimed);
    if (!reward) {
        return { success: false, error: 'Reward already claimed' };
    }
    
    // Mark as claimed
    reward.claimed = true;
    reward.claimedAt = new Date().toISOString();
    
    return {
        success: true,
        reward: reward.reward
    };
}

// Session middleware
app.use((req, res, next) => {
    // Extract session ID from headers first (localStorage), then cookies
    let sessionId = req.headers['x-session-id'];
    
    if (!sessionId && req.headers.cookie) {
        const cookies = req.headers.cookie.split(';');
        for (let cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === 'privy-session') {
                sessionId = value;
                break;
            }
        }
    }
    
    // Create new session if none exists
    if (!sessionId) {
        sessionId = Math.random().toString(36).substring(2);
    }
    
    req.session = sessionStore.get(sessionId) || {};
    req.sessionId = sessionId;
    
    const hasExistingData = Object.keys(req.session).length > 0;
    
    console.log(`🔍 Session middleware: ID=${sessionId}, hasData=${hasExistingData}, userId=${req.session.userId}`);
    
    // Always set session cookie with longer expiration
    res.setHeader('Set-Cookie', `privy-session=${sessionId}; HttpOnly; Max-Age=${90 * 24 * 60 * 60}; SameSite=Lax; Path=/; Secure`);
    
    const originalEnd = res.end;
    res.end = function(...args) {
        // Always save session data if it exists
        if (Object.keys(req.session).length > 0) {
            sessionStore.set(sessionId, req.session);
            saveSessions();
            console.log(`💾 Session saved: ID=${sessionId}, userId=${req.session.userId}`);
        }
        originalEnd.apply(this, args);
    };
    
    next();
});

// SECURITY: Session validation middleware for protected routes
function validateSession(req, res, next) {
    const sessionId = req.sessionId;
    const sessionData = sessionStore.get(sessionId);
    
    if (!sessionData || !sessionData.userId) {
        return res.status(401).json({
            success: false,
            message: 'Invalid or expired session'
        });
    }
    
    next();
}

// Privy configuration
const PRIVY_APP_ID = process.env.PRIVY_APP_ID || 'cme3zjfjl019el80by83w6zzb';
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET || 'your-privy-app-secret-here';

console.log('🔐 Privy Wallet Creation Service Starting...');

if (PRIVY_APP_SECRET === 'your-privy-app-secret-here') {
    console.log('⚠️  WARNING: Using default app secret!');
    console.log('🔧 To create REAL wallets:');
    console.log('   1. Go to https://dashboard.privy.io/');
    console.log('   2. Restart the server');
} else {
    console.log('✅ Real Privy App Secret configured!');
    console.log('🔥 Ready to create REAL Solana wallets!');
}

// Helper function to call Privy API
async function callPrivyAPI(method, endpoint, data = null) {
    const fetch = (await import('node-fetch')).default;
    
    const options = {
        method,
        headers: {
            'Authorization': `Basic ${Buffer.from(`${PRIVY_APP_ID}:${PRIVY_APP_SECRET}`).toString('base64')}`,
            'privy-app-id': PRIVY_APP_ID,
            'Content-Type': 'application/json'
        }
    };
    
    if (data) {
        options.body = JSON.stringify(data);
    }
    
    const response = await fetch(`https://api.privy.io/v1${endpoint}`, options);
    
    if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Privy API Error ${response.status}:`, errorText);
        throw new Error(`Privy API error: ${response.status} - ${errorText}`);
    }
    
    return await response.json();
}

// Create wallet endpoint
app.post('/api/create-wallet', async (req, res) => {
    try {
        // Check if user already has a wallet
        if (req.session.userId && req.session.walletAddress) {
            console.log('🔄 Returning existing wallet for user:', req.session.userId);
            return res.json({
                success: true,
                userId: req.session.userId,
                walletAddress: req.session.walletAddress,
                message: 'Existing wallet found',
                sessionId: req.sessionId
            });
        }

        console.log('🔐 Creating new Privy user with Solana wallet...');
        
        // Create new Privy user with embedded Solana wallet
        const userData = await callPrivyAPI('POST', '/users', {
            create_solana_wallet: true,
            linked_accounts: [{
                type: 'email',
                address: `user${Date.now()}@yourapp.com`
            }]
        });
        
        console.log('✅ User created:', userData.id);
        
        // Extract Solana wallet from linked accounts
        const solanaWallet = userData.linked_accounts?.find(account => 
            account.type === 'wallet' && account.chain_type === 'solana'
        );
        
        if (solanaWallet) {
            console.log('✅ Solana wallet created:', solanaWallet.address);
            
            // Store in session
            req.session.userId = userData.id;
            req.session.walletAddress = solanaWallet.address;
            
            res.json({
                success: true,
                userId: userData.id,
                walletAddress: solanaWallet.address,
                message: 'Solana wallet created successfully!',
                sessionId: req.sessionId
            });
        } else {
            throw new Error('No Solana wallet found in user response');
        }
        
    } catch (error) {
        console.error('❌ Wallet creation failed:', error);
        
        res.json({
            success: false,
            error: error.message,
            message: 'Failed to create wallet. Please try again.'
        });
    }
});

        // Get wallet info endpoint
        app.get('/api/wallet', (req, res) => {
            console.log(`🔍 Checking wallet session for session ID: ${req.sessionId}`);
            console.log(`🔍 Session data:`, {
                userId: req.session.userId,
                walletAddress: req.session.walletAddress,
                username: req.session.username,
                hasSession: !!req.session.userId
            });
            
            if (req.session.userId && req.session.walletAddress) {
                // Track as active user
                globalStats.activeUsers.add(req.session.userId);
                globalStats.userActivity[req.session.userId] = Date.now();
                
                res.json({
                    success: true,
                    userId: req.session.userId,
                    walletAddress: req.session.walletAddress,
                    username: req.session.username,
                    sessionId: req.sessionId
                });
            } else {
                res.json({
                    success: false,
                    message: 'No wallet found',
                    sessionId: req.sessionId
                });
            }
        });

// Save username endpoint
app.post('/api/save-username', (req, res) => {
    const { username } = req.body;
    
    if (!username || username.trim().length === 0) {
        return res.json({ success: false, message: 'Invalid username' });
    }
    
    if (username.length > 20) {
        return res.json({ success: false, message: 'Username too long' });
    }
    
    req.session.username = username.trim();
    sessionStore.set(req.sessionId, req.session);
    saveSessions();
    
    console.log(`💾 Username saved: ${username} for session ${req.sessionId}`);
    
    res.json({ 
        success: true, 
        message: 'Username saved successfully',
        username: username.trim()
    });
});

// Clear session endpoint
app.post('/api/clear-session', (req, res) => {
    if (req.session.userId) {
        globalStats.activeUsers.delete(req.session.userId);
        delete globalStats.userActivity[req.session.userId];
    }
    
    req.session = {};
    sessionStore.delete(req.sessionId);
    res.setHeader('Set-Cookie', 'privy-session=; HttpOnly; Max-Age=0; SameSite=Lax');
    res.json({ success: true, message: 'Session cleared' });
});

// Provably Fair System
const provablyFair = {
    // Store server seeds for each session
    serverSeeds: new Map(),
    
    // Generate a new server seed
    generateServerSeed() {
        return crypto.randomBytes(32).toString('hex');
    },
    
    // Generate client seed (can be provided by user or auto-generated)
    generateClientSeed() {
        return crypto.randomBytes(16).toString('hex');
    },
    
    // Create verifiable hash from server seed and client seed
    createHash(serverSeed, clientSeed) {
        const combined = serverSeed + clientSeed;
        return crypto.createHash('sha256').update(combined).digest('hex');
    },
    
    // Generate random number from hash (0-1)
    hashToRandom(hash) {
        // Use first 8 characters of hash to generate a number between 0 and 1
        const hex = hash.substring(0, 8);
        const decimal = parseInt(hex, 16);
        return decimal / 0xffffffff; // Normalize to 0-1
    },
    
    // Get next server seed for a session
    getNextServerSeed(sessionId) {
        if (!this.serverSeeds.has(sessionId)) {
            this.serverSeeds.set(sessionId, []);
        }
        
        const seeds = this.serverSeeds.get(sessionId);
        const serverSeed = this.generateServerSeed();
        seeds.push(serverSeed);
        
        // Keep only last 10 seeds to prevent memory issues
        if (seeds.length > 10) {
            seeds.shift();
        }
        
        return serverSeed;
    },
    
    // Get current server seed hash for verification
    getCurrentServerSeedHash(sessionId) {
        const seeds = this.serverSeeds.get(sessionId) || [];
        if (seeds.length === 0) return null;
        
        const currentSeed = seeds[seeds.length - 1];
        return this.createHash(currentSeed, 'pending');
    }
};

// Leveling system
function calculateLevel(xp) {
    if (xp < 100) return 1;
    if (xp < 250) return 2;
    if (xp < 450) return 3;
    if (xp < 700) return 4;
    if (xp < 950) return 5;
    if (xp < 1300) return 6;
    if (xp < 1800) return 7;
    if (xp < 2400) return 8;
    if (xp < 3100) return 9;
    if (xp < 3900) return 10;
    
    // For levels beyond 10, use a formula: level 11+ needs 500 + (level - 10) * 100 more XP
    let level = 10;
    let remainingXP = xp - 3900;
    while (remainingXP >= (500 + (level - 10) * 100)) {
        remainingXP -= (500 + (level - 10) * 100);
        level++;
    }
    return level;
}

function getXPForNextLevel(currentLevel) {
    if (currentLevel === 1) return 100;
    if (currentLevel === 2) return 150;
    if (currentLevel === 3) return 200;
    if (currentLevel === 4) return 250;
    if (currentLevel === 5) return 250;
    if (currentLevel === 6) return 350;
    if (currentLevel === 7) return 500;
    if (currentLevel === 8) return 600;
    if (currentLevel === 9) return 700;
    if (currentLevel === 10) return 800;
    
    // For levels beyond 10: 500 + (level - 10) * 100
    return 500 + (currentLevel - 10) * 100;
}

function getTotalXPForLevel(level) {
    if (level === 1) return 0;
    if (level === 2) return 100;
    if (level === 3) return 250;
    if (level === 4) return 450;
    if (level === 5) return 700;
    if (level === 6) return 950;
    if (level === 7) return 1300;
    if (level === 8) return 1800;
    if (level === 9) return 2400;
    if (level === 10) return 3100;
    
    // For levels beyond 10
    let totalXP = 3100; // XP needed for level 10
    for (let i = 11; i <= level; i++) {
        totalXP += getXPForNextLevel(i - 1);
    }
    return totalXP;
}

// Case opening endpoint
app.post('/api/open-case', async (req, res) => {
    try {
        const { caseType } = req.body;
        
        if (!req.session.userId || !req.session.walletAddress) {
            return res.json({
                success: false,
                message: 'Not authenticated'
            });
        }

        console.log(`🎁 Opening ${caseType} case for user:`, req.session.userId);
        
        // Track user activity
        globalStats.activeUsers.add(req.session.userId);
        globalStats.packsOpened += 1;
        
        // Case prices and payouts
        const casePrices = {
            starter: 0.001,
            pro: 0.01,
            elite: 0.1,
            whale: 1.0
        };
        
        const betAmount = casePrices[caseType] || casePrices.starter;
        
        // Check if user has enough balance
        if (!req.session.balance) req.session.balance = 1.0; // Give starting balance for demo
        if (req.session.balance < betAmount) {
            return res.status(400).json({
                success: false,
                message: 'Insufficient balance'
            });
        }

        // CRITICAL SECURITY FIX: Check if user is already in a pending transaction
        if (req.session.pendingTransaction) {
            return res.status(400).json({
                success: false,
                message: 'Transaction already in progress. Please wait for completion.'
            });
        }

        // CRITICAL SECURITY FIX: Lock the balance immediately to prevent refresh exploit
        req.session.pendingTransaction = {
            caseType: caseType,
            betAmount: betAmount,
            timestamp: Date.now(),
            transactionId: crypto.randomBytes(16).toString('hex')
        };
        
        // Deduct balance immediately and save to prevent refresh exploit
        req.session.balance -= betAmount;
        sessionStore.set(req.sessionId, req.session);
        saveSessions();
        
        console.log(`🔒 Balance locked for transaction ${req.session.pendingTransaction.transactionId}: ${betAmount} SOL`);
        
        // Initialize XP and level if not exists
        if (!req.session.xp) req.session.xp = 0;
        if (!req.session.level) req.session.level = 1;
        
        // Calculate XP earned (1 XP per 0.001 SOL spent)
        const xpEarned = Math.floor(betAmount * 1000); // Convert SOL to XP (0.001 SOL = 1 XP)
        const oldLevel = req.session.level;
        
        // Update XP and level
        req.session.xp += xpEarned;
        req.session.level = calculateLevel(req.session.xp);
        
        // Check if user leveled up
        const leveledUp = req.session.level > oldLevel;
        const levelUpInfo = leveledUp ? {
            oldLevel: oldLevel,
            newLevel: req.session.level,
            xpEarned: xpEarned,
            totalXP: req.session.xp,
            xpForNextLevel: getXPForNextLevel(req.session.level)
        } : null;
        
        // Get server seed for this pack opening
        const serverSeed = provablyFair.getNextServerSeed(req.sessionId);
        const clientSeed = provablyFair.generateClientSeed();
        

        
        // Calculate payout with provably fair system
        const result = calculateCasePayout(betAmount, caseType, serverSeed, clientSeed);
        

        
        // Calculate house profit (8% of bet amount)
        const houseProfit = betAmount * 0.08;
        
        // Calculate actual payout to player (85% of what they would normally get)
        const actualPayout = result.totalWinAmount * 0.85;
        
        // Add winnings to balance (bet was already deducted)
        req.session.balance += actualPayout;
        
        // CRITICAL SECURITY FIX: Clear pending transaction and save final state
        delete req.session.pendingTransaction;
        sessionStore.set(req.sessionId, req.session);
        saveSessions();
        

        
        // Log house profit for tracking

        
        // Track house profits
        if (!globalStats.houseProfits) globalStats.houseProfits = 0;
        globalStats.houseProfits += houseProfit;
        
        // Track SOL won (actual payout to players)
        if (actualPayout > 0) {
            globalStats.solWon += actualPayout;
        }
        
        // Add cards to collections and check for completion
        const collectionResults = [];
        result.cards.forEach(card => {
            const item = generateItem(card.rarity);
            const collectionResult = addCardToCollection(req.sessionId, item.name, card.rarity);
            
            if (collectionResult.completed) {
                collectionResults.push(collectionResult);
            }
            

        });

        
        // Save collection data
        sessionStore.set(req.sessionId, req.session);
        saveSessions();
        

        
        res.json({
            success: true,
            result: { 
                cards: result.cards,
                totalMultiplier: result.totalMultiplier,
                totalWinAmount: result.totalWinAmount,
                newBalance: req.session.balance,
                xpEarned: xpEarned,
                totalXP: req.session.xp,
                currentLevel: req.session.level,
                leveledUp: leveledUp,
                levelUpInfo: levelUpInfo,
                // Collection results
                collectionResults: collectionResults,
                // Provably fair data
                serverSeed: result.serverSeed,
                clientSeed: result.clientSeed,
                initialHash: result.initialHash
            }
        });
        
    } catch (error) {
        // CRITICAL SECURITY FIX: If there's an error, clear pending transaction and restore balance
        if (req.session.pendingTransaction) {
            const betAmount = req.session.pendingTransaction.betAmount;
            req.session.balance += betAmount; // Restore the deducted balance
            delete req.session.pendingTransaction;
            sessionStore.set(req.sessionId, req.session);
            saveSessions();
            console.log(`❌ Transaction failed, balance restored: +${betAmount} SOL`);
        }
        
        console.error('❌ Case opening error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to open case'
        });
    }
});

// Function to fetch wallet balance from Privy
async function fetchWalletBalance(userId) {
    try {
        // Get user's linked accounts to find the Solana wallet
        const userData = await callPrivyAPI('GET', `/users/${userId}`);
        
        // Find the Solana wallet
        const solanaWallet = userData.linked_accounts?.find(account => 
            account.type === 'wallet' && account.chain_type === 'solana'
        );
        
        if (!solanaWallet) {
            console.log('❌ No Solana wallet found for user:', userId);
            return null;
        }
        
        // Fetch wallet balance using Solana RPC
        const solanaRpcUrl = 'https://api.mainnet-beta.solana.com';
        const balanceResponse = await fetch(solanaRpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'getBalance',
                params: [solanaWallet.address]
            })
        });
        
        const balanceData = await balanceResponse.json();
        
        if (balanceData.result) {
            // Convert lamports to SOL (1 SOL = 1,000,000,000 lamports)
            const balanceInSol = balanceData.result.value / 1000000000;
            console.log(`💰 Fetched wallet balance for ${userId}: ${balanceInSol} SOL`);
            return balanceInSol;
        } else {
            console.log('❌ Failed to fetch wallet balance:', balanceData.error);
            return null;
        }
        
    } catch (error) {
        console.error('❌ Error fetching wallet balance:', error);
        return null;
    }
}

// Get balance endpoint - allow new users without userId
app.get('/api/balance', async (req, res) => {
    // For new users without userId, return 0 balance
    if (!req.session.userId) {
        return res.json({
            success: true,
            balance: 0,
            walletAddress: null,
            source: 'new_user'
        });
    }
    
    try {
        // Use session balance as primary source (site balance)
        const sessionBalance = req.session.balance || 0;
        
        // Only fetch real wallet balance for initial setup or verification
        if (sessionBalance === 0) {
            const realBalance = await fetchWalletBalance(req.session.userId);
            if (realBalance !== null) {
                // Initialize session balance with real wallet balance
                req.session.balance = realBalance;
                sessionStore.set(req.sessionId, req.session);
                saveSessions();
                
                res.json({
                    success: true,
                    balance: realBalance,
                    walletAddress: req.session.walletAddress,
                    source: 'wallet'
                });
                return;
            }
        }
        
        // Return session balance (site balance)
        res.json({
            success: true,
            balance: sessionBalance,
            walletAddress: req.session.walletAddress,
            source: 'session'
        });
        
    } catch (error) {
        console.error('❌ Balance fetch error:', error);
        // Fallback to session balance
        const sessionBalance = req.session.balance || 0;
        res.json({
            success: true,
            balance: sessionBalance,
            walletAddress: req.session.walletAddress,
            source: 'session'
        });
    }
});

// Get level info endpoint - allow new users
app.get('/api/level', (req, res) => {
    // For new users without userId, return default level
    if (!req.session.userId) {
        return res.json({
            success: true,
            level: 1,
            xp: 0,
            xpForNextLevel: 100
        });
    }
    
    const level = req.session.level || 1;
    const xp = req.session.xp || 0;
    const xpForNextLevel = getXPForNextLevel(level);
    
    res.json({
        success: true,
        level: level,
        xp: xp,
        xpForNextLevel: xpForNextLevel
    });
});

// Get collection progress endpoint - allow new users
app.get('/api/collections', (req, res) => {
    // For new users without userId, return empty collections
    if (!req.session.userId) {
        return res.json({
            success: true,
            progress: {},
            completedCollections: [],
            availableRewards: []
        });
    }
    
    
    
    try {
        const userData = initializeUserCollections(req.sessionId);

        
        const progress = getUserCollectionProgress(req.sessionId);

        
        res.json({
            success: true,
            progress: progress,
            completedCollections: Array.from(userData.completedCollections),
            availableRewards: userData.collectionRewards.filter(r => !r.claimed)
        });
    } catch (error) {
        console.error(`❌ Collections API error:`, error);
        res.json({ success: false, error: error.message });
    }
});

// Claim collection reward endpoint
app.post('/api/collections/claim', validateSession, (req, res) => {
    
    const { rarity } = req.body;
    
    if (!rarity || !collectionRewards[rarity]) {
        return res.json({ success: false, message: 'Invalid rarity' });
    }
    
    const result = claimCollectionReward(req.sessionId, rarity);
    
    if (result.success) {
        // Add reward to user's balance or inventory
        if (result.reward.type === 'sol') {
            req.session.balance += result.reward.value;
            console.log(`💰 Collection reward claimed: ${result.reward.value} SOL for ${rarity} collection`);
        } else if (result.reward.type === 'pack') {
            // For pack rewards, you might want to add them to an inventory system
            console.log(`📦 Collection reward claimed: ${result.reward.packType} pack for ${rarity} collection`);
        }
        
        // Save session
        sessionStore.set(req.sessionId, req.session);
        saveSessions();
        
        res.json({
            success: true,
            reward: result.reward,
            newBalance: req.session.balance
        });
    } else {
        res.json({
            success: false,
            error: result.error
        });
    }
});

// Get provably fair server seed hash endpoint
app.get('/api/provably-fair/hash', (req, res) => {
    if (!req.session.userId) {
        return res.json({ success: false, message: 'Not authenticated' });
    }
    
    const serverSeedHash = provablyFair.getCurrentServerSeedHash(req.sessionId);
    
    if (!serverSeedHash) {
        // Generate first server seed if none exists
        provablyFair.getNextServerSeed(req.sessionId);
    }
    
    res.json({
        success: true,
        serverSeedHash: provablyFair.getCurrentServerSeedHash(req.sessionId)
    });
});

// Instant Withdraw endpoint with fallback system
app.post('/api/withdraw', validateSession, async (req, res) => {
    try {
        const { amount, address } = req.body;
        
        // Validate amount
        if (!amount || amount <= 0) {
            return res.json({ success: false, message: 'Invalid amount' });
        }
        
        // Validate address
        if (!address || address.length !== 44) {
            return res.json({ success: false, message: 'Invalid SOL address' });
        }
        
        // Check if user has enough balance
        if (!req.session.balance) req.session.balance = 0;
        if (req.session.balance < amount) {
            return res.json({ success: false, message: 'Insufficient balance' });
        }
        
        console.log(`🚀 Processing withdrawal: ${amount.toFixed(4)} SOL to ${address}`);
        
        // For now, use manual processing until Privy transaction API is properly configured
        console.log('📋 Processing manual withdrawal (Privy instant transactions disabled for now)...');
        
        // Deduct the amount from balance
        req.session.balance -= amount;
        sessionStore.set(req.sessionId, req.session);
        saveSessions();
        
        // Generate transaction ID for tracking
        const transactionId = `manual_${Date.now()}_${Math.random().toString(36).substring(2)}`;
        
        // Store transaction info
        if (!req.session.transactions) req.session.transactions = [];
        req.session.transactions.push({
            id: transactionId,
            amount: amount,
            to: address,
            timestamp: Date.now(),
            status: 'pending',
            type: 'manual'
        });
        
        // Keep only last 10 transactions
        if (req.session.transactions.length > 10) {
            req.session.transactions.shift();
        }
        
        sessionStore.set(req.sessionId, req.session);
        saveSessions();
        
        // Send Discord webhook for manual processing
        const webhookUrl = 'https://discord.com/api/webhooks/1404198106442109070/CJFbs6sxNYLy8a8minI9QvYE3-GBsxCBLzPFCj2qocBijxUg8SATsuqfQov47WTpbE56';
        const webhookData = {
            content: `📋 MANUAL WITHDRAWAL: ${req.session.username || 'User'} requested ${amount.toFixed(4)} SOL\nTO: ${address}\nFROM: ${req.session.walletAddress}\nTX ID: ${transactionId}\n\nPlease process this withdrawal manually.`
        };
        
        fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(webhookData)
        }).catch(error => {
            console.error('❌ Failed to send Discord webhook:', error);
        });
        
        console.log(`💰 Manual withdrawal requested: ${amount.toFixed(4)} SOL to ${address}, new balance: ${req.session.balance.toFixed(4)} SOL`);
        
        return res.json({
            success: true,
            message: 'Withdrawal request submitted successfully! Will be processed within 24 hours.',
            newBalance: req.session.balance,
            withdrawnAmount: amount,
            destinationAddress: address,
            transactionId: transactionId,
            type: 'manual'
        });
        
    } catch (error) {
        console.error('❌ Withdrawal failed:', error);
        
        // Revert balance if transaction failed
        if (req.session.balance !== undefined) {
            req.session.balance += amount;
            sessionStore.set(req.sessionId, req.session);
            saveSessions();
        }
        
        res.json({
            success: false,
            message: 'Withdrawal failed. Please try again or contact support.',
            error: error.message
        });
    }
});

// Deposit endpoint - for manual balance updates
app.post('/api/deposit', validateSession, (req, res) => {
    
    const { amount } = req.body;
    
    // Validate amount
    if (!amount || amount <= 0) {
        return res.json({ success: false, message: 'Invalid amount' });
    }
    
    // Initialize balance if not exists
    if (!req.session.balance) req.session.balance = 0;
    
    // Add the amount to balance
    req.session.balance += amount;
    
    // Ensure session is saved immediately
    sessionStore.set(req.sessionId, req.session);
    saveSessions();
    
    console.log(`💰 Deposit processed: ${amount.toFixed(4)} SOL added to ${req.session.walletAddress}, new balance: ${req.session.balance.toFixed(4)} SOL`);
    console.log(`💾 Session ${req.sessionId} saved with updated balance: ${req.session.balance.toFixed(4)} SOL`);
    
    res.json({
        success: true,
        message: 'Deposit processed successfully',
        newBalance: req.session.balance,
        depositedAmount: amount
    });
});

// Transaction history endpoint
app.get('/api/transactions', validateSession, (req, res) => {
    const transactions = req.session.transactions || [];
    
    res.json({
        success: true,
        transactions: transactions.map(tx => ({
            id: tx.id,
            amount: tx.amount,
            to: tx.to,
            timestamp: tx.timestamp,
            status: tx.status,
            type: 'withdrawal'
        }))
    });
});

// Get stats endpoint
app.get('/api/stats', (req, res) => {
    res.json({
        success: true,
        stats: {
            packsOpened: globalStats.packsOpened,
            solWon: globalStats.solWon.toFixed(2),
            houseProfits: (globalStats.houseProfits || 0).toFixed(6),
            houseWallet: 'HKa2ezVYuJPzrw4Defx2kX9axdpJYfGaMkjgiZjkV4P5',
            activeUsers: globalStats.activeUsers.size,
            lastUpdate: globalStats.lastUpdate
        }
    });
});

// Inventory endpoint - allow new users
app.get('/api/inventory', (req, res) => {
    // For new users without userId, return empty inventory
    if (!req.session.userId) {
        return res.json({
            success: true,
            inventory: {}
        });
    }
    
    const sessionData = sessionStore.get(req.sessionId);
    
    res.json({
        success: true,
        inventory: sessionData.inventory || {}
    });
});

// Save inventory endpoint
app.post('/api/inventory', validateSession, (req, res) => {
    const { inventory } = req.body;
    
    if (!inventory) {
        return res.json({ success: false, message: 'Inventory data required' });
    }
    
    const sessionData = sessionStore.get(req.sessionId);
    
    // Update inventory in session
    sessionData.inventory = inventory;
    sessionStore.set(req.sessionId, sessionData);
    saveSessions();
    
    res.json({
        success: true,
        message: 'Inventory saved successfully'
    });
});

function calculateCasePayout(betAmount, caseType, serverSeed, clientSeed) {
    // Pack-specific multiplier values - specific requirements
    const packMultipliers = {
        starter: {
            common: 0.08,        // 58% chance - 0.08x * 0.001 SOL = 0.00008 SOL
            uncommon: 0.12,      // 39% chance - 0.12x * 0.001 SOL = 0.00012 SOL
            rare: 0.18,          // 2% chance - 0.18x * 0.001 SOL = 0.00018 SOL
            epic: 0.35,          // 0.45% chance - 0.35x * 0.001 SOL = 0.00035 SOL
            legendary: 80.0,     // 0.05% chance - 80.0x * 0.001 SOL = 0.08 SOL (ONLY on Silver)
            mythic: 0.7,         // Not available in starter pack
            divine: 0.5          // Not available in starter pack
        },
        pro: {
            common: 0.08,        // Not available in pro pack
            uncommon: 0.12,      // 70% chance - 0.12x * 0.01 SOL = 0.0012 SOL
            rare: 0.18,          // 25% chance - 0.18x * 0.01 SOL = 0.0018 SOL
            epic: 0.35,          // 4.7% chance - 0.35x * 0.01 SOL = 0.0035 SOL
            legendary: 0.9,      // 0.25% chance - 0.9x * 0.01 SOL = 0.009 SOL
            mythic: 70.0,        // 0.05% chance - 70.0x * 0.01 SOL = 0.7 SOL (ONLY on Gold)
            divine: 0.5          // Not available in pro pack
        },
        elite: {
            common: 0.08,        // Not available in elite pack
            uncommon: 0.12,      // Not available in elite pack
            rare: 0.15,          // 62% chance - 0.15x * 0.1 SOL = 0.015 SOL
            epic: 0.28,          // 33% chance - 0.28x * 0.1 SOL = 0.028 SOL
            legendary: 0.95,     // 4% chance - 0.95x * 0.1 SOL = 0.095 SOL
            mythic: 3.0,         // 0.95% chance - 3.0x * 0.1 SOL = 0.3 SOL
            divine: 50.0         // 0.05% chance - 50.0x * 0.1 SOL = 5.0 SOL (Diamond)
        },
        whale: {
            common: 0.08,        // Not available in whale pack
            uncommon: 0.12,      // Not available in whale pack
            rare: 0.18,          // Not available in whale pack
            epic: 0.15,          // 60% chance - 0.15x * 1.0 SOL = 0.15 SOL
            legendary: 0.35,     // 32% chance - 0.35x * 1.0 SOL = 0.35 SOL
            mythic: 0.25,        // 6% chance - 0.25x * 1.0 SOL = 0.25 SOL
            divine: 5.0          // 2% chance - 5.0x * 1.0 SOL = 5.0 SOL (Obsidian)
        }
    };

    // Get multipliers for this specific pack
    const rarityValues = packMultipliers[caseType] || packMultipliers.starter;

    // Variable drop ranges (min to max multiplier of base value) - tighter control for 0.75x target
    const dropRanges = {
        common: [0.9, 1.1],      // 90% to 110% of base - creates 0.072x to 0.088x range
        uncommon: [0.9, 1.1],    // 90% to 110% of base - creates 0.108x to 0.132x range
        rare: [0.9, 1.1],        // 90% to 110% of base - creates 0.162x to 0.198x range
        epic: [0.9, 1.1],        // 90% to 110% of base - creates 0.315x to 0.385x range
        legendary: [0.9, 1.1],   // 90% to 110% of base - creates 1.08x to 1.32x range
        mythic: [0.9, 1.1],      // 90% to 110% of base - creates 2.25x to 2.75x range
        divine: [0.9, 1.1]       // 90% to 110% of base - creates 5.4x to 6.6x range
    };

    // Pack configurations with range-based RNG system (1-10000)
    const payoutTables = {
        starter: [
            { rarity: 'common', probability: 45, range: [1, 4500] },
            { rarity: 'uncommon', probability: 20, range: [4501, 6500] },
            { rarity: 'rare', probability: 25, range: [6501, 9000] },
            { rarity: 'epic', probability: 8, range: [9001, 9800] },
            { rarity: 'legendary', probability: 2, range: [9801, 10000] }
        ],
        pro: [
            { rarity: 'uncommon', probability: 60, range: [1, 6000] },
            { rarity: 'rare', probability: 30, range: [6001, 9000] },
            { rarity: 'epic', probability: 8, range: [9001, 9800] },
            { rarity: 'legendary', probability: 1.8, range: [9801, 9980] },
            { rarity: 'mythic', probability: 0.2, range: [9981, 10000] }
        ],
        elite: [
            { rarity: 'rare', probability: 55, range: [1, 5500] },
            { rarity: 'epic', probability: 35, range: [5501, 9000] },
            { rarity: 'legendary', probability: 8, range: [9001, 9800] },
            { rarity: 'mythic', probability: 1.8, range: [9801, 9980] },
            { rarity: 'divine', probability: 0.2, range: [9981, 10000] }
        ],
        whale: [
            { rarity: 'epic', probability: 50, range: [1, 5000] },
            { rarity: 'legendary', probability: 35, range: [5001, 8500] },
            { rarity: 'mythic', probability: 12, range: [8501, 9700] },
            { rarity: 'divine', probability: 3, range: [9701, 10000] }
        ]
    };
    
    const table = payoutTables[caseType] || payoutTables.starter;
    
    // Generate 5 cards per pack
    const cards = [];
    let totalWinAmount = 0;
    
    // Create initial hash from server and client seeds
    let currentHash = provablyFair.createHash(serverSeed, clientSeed);
    
    for (let i = 0; i < 5; i++) {
        // Generate random number from hash for this card
        const randomValue = provablyFair.hashToRandom(currentHash);
        const roll = Math.floor(randomValue * 10000) + 1;
        console.log(`Card ${i + 1} - Hash: ${currentHash.substring(0, 16)}..., Random value: ${randomValue}, Generated roll: ${roll}`);
        
        // Find which rarity tier this roll falls into
        let selectedRarity = 'common'; // Default fallback
        for (const tier of table) {
            if (roll >= tier.range[0] && roll <= tier.range[1]) {
                selectedRarity = tier.rarity;
                console.log(`Card ${i + 1} - Roll ${roll} falls into ${selectedRarity} range: ${tier.range[0]}-${tier.range[1]}`);
                break;
            }
        }
        
        // Get base value for this rarity
        const baseValue = rarityValues[selectedRarity];
        
        // Generate variable drop value using next hash
        currentHash = provablyFair.createHash(currentHash, i.toString());
        const dropRandom = provablyFair.hashToRandom(currentHash);
        const [minMultiplier, maxMultiplier] = dropRanges[selectedRarity];
        const dropMultiplier = minMultiplier + dropRandom * (maxMultiplier - minMultiplier);
        
        // Calculate final win amount for this card
        // baseValue is now the desired multiplier, so winAmount = baseValue * betAmount * dropMultiplier
        const multiplier = baseValue * dropMultiplier;
        const winAmount = multiplier * betAmount;
        
        // Generate the actual item for this card
        const item = generateItem(selectedRarity);
        
        const card = {
            multiplier: parseFloat(multiplier.toFixed(2)),
            winAmount: winAmount,
            rarity: selectedRarity,
            roll: Number(roll),
            baseValue: baseValue,
            dropMultiplier: parseFloat(dropMultiplier.toFixed(2)),
            itemName: item.name,
            itemIcon: item.icon,
            itemColor: item.color
        };
        console.log(`Card ${i + 1} - Final card object:`, card);
        
        cards.push(card);
        totalWinAmount += winAmount;
        
        // Generate next hash for next card
        currentHash = provablyFair.createHash(currentHash, 'next');
    }
    
    // Calculate total multiplier (sum of all individual card multipliers)
    const totalMultiplier = cards.reduce((sum, card) => sum + card.multiplier, 0);
    
    const result = {
        cards: cards,
        totalMultiplier: parseFloat(totalMultiplier.toFixed(2)),
        totalWinAmount: totalWinAmount,
        profit: totalWinAmount - betAmount,
        rarity: cards.map(card => card.rarity),
        roll: cards.map(card => card.roll),
        baseValue: cards.map(card => card.baseValue),
        dropMultiplier: cards.map(card => card.dropMultiplier),
        // Provably fair data
        serverSeed: serverSeed,
        clientSeed: clientSeed,
        initialHash: provablyFair.createHash(serverSeed, clientSeed)
    };
    
    return result;
}

function generateItem(rarity) {
    const items = {
        common: [
            { name: 'red-cube', icon: '🔴', color: 'red', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/red-cube.png?updatedAt=1754994590917' },
            { name: 'blue-cube', icon: '🔵', color: 'blue', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/blue-cube.png?updatedAt=1754994572417' },
            { name: 'green-cube', icon: '🟢', color: 'green', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/green-cube.png?updatedAt=1754994579208' },
            { name: 'yellow-cube', icon: '🟡', color: 'yellow', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/yellow-cube.png?updatedAt=1754994597168' },
            { name: 'pink-cube', icon: '🩷', color: 'pink', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/pink-cube.png?updatedAt=1754994585656' },
            { name: 'red-dice', icon: '🎲', color: 'red', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/red-dice.png?updatedAt=1754994590917' },
            { name: 'blue-dice', icon: '🎲', color: 'blue', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/blue-dice.png?updatedAt=1754994572417' },
            { name: 'green-dice', icon: '🎲', color: 'green', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/green-dice.png?updatedAt=1754994579208' },
            { name: 'yellow-dice', icon: '🎲', color: 'yellow', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/yellow-dice.png?updatedAt=1754994597168' },
            { name: 'pink-dice', icon: '🎲', color: 'pink', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/pink-dice.png?updatedAt=1754994585656' },
            { name: 'red-banana', icon: '🍌', color: 'red', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/red-banana.png?updatedAt=1754994589845' },
            { name: 'blue-banana', icon: '🍌', color: 'blue', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/blue-banana.png?updatedAt=1754994572439' },
            { name: 'green-banana', icon: '🍌', color: 'green', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/green-banana.png?updatedAt=1754994577987' },
            { name: 'yellow-banana', icon: '🍌', color: 'yellow', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/yellow-banana.png?updatedAt=1754994595991' },
            { name: 'pink-banana', icon: '🍌', color: 'pink', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/pink-banana.png?updatedAt=1754994584395' },
            { name: 'red-fish', icon: '🐟', color: 'red', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/red-fish.png?updatedAt=1754994591933' },
            { name: 'blue-fish', icon: '🐟', color: 'blue', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/blue-fish.png?updatedAt=1754994575171' },
            { name: 'green-fish', icon: '🐟', color: 'green', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/green-fish.png?updatedAt=1754994580517' },
            { name: 'yellow-fish', icon: '🐟', color: 'yellow', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/yellow-fish.png?updatedAt=1754994598168' },
            { name: 'pink-fish', icon: '🐟', color: 'pink', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/pink-fish.png?updatedAt=1754994586682' },
            { name: 'red-rock', icon: '🪨', color: 'red', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/red-rock.png?updatedAt=1754994593399' },
            { name: 'blue-rock', icon: '🪨', color: 'blue', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/blue-rock.png?updatedAt=1754994575512' },
            { name: 'green-rock', icon: '🪨', color: 'green', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/green-rock.png?updatedAt=1754994582359' },
            { name: 'yellow-rock', icon: '🪨', color: 'yellow', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/yellow-rock.png?updatedAt=1754994599285' },
            { name: 'pink-rock', icon: '🪨', color: 'pink', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/pink-rock.png?updatedAt=1754994587813' },
            { name: 'red-cup', icon: '🥤', color: 'red', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/red-cup.png?updatedAt=1754994591186' },
            { name: 'blue-cup', icon: '🥤', color: 'blue', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/blue-cup.png?updatedAt=1754994572376' },
            { name: 'green-cup', icon: '🥤', color: 'green', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/green-cup.png?updatedAt=1754994579175' },
            { name: 'yellow-cup', icon: '🥤', color: 'yellow', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/yellow-cup.png?updatedAt=1754994597170' },
            { name: 'pink-cup', icon: '🥤', color: 'pink', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/pink-cup.png?updatedAt=1754994585623' },
            { name: 'red-leaf', icon: '🍃', color: 'red', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/red-leaf.png?updatedAt=1754994590917' },
            { name: 'blue-leaf', icon: '🍃', color: 'blue', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/blue-leaf.png?updatedAt=1754994572417' },
            { name: 'green-leaf', icon: '🍃', color: 'green', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/green-leaf.png?updatedAt=1754994579208' },
            { name: 'yellow-leaf', icon: '🍃', color: 'yellow', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/yellow-leaf.png?updatedAt=1754994597168' },
            { name: 'pink-leaf', icon: '🍃', color: 'pink', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/pink-leaf.png?updatedAt=1754994585656' },
            { name: 'red-cloud', icon: '☁️', color: 'red', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/red-cloud.png?updatedAt=1754994589939' },
            { name: 'blue-cloud', icon: '☁️', color: 'blue', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/blue-cloud.png?updatedAt=1754994572422' },
            { name: 'green-cloud', icon: '☁️', color: 'green', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/green-cloud.png?updatedAt=1754994579189' },
            { name: 'yellow-cloud', icon: '☁️', color: 'yellow', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/yellow-cloud.png?updatedAt=1754994596065' },
            { name: 'pink-cloud', icon: '☁️', color: 'pink', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/pink-cloud.png?updatedAt=1754994584526' },
            { name: 'red-mushroom', icon: '🍄', color: 'red', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/red-mushroom.png?updatedAt=1754994593382' },
            { name: 'blue-mushroom', icon: '🍄', color: 'blue', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/blue-mushroom.png?updatedAt=1754994575224' },
            { name: 'green-mushroom', icon: '🍄', color: 'green', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/green-mushroom.png?updatedAt=1754994581971' },
            { name: 'yellow-mushroom', icon: '🍄', color: 'yellow', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/yellow-mushroom.png?updatedAt=1754994599243' },
            { name: 'pink-mushroom', icon: '🍄', color: 'pink', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/pink-mushroom.png?updatedAt=1754994587798' },
            { name: 'red-toiletpaper', icon: '🧻', color: 'red', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/red-toilerpaper.png?updatedAt=1754994594676' },
            { name: 'blue-toiletpaper', icon: '🧻', color: 'blue', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/blue-toilerpaper.png?updatedAt=1754994577116' },
            { name: 'green-toiletpaper', icon: '🧻', color: 'green', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/green-toiletpaper.png?updatedAt=1754994583197' },
            { name: 'yellow-toiletpaper', icon: '🧻', color: 'yellow', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/yellow-toilerpaper.png?updatedAt=1754994600467' },
            { name: 'pink-toiletpaper', icon: '🧻', color: 'pink', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/pink-toiletpaper.png?updatedAt=1754994588976' }
        ],
        uncommon: [
            { name: 'red-bolt', icon: '⚡', color: 'red', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/red-bolt.png?updatedAt=1754994589865' },
            { name: 'blue-bolt', icon: '⚡', color: 'blue', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/blue-bolt.png?updatedAt=1754994572409' },
            { name: 'green-bolt', icon: '⚡', color: 'green', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/green-bolt.png?updatedAt=1754994578289' },
            { name: 'yellow-bolt', icon: '⚡', color: 'yellow', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/yellow-bolt.png?updatedAt=1754994595972' },
            { name: 'pink-bolt', icon: '⚡', color: 'pink', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/pink-bolt.png?updatedAt=1754994584446' },
            { name: 'red-chip', icon: '🎰', color: 'red', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/red-chip.png?updatedAt=1754994589960' },
            { name: 'blue-chip', icon: '🎰', color: 'blue', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/blue-chip.png?updatedAt=1754994572419' },
            { name: 'green-chip', icon: '🎰', color: 'green', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/green-chip.png?updatedAt=1754994578118' },
            { name: 'yellow-chip', icon: '🎰', color: 'yellow', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/yellow-chip.png?updatedAt=1754994596045' },
            { name: 'pink-chip', icon: '🎰', color: 'pink', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/pink-chip.png?updatedAt=1754994584493' },
            { name: 'red-lightbulb', icon: '💡', color: 'red', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/red-lightbulb.png?updatedAt=1754994591998' },
            { name: 'blue-lightbulb', icon: '💡', color: 'blue', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/blue-lightbulb.png?updatedAt=1754994575241' },
            { name: 'green-lightbulb', icon: '💡', color: 'green', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/green-lightbulb.png?updatedAt=1754994580703' },
            { name: 'yellow-lightbulb', icon: '💡', color: 'yellow', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/yellow-lightbulb.png?updatedAt=1754994598225' },
            { name: 'pink-lightbulb', icon: '💡', color: 'pink', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/pink-lightbulb.png?updatedAt=1754994586751' },
            { name: 'red-key', icon: '🔑', color: 'red', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/red-key.png?updatedAt=1754994591965' },
            { name: 'blue-key', icon: '🔑', color: 'blue', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/blue-key.png?updatedAt=1754994575209' },
            { name: 'green-key', icon: '🔑', color: 'green', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/green-key.png?updatedAt=1754994580665' },
            { name: 'yellow-key', icon: '🔑', color: 'yellow', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/yellow-key.png?updatedAt=1754994598259' },
            { name: 'pink-key', icon: '🔑', color: 'pink', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/pink-key.png?updatedAt=1754994586744' },
            { name: 'red-star', icon: '⭐', color: 'red', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/red-star.png?updatedAt=1754994590917' },
            { name: 'blue-star', icon: '⭐', color: 'blue', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/blue-star.png?updatedAt=1754994577181' },
            { name: 'green-star', icon: '⭐', color: 'green', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/green-star.png?updatedAt=1754994583142' },
            { name: 'yellow-star', icon: '⭐', color: 'yellow', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/yellow-star.png?updatedAt=1754994600647' },
            { name: 'pink-star', icon: '⭐', color: 'pink', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/pink-star.png?updatedAt=1754994588930' },
            { name: 'red-magnet', icon: '🧲', color: 'red', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/red-magnet.png?updatedAt=1754994593357' },
            { name: 'blue-magnet', icon: '🧲', color: 'blue', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/blue0magnet.png?updatedAt=1754994577443' },
            { name: 'green-magnet', icon: '🧲', color: 'green', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/green-magnet.png?updatedAt=1754994581911' },
            { name: 'yellow-magnet', icon: '🧲', color: 'yellow', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/yellow-magnet.png?updatedAt=1754994599235' },
            { name: 'pink-magnet', icon: '🧲', color: 'pink', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/pink-magnet.png?updatedAt=1754994587712' }
        ],
        rare: [
            { name: 'red-sword', icon: '⚔️', color: 'red', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/red-sword.png?updatedAt=1754994594720' },
            { name: 'blue-sword', icon: '⚔️', color: 'blue', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/blue-sword.png?updatedAt=1754994577176' },
            { name: 'green-sword', icon: '⚔️', color: 'green', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/green-sword.png?updatedAt=1754994583194' },
            { name: 'yellow-sword', icon: '⚔️', color: 'yellow', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/yellow-sword.png?updatedAt=1754994600358' },
            { name: 'pink-sword', icon: '⚔️', color: 'pink', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/pink-sword.png?updatedAt=1754994589109' },
            { name: 'red-controller', icon: '🎮', color: 'red', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/red-controller.png?updatedAt=1754994590894' },
            { name: 'blue-controller', icon: '🎮', color: 'blue', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/blue-%20controller.png?updatedAt=1754994572480' },
            { name: 'green-controller', icon: '🎮', color: 'green', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/green-controller.png?updatedAt=1754994579167' },
            { name: 'yellow-controller', icon: '🎮', color: 'yellow', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/yellow-controller.png?updatedAt=1754994597131' },
            { name: 'pink-controller', icon: '🎮', color: 'pink', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/pink-controller.png?updatedAt=1754994585610' },
            { name: 'red-cookie', icon: '🍪', color: 'red', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/red-cookie.png?updatedAt=1754994590978' },
            { name: 'blue-cookie', icon: '🍪', color: 'blue', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/blue-cookie.png?updatedAt=1754994572441' },
            { name: 'green-cookie', icon: '🍪', color: 'green', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/green%20cookie.png?updatedAt=1754994577975' },
            { name: 'yellow-cookie', icon: '🍪', color: 'yellow', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/yellow-cookie.png?updatedAt=1754994597151' },
            { name: 'pink-cookie', icon: '🍪', color: 'pink', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/pink-cookie.png?updatedAt=1754994585606' },
            { name: 'red-pill', icon: '💊', color: 'red', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/red-pill.png?updatedAt=1754994593379' },
            { name: 'blue-pill', icon: '💊', color: 'blue', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/blue-pill.png?updatedAt=1754994575241' },
            { name: 'green-pill', icon: '💊', color: 'green', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/green-pill.png?updatedAt=1754994581970' },
            { name: 'yellow-pill', icon: '💊', color: 'yellow', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/yellow-pill.png?updatedAt=1754994599264' },
            { name: 'pink-pill', icon: '💊', color: 'pink', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/pink-pill.png?updatedAt=1754994587860' }
        ],
        epic: [
            { name: 'red-burger', icon: '🍔', color: 'red', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/red-burger.png?updatedAt=1754994589875' },
            { name: 'blue-burger', icon: '🍔', color: 'blue', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/blue-burger.png?updatedAt=1754994572423' },
            { name: 'green-burger', icon: '🍔', color: 'green', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/green-burger.png?updatedAt=1754994578253' },
            { name: 'yellow-burger', icon: '🍔', color: 'yellow', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/yellow-burger.png?updatedAt=1754994596020' },
            { name: 'pink-burger', icon: '🍔', color: 'pink', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/pink-burger.png?updatedAt=1754994584402' },
            { name: 'red-flame', icon: '🔥', color: 'red', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/red-flame.png?updatedAt=1754994592241' },
            { name: 'blue-flame', icon: '🔥', color: 'blue', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/blue-flame.png?updatedAt=1754994575229' },
            { name: 'green-flame', icon: '🔥', color: 'green', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/green-flame.png?updatedAt=1754994580674' },
            { name: 'yellow-flame', icon: '🔥', color: 'yellow', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/yellow-flame.png?updatedAt=1754994598235' },
            { name: 'pink-flame', icon: '🔥', color: 'pink', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/pink-flame.png?updatedAt=1754994586764' },
            { name: 'red-rifle', icon: '🔫', color: 'red', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/red-riffle.png?updatedAt=1754994593639' },
            { name: 'blue-rifle', icon: '🔫', color: 'blue', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/blue-riffle.png?updatedAt=1754994575459' },
            { name: 'green-rifle', icon: '🔫', color: 'green', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/green-riffle.png?updatedAt=1754994581978' },
            { name: 'yellow-rifle', icon: '🔫', color: 'yellow', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/yellow-riffle.png?updatedAt=1754994599329' },
            { name: 'pink-rifle', icon: '🔫', color: 'pink', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/pink-riffle.png?updatedAt=1754994587842' }
        ],
        legendary: [
            { name: 'red-dragon', icon: '🐉', color: 'red', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/red-dragon.png?updatedAt=1754994590931' },
            { name: 'blue-dragon', icon: '🐉', color: 'blue', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/blue-dragon.png?updatedAt=1754994572438' },
            { name: 'green-dragon', icon: '🐉', color: 'green', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/green-dragon.png?updatedAt=1754994579235' },
            { name: 'yellow-dragon', icon: '🐉', color: 'yellow', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/yellow-dragon.png?updatedAt=1754994597148' },
            { name: 'pink-dragon', icon: '🐉', color: 'pink', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/pink-dragon.png?updatedAt=1754994585669' },
            { name: 'red-rocket', icon: '🚀', color: 'red', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/red-rocket.png?updatedAt=1754994594662' },
            { name: 'blue-rocket', icon: '🚀', color: 'blue', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/blue-rocket.png?updatedAt=1754994575521' },
            { name: 'green-rocket', icon: '🚀', color: 'green', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/green-rocket.png?updatedAt=1754994583160' },
            { name: 'yellow-rocket', icon: '🚀', color: 'yellow', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/yellow-rocket.png?updatedAt=1754994600333' },
            { name: 'pink-rocket', icon: '🚀', color: 'pink', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/pink-rocket.png?updatedAt=1754994589070' }
        ],
        mythic: [
            { name: 'red-trophy', icon: '🏆', color: 'red', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/red-trophy.png?updatedAt=1754994594689' },
            { name: 'blue-trophy', icon: '🏆', color: 'blue', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/blue-trophy.png?updatedAt=1754994577125' },
            { name: 'green-trophy', icon: '🏆', color: 'green', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/green-trophy.png?updatedAt=1754994583571' },
            { name: 'yellow-trophy', icon: '🏆', color: 'yellow', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/yellow-trophy.png?updatedAt=1754994600737' },
            { name: 'pink-trophy', icon: '🏆', color: 'pink', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/pink-trophy.png?updatedAt=1754994589286' },
            { name: 'red-gem', icon: '💎', color: 'red', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/red-gem.png?updatedAt=1754994592033' },
            { name: 'blue-gem', icon: '💎', color: 'blue', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/blue-gem.png?updatedAt=1754994575200' },
            { name: 'green-gem', icon: '💎', color: 'green', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/green-gem.png?updatedAt=1754994580666' },
            { name: 'yellow-gem', icon: '💎', color: 'yellow', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/yellow-gem.png?updatedAt=1754994598191' },
            { name: 'pink-gem', icon: '💎', color: 'pink', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/pink-gem.png?updatedAt=1754994586790' }
        ],
        divine: [
            { name: 'solana-throne', icon: '👑', color: 'gold', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/solana-throne.png?updatedAt=1754994590917' },
            { name: 'solana-crown', icon: '👑', color: 'gold', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/solana-crown.png?updatedAt=1754994572417' },
            { name: 'solana-blade', icon: '⚔️', color: 'gold', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/solana-blade.png?updatedAt=1754994579208' },
            { name: 'solana-orb', icon: '🔮', color: 'gold', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/solana-orb.png?updatedAt=1754994597168' },
            { name: 'solana-relic', icon: '🏛️', color: 'gold', image: 'https://ik.imagekit.io/8rb7srzl8/Downloads/solana-relic.png?updatedAt=1754994585656' }
        ]
    };
    
    const rarityItems = items[rarity] || items.common;
    return rarityItems[Math.floor(Math.random() * rarityItems.length)];
}

// Chat system
const connectedUsers = new Map();
const chatMessages = [];
const MAX_MESSAGES = 100;

// Chat filter for offensive words
function filterChatMessage(content) {
    const offensiveWords = [
        'nigga', 'nigger', 'cp', 'child porn', 'kid'
    ];
    
    let filteredContent = content.toLowerCase();
    
    for (const word of offensiveWords) {
        // Create regex pattern to match the word with word boundaries
        const regex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
        filteredContent = filteredContent.replace(regex, '***');
    }
    
    // If any words were filtered, return the filtered content
    if (filteredContent !== content.toLowerCase()) {
        return filteredContent;
    }
    
    return content; // Return original if no filtering needed
}

// WebSocket connection handling
wss.on('connection', (ws, req) => {
    const userId = Math.random().toString(36).substring(2);
    
    // Try to get sessionId from query parameters
    const url = new URL(req.url, `http://${req.headers.host}`);
    const sessionId = url.searchParams.get('sessionId');

    // SECURITY: Validate session ID exists and is valid
    if (!sessionId) {
        ws.close(1008, 'No session ID provided');
        return;
    }
    
    const sessionData = sessionStore.get(sessionId);
    if (!sessionData) {
        ws.close(1008, 'Invalid session ID');
        return;
    }
    
    let username = `Player${Math.floor(Math.random() * 9999) + 1}`;
    
    // Check if user has a saved username in sessions
    if (sessionData.username) {
        username = sessionData.username;
        
        // Send username_loaded message to client
        ws.send(JSON.stringify({
            type: 'username_loaded',
            username: username
        }));
    }
    
    // Get user's level from session data
    let userLevel = 1;
    if (sessionId) {
        const sessionData = sessionStore.get(sessionId);
        if (sessionData && sessionData.level) {
            userLevel = sessionData.level;
        }
    }
    
    // Add user to connected users
    connectedUsers.set(userId, {
        ws,
        username,
        sessionId,
        level: userLevel,
        joinTime: new Date(),
        lastActivity: new Date()
    });
    

    
    // Send current online count to all users
    broadcastOnlineCount();
    
    // Send recent messages to new user
    const recentMessages = chatMessages.slice(-20);
    ws.send(JSON.stringify({
        type: 'chat_history',
        messages: recentMessages
    }));
    
    // Send welcome message (removed join notification)
    
    // Handle incoming messages
    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data);
            
            if (message.type === 'chat_message') {
                const user = connectedUsers.get(userId);
                if (user) {
                    // Check message length limit (100 characters)
                    if (!message.content || message.content.length > 100) {
                        ws.send(JSON.stringify({
                            type: 'system',
                            content: '⚠️ Message too long! Maximum 100 characters allowed.'
                        }));
                        return;
                    }

                    // Check cooldown (1 second between messages)
                    const now = Date.now();
                    if (user.lastMessageTime && (now - user.lastMessageTime) < 1000) {
                        ws.send(JSON.stringify({
                            type: 'system',
                            content: '⚠️ Please wait 1 second between messages.'
                        }));
                        return;
                    }

                    user.lastActivity = new Date();
                    user.lastMessageTime = now;
                    
                    // Filter the message content
                    const filteredContent = filterChatMessage(message.content);
                    
                    // Add message to history
                    const chatMessage = {
                        type: 'user',
                        username: user.username,
                        content: filteredContent,
                        level: user.level || 1,
                        timestamp: new Date().toISOString()
                    };
                    
                    chatMessages.push(chatMessage);
                    if (chatMessages.length > MAX_MESSAGES) {
                        chatMessages.shift();
                    }
                    
                    // Broadcast to all users
                    broadcastMessage(chatMessage);
                }
            } else if (message.type === 'username_update') {
                const user = connectedUsers.get(userId);
                if (user && message.username) {
                    const oldUsername = user.username;
                    user.username = message.username;
                    user.lastActivity = new Date();
                    
                    // Save username to session if we have a sessionId
                    if (user.sessionId) {
                        // Update the main session store
                        const sessionData = sessionStore.get(user.sessionId);
                        if (sessionData) {
                            sessionData.username = message.username;
                            sessionStore.set(user.sessionId, sessionData);
                            saveSessions();

                        } else {
                            console.log(`DEBUG: Session ID ${user.sessionId} not found in session store.`);
                        }
                    }
                    
                    console.log(`💬 Chat: ${oldUsername} changed name to ${message.username}`);
                    
                    // Broadcast username change
                    broadcastMessage({
                        type: 'system',
                        content: `${oldUsername} is now known as ${message.username}`,
                        timestamp: new Date().toISOString()
                    });
                }
            }
        } catch (error) {
            console.error('❌ Chat message error:', error);
        }
    });
    
    // Handle user disconnect
    ws.on('close', () => {
        const user = connectedUsers.get(userId);
        if (user) {
            connectedUsers.delete(userId);
            console.log(`💬 Chat: ${user.username} disconnected (${connectedUsers.size} online)`);
            
            // Removed leave notification
            
            broadcastOnlineCount();
        }
    });
    
    // Handle errors
    ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error);
        connectedUsers.delete(userId);
        broadcastOnlineCount();
    });
});

function broadcastMessage(message) {
    const messageStr = JSON.stringify(message);
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(messageStr);
        }
    });
}

function broadcastOnlineCount() {
    const count = connectedUsers.size;
    const message = JSON.stringify({
        type: 'online_count',
        count: count
    });
    
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'Privy Wallet Creation Service',
        timestamp: new Date().toISOString(),
        privyAppId: PRIVY_APP_ID,
        hasRealSecret: PRIVY_APP_SECRET !== 'your-privy-app-secret-here'
    });
});

// Test images endpoint
app.get('/api/test-images', (req, res) => {
    const images = ['starter-pack.png', 'pro-pack.png', 'elite-pack.png', 'obsidian-pack.png'];
    const results = {};
    
    images.forEach(img => {
        const filePath = path.join(__dirname, 'images', img);
        results[img] = {
            exists: fs.existsSync(filePath),
            path: filePath,
            size: fs.existsSync(filePath) ? fs.statSync(filePath).size : 0
        };
    });
    
    res.json({
        success: true,
        images: results,
        imagesDir: path.join(__dirname, 'images')
    });
});

// Test endpoint for Downloads folder
app.get('/test-downloads', (req, res) => {
    const fs = require('fs');
    const path = require('path');
    const downloadsPath = path.join(__dirname, 'Downloads');
    
    try {
        const files = fs.readdirSync(downloadsPath);
        res.json({
            success: true,
            files: files.slice(0, 10), // Show first 10 files
            totalFiles: files.length,
            path: downloadsPath
        });
    } catch (error) {
        res.json({
            success: false,
            error: error.message,
            path: downloadsPath
        });
    }
});

// Serve favicon
app.get('/favicon.ico', (req, res) => {
    res.status(204).end(); // No content response
});

// Serve demo page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
server.listen(PORT, () => {
    console.log('🚀 Privy Wallet Service Running!');
    console.log(`📡 Server: https://solcases.fun`);
    console.log(`🎯 Health: https://solcases.fun/api/health`);
    console.log('💬 WebSocket Chat: wss://solcases.fun');
    console.log('💎 Ready to create Solana wallets with Privy!');
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down Privy wallet service...');
    process.exit(0);
});

// CRITICAL SECURITY FIX: Cleanup stale pending transactions (older than 5 minutes)
function cleanupStaleTransactions() {
    const now = Date.now();
    const staleThreshold = 5 * 60 * 1000; // 5 minutes
    
    for (const [sessionId, session] of sessionStore.entries()) {
        if (session.pendingTransaction && (now - session.pendingTransaction.timestamp) > staleThreshold) {
            console.log(`🧹 Cleaning up stale transaction for session ${sessionId}: ${session.pendingTransaction.transactionId}`);
            
            // Restore the balance that was locked
            session.balance += session.pendingTransaction.betAmount;
            delete session.pendingTransaction;
            
            sessionStore.set(sessionId, session);
        }
    }
    saveSessions();
}

// Run cleanup every minute
setInterval(cleanupStaleTransactions, 60 * 1000);

// CRITICAL SECURITY FIX: Endpoint to check transaction status
app.get('/api/transaction-status', (req, res) => {
    try {
        // If not authenticated, return no pending transaction (safe default)
        if (!req.session.userId || !req.session.walletAddress) {
            return res.json({
                success: true,
                hasPendingTransaction: false,
                transactionInfo: null
            });
        }

        const hasPendingTransaction = !!req.session.pendingTransaction;
        const transactionInfo = hasPendingTransaction ? {
            caseType: req.session.pendingTransaction.caseType,
            betAmount: req.session.pendingTransaction.betAmount,
            timestamp: req.session.pendingTransaction.timestamp,
            transactionId: req.session.pendingTransaction.transactionId,
            age: Date.now() - req.session.pendingTransaction.timestamp
        } : null;

        res.json({
            success: true,
            hasPendingTransaction: hasPendingTransaction,
            transactionInfo: transactionInfo
        });
    } catch (error) {
        console.error('❌ Transaction status check error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to check transaction status'
        });
    }
});

// CRITICAL SECURITY FIX: Endpoint to force complete a pending transaction (for recovery)
app.post('/api/force-complete-transaction', (req, res) => {
    try {
        if (!req.session.userId || !req.session.walletAddress) {
            return res.json({
                success: false,
                message: 'Not authenticated'
            });
        }

        if (!req.session.pendingTransaction) {
            return res.json({
                success: false,
                message: 'No pending transaction found'
            });
        }

        // Check if transaction is stale (older than 2 minutes)
        const now = Date.now();
        const staleThreshold = 2 * 60 * 1000; // 2 minutes
        
        if ((now - req.session.pendingTransaction.timestamp) < staleThreshold) {
            return res.json({
                success: false,
                message: 'Transaction is not stale enough to force complete'
            });
        }

        console.log(`🔧 Force completing stale transaction for user ${req.session.userId}: ${req.session.pendingTransaction.transactionId}`);
        
        // Restore the balance and clear the pending transaction
        req.session.balance += req.session.pendingTransaction.betAmount;
        delete req.session.pendingTransaction;
        
        sessionStore.set(req.sessionId, req.session);
        saveSessions();
        
        res.json({
            success: true,
            message: 'Transaction force completed',
            newBalance: req.session.balance
        });
    } catch (error) {
        console.error('❌ Force complete transaction error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to force complete transaction'
        });
    }
});
