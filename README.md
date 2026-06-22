# Geotab Tracker

A real-time vehicle tracking web app that uses the [Geotab](https://www.geotab.com/) API to display fleet locations on an interactive map. Sign in with your Geotab credentials, watch your vehicles move live, review past trips, and visualize driving events.

## Features

- **Real-time tracking** — live vehicle positions plotted on a Leaflet map
- **Vehicle selection** — pick which vehicles from your fleet to follow
- **Past trips** — review historical routes and trip details
- **Driving insights** — g-force / exception charts for events like harsh braking and acceleration (via Recharts)
- **In-app authentication** — log in with your Geotab server, database, username, and password
- **Resilient UI** — error boundaries and friendly API error handling
- Responsive design for desktop and mobile

## Tech Stack

- [React](https://react.dev/) + [Vite](https://vitejs.dev/)
- [Leaflet](https://leafletjs.com/) + [react-leaflet](https://react-leaflet.js.org/) for mapping
- [Axios](https://axios-http.com/) for Geotab API calls
- [Recharts](https://recharts.org/) for data visualization
- [gh-pages](https://www.npmjs.com/package/gh-pages) for deployment

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) and npm
- A Geotab account with API access

### Installation

```bash
git clone https://github.com/AmanyaPhillip/geotab-tracker.git
cd geotab-tracker
npm install
npm run dev
```

Open the local URL Vite prints (usually [http://localhost:5173](http://localhost:5173)), then enter your Geotab server, database, username, and password in the login form to connect.

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Build for production |
| `npm run preview` | Preview the production build |
| `npm run deploy` | Build and publish to GitHub Pages |
| `npm run lint` | Run ESLint |

## Project Structure

```
src/
├─ App.jsx
└─ components/
   ├─ AuthForm.jsx         # Geotab login
   ├─ VehicleSelector.jsx  # Choose vehicles to track
   ├─ VehicleMap.jsx       # Leaflet map with live markers
   ├─ MapComponents.jsx    # Map helpers
   ├─ PastTripsCard.jsx    # Historical trips
   ├─ GForceChart.jsx      # Driving-event charts
   ├─ NavBar.jsx
   ├─ ErrorBoundary.jsx
   ├─ vehicleUtils.js
   └─ apiErrorUtils.js
```

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
