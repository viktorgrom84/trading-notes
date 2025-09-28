# Trading Notes App

A modern React application for tracking trading performance and managing trading notes.

## Features

- **User Authentication**: Login and register with username/password
- **Trading Notes Management**: Add, edit, and delete trading positions
- **Statistics Dashboard**: View comprehensive trading statistics
- **Interactive Charts**: Visualize performance with line charts, bar charts, and pie charts
- **Responsive Design**: Works on desktop and mobile devices
- **Local Storage**: Data persists in browser localStorage

## Tech Stack

- React 18
- Vite (build tool)
- React Router (navigation)
- Recharts (charts)
- Lucide React (icons)
- CSS (styling)

## Getting Started

### Prerequisites

- Node.js (version 14 or higher)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd trading-notes
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser and navigate to `http://localhost:5173`

## Deployment to Vercel

### Option 1: Deploy via Vercel CLI

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Build the project:
```bash
npm run build
```

3. Deploy to Vercel:
```bash
vercel
```

4. Follow the prompts to configure your deployment

### Option 2: Deploy via Vercel Dashboard

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Sign in with your GitHub account
4. Click "New Project"
5. Import your repository
6. Vercel will automatically detect it's a Vite project
7. Click "Deploy"

### Option 3: Deploy via GitHub Integration

1. Connect your GitHub repository to Vercel
2. Vercel will automatically deploy on every push to main branch
3. You'll get a live URL for your app

## Usage

1. **Register/Login**: Create an account or login with existing credentials
2. **Add Trades**: Use the "Trading Notes" page to add new trading positions
3. **Track Performance**: View statistics and charts on the "Statistics" page
4. **Dashboard**: Get an overview of your trading performance on the main dashboard

## Data Storage

The app uses browser localStorage to persist data. This means:
- Data is stored locally in your browser
- Data persists between sessions
- Data is not shared between different browsers/devices
- For production use, consider implementing a backend database

## Project Structure

```
src/
├── components/
│   ├── Login.jsx          # Authentication component
│   ├── Navbar.jsx         # Navigation bar
│   ├── Dashboard.jsx      # Main dashboard
│   ├── TradingNotes.jsx   # Trading notes management
│   └── Statistics.jsx     # Statistics and charts
├── App.jsx               # Main app component
├── App.css              # Global styles
└── main.jsx             # App entry point
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - feel free to use this project for personal or commercial purposes.