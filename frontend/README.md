# Frontend - Social Listening Dashboard

A modern, responsive web dashboard for social listening analytics built with vanilla JavaScript and TailwindCSS.

## Tech Stack

- **HTML5** - Semantic markup
- **JavaScript (ES6+)** - Vanilla JS for all functionality
- **TailwindCSS v3.4** - Utility-first CSS framework
- **PostCSS** - CSS processing
- **Chart.js** - Data visualization (referenced in page scripts)

## Project Structure

```
frontend/
├── src/
│   ├── components/       # Reusable HTML components
│   │   ├── layout.html   # Main layout wrapper
│   │   └── navbar.html   # Navigation bar
│   ├── css/
│   │   ├── global.css    # Global styles
│   │   └── tailwind.css  # Tailwind entry point
│   └── js/
│       ├── api/
│       │   └── api.js    # API client for backend communication
│       ├── pages/        # Page-specific JavaScript
│       │   ├── admin.js
│       │   ├── brand.js
│       │   ├── category.js
│       │   └── general.js
│       ├── auth.js       # Authentication logic
│       ├── chartCache.js # Chart caching utilities
│       ├── layout-loader.js # Dynamic layout loading
│       └── main.js       # Main entry point
├── dist/                 # Compiled CSS output
├── index.html           # Entry point (redirects to login/dashboard)
├── login.html           # Login page
├── brand.html           # Brand analytics page
├── category.html        # Category analytics page
├── general.html         # General analytics page
├── admin.html           # Admin panel
└── package.json         # Dependencies and scripts
```

## Features

- **Authentication System** - Token-based auth with localStorage
- **Dynamic Layout Loading** - Modular component system
- **Multiple Dashboard Views**:
  - Brand Analytics
  - Category Analytics
  - General Analytics
  - Admin Panel
- **Custom Theme** - Purple-accent dark theme with custom color palette
- **Chart Caching** - Optimized data visualization performance

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Install Tailwind CSS (if starting fresh):
```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init
```

Note: This project already has Tailwind configured, so step 3 is only needed if setting up from scratch or if `node_modules` is missing.

### Building Tailwind CSS

The project uses TailwindCSS which needs to be compiled from source files.

#### Development Mode (Watch Mode)

To build CSS and watch for changes during development:
```bash
npm run build:css
```

This command:
- Runs TailwindCSS in watch mode
- Automatically rebuilds CSS when you modify HTML or JS files
- Outputs to `dist/output.css`
- Keeps running until you stop it (Ctrl+C)

**When to use**: Keep this running while developing to see your styling changes in real-time.

#### Production Build (One-time Build)

To build minified CSS for production:
```bash
npm run build:css:prod
```

This command:
- Builds TailwindCSS once (no watching)
- Minifies the output for smaller file size
- Removes unused CSS classes
- Outputs to `dist/output.css`

**When to use**: Before deploying to production or when you just need a one-time build.

### Running the Application

1. Start your backend server (refer to backend documentation)
2. Serve the frontend using a local web server:
   ```bash
   # Using Python
   python -m http.server 8000

   # Using Node.js http-server
   npx http-server -p 8000
   ```
3. Open [http://localhost:8000](http://localhost:8000) in your browser

## Configuration

### API Configuration

Update the API base URL in [src/js/api/api.js](src/js/api/api.js) to point to your backend server.

### Theme Customization

The custom theme can be modified in [tailwind.config.js](tailwind.config.js):

- **Colors**: Custom color palette with primary purple accent
- **Fonts**: Inter font family for body and titles
- **Shadows**: Custom card shadows for depth

## Authentication

The application uses token-based authentication:
- Tokens are stored in localStorage
- Protected routes redirect to login if no token is present
- Auth logic is handled in [src/js/auth.js](src/js/auth.js)

## Pages

- **index.html** - Entry point that redirects to brand.html (if authenticated) or login.html
- **login.html** - User authentication page
- **brand.html** - Brand-specific analytics and insights
- **category.html** - Category-level analytics
- **general.html** - General overview analytics
- **admin.html** - Administrative functions and controls

## Development Guidelines

### Adding New Pages

1. Create an HTML file in the frontend root
2. Add corresponding JavaScript in `src/js/pages/`
3. Update navigation in `src/components/navbar.html`
4. Add routes to auth check if needed

### Adding New API Endpoints

Add new methods to the API client in [src/js/api/api.js](src/js/api/api.js).

### Styling

- Use TailwindCSS utility classes for styling
- Custom colors are defined in the Tailwind config
- Add global styles to `src/css/global.css` only when necessary

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## License

ISC
