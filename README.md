# SolCases.fun - Premium Solana Pack Opening Platform

A modern, feature-rich Solana-based case opening platform with embedded wallet integration using Privy.

## 🚀 Features

### Core Features
- **Embedded Wallet Integration**: Seamless Solana wallet creation and management using Privy
- **Multiple Pack Types**: Silver, Gold, Diamond, and Obsidian packs with varying odds and rewards
- **Real-time Chat System**: Live chat with other players
- **Inventory Management**: Track and display your collected cards
- **Collections System**: Complete collections for bonus rewards
- **Provably Fair**: Transparent and verifiable randomness
- **Level System**: XP-based progression with rewards

### Enhanced UI/UX
- **Modern Design**: Sleek, dark theme with gold accents
- **Smooth Animations**: CSS animations and transitions throughout
- **Responsive Design**: Optimized for desktop, tablet, and mobile
- **Loading States**: Visual feedback for all operations
- **Accessibility**: WCAG compliant with focus states and reduced motion support
- **Keyboard Shortcuts**: Quick navigation with Ctrl/Cmd + number keys

### Technical Features
- **Real-time Updates**: WebSocket connections for live data
- **Session Management**: Persistent user sessions
- **Error Handling**: Comprehensive error handling and user feedback
- **Performance Optimized**: Efficient loading and rendering
- **Security**: Secure transaction handling and validation

## 🎮 Pack Types

| Pack | Price | Description | Guaranteed Rarity |
|------|-------|-------------|-------------------|
| Silver | 0.001 SOL | Perfect for beginners | Common+ |
| Gold | 0.01 SOL | For experienced players | Uncommon+ |
| Diamond | 0.1 SOL | High roller exclusive | Rare+ |
| Obsidian | 1.0 SOL | Ultimate degen pack | Epic+ |

## 🎯 Rarity System

- **Common** (Blue): 60% chance
- **Uncommon** (Green): 25% chance  
- **Rare** (Blue): 10% chance
- **Epic** (Purple): 3% chance
- **Legendary** (Orange): 1.5% chance
- **Mythic** (Pink): 0.4% chance
- **Divine** (Gold): 0.1% chance

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd solcases
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp env.template .env
   # Edit .env with your configuration
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **For production**
   ```bash
   npm start
   ```

## 📁 Project Structure

```
solcases/
├── index.html              # Main application page
├── collections.html        # Collections management
├── provably-fair.html      # Provably fair verification
├── privy-wallet.js         # Backend server with Privy integration
├── package.json            # Dependencies and scripts
├── sessions.json           # User session storage
├── Downloads/              # Card images by color
├── images/                 # Pack images
└── README.md              # This file
```

## 🔧 Configuration

### Environment Variables
- `PORT`: Server port (default: 3001)
- `PRIVY_APP_ID`: Your Privy application ID
- `PRIVY_APP_SECRET`: Your Privy application secret

### Customization
- **Colors**: Modify CSS variables in `:root` selectors
- **Animations**: Adjust timing and easing in CSS animations
- **Packs**: Update pack configurations in the JavaScript
- **Images**: Replace images in `Downloads/` and `images/` directories

## 🎨 Design System

### Color Palette
- **Primary Background**: `#1a1b23`
- **Secondary Background**: `#232530`
- **Card Background**: `#2a2d3a`
- **Accent Gold**: `#ffd700`
- **Text Primary**: `#ffffff`
- **Text Secondary**: `#9ca3af`

### Typography
- **Primary Font**: Skranji (Google Fonts)
- **Fallback**: System fonts

### Animations
- **Hover Effects**: Smooth transitions with cubic-bezier easing
- **Loading States**: Spinner animations and shimmer effects
- **Scroll Animations**: Intersection Observer-based reveal animations

## 📱 Mobile Responsiveness

The website is fully responsive with:
- **Mobile-first design** approach
- **Touch-friendly** interface elements
- **Optimized layouts** for different screen sizes
- **Collapsible chat sidebar** on mobile
- **Adaptive typography** and spacing

## 🔒 Security Features

- **Session Management**: Secure user session handling
- **Transaction Validation**: Server-side transaction verification
- **Rate Limiting**: Protection against spam and abuse
- **Input Sanitization**: XSS and injection protection
- **CORS Configuration**: Proper cross-origin resource sharing

## 🚀 Performance Optimizations

- **Lazy Loading**: Images and content loaded on demand
- **Minified Assets**: Optimized CSS and JavaScript
- **Caching**: Browser and server-side caching
- **CDN Ready**: Static assets optimized for CDN delivery
- **Compression**: Gzip compression for faster loading

## 🎯 User Experience Enhancements

### Loading States
- Visual feedback for all operations
- Skeleton loading for content
- Progress indicators for long operations

### Error Handling
- User-friendly error messages
- Graceful fallbacks
- Retry mechanisms for failed operations

### Accessibility
- Keyboard navigation support
- Screen reader compatibility
- High contrast mode support
- Reduced motion preferences

## 🔧 Development

### Code Style
- **ES6+ JavaScript** with modern syntax
- **CSS Grid and Flexbox** for layouts
- **Semantic HTML** structure
- **Modular CSS** organization

### Browser Support
- **Chrome**: 90+
- **Firefox**: 88+
- **Safari**: 14+
- **Edge**: 90+

## 📈 Analytics and Monitoring

- **User Activity Tracking**: Session monitoring
- **Performance Metrics**: Load times and interactions
- **Error Logging**: Comprehensive error tracking
- **Usage Statistics**: Pack opening and user behavior

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- **Discord**: Join our community
- **Email**: support@solcases.fun
- **Documentation**: Check the wiki for detailed guides

## 🔮 Roadmap

### Upcoming Features
- **NFT Integration**: Mint cards as NFTs
- **Tournament System**: Competitive pack opening events
- **Social Features**: Friends list and trading
- **Mobile App**: Native mobile application
- **Advanced Analytics**: Detailed statistics and insights

### Planned Improvements
- **Performance**: Further optimization and caching
- **Security**: Enhanced security measures
- **UI/UX**: Additional animations and interactions
- **Accessibility**: Improved accessibility features

---

**Built with ❤️ for the Solana community**
