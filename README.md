Geotab Tracker
This project is a real-time vehicle tracking application that uses the Geotab API to display vehicle locations on a map. It's built with modern web technologies and provides a user-friendly interface for monitoring your fleet.

Features
Real-time Vehicle Tracking: View the live location of your vehicles on a map.

Vehicle History: See a trail of where your vehicles have been.

Exception Reporting: Get alerts for events like harsh braking, speeding, and after-hours usage.

Responsive Design: The application is designed to work on both desktop and mobile devices.

Getting Started
These instructions will get you a copy of the project up and running on your local machine for development and testing purposes.

Prerequisites
Node.js and npm

A Geotab account with API access

Installation
Clone the repository:

git clone https://github.com/AmanyaPhillip/geotab-tracker.git
Install dependencies:

npm install
Configure your Geotab API credentials:

Create a .env file in the root of the project and add your Geotab API credentials:

GEOTAB_SERVER=my.geotab.com
GEOTAB_DATABASE=your_database_name
GEOTAB_USER=your_username
GEOTAB_PASSWORD=your_password
Start the development server:

npm start
The application will now be running at http://localhost:3000.

Built With
React - The web framework used

Leaflet - For interactive maps

Geotab API - To fetch vehicle data

Contributing
Please read CONTRIBUTING.md for details on our code of conduct, and the process for submitting pull requests to us.

License
This project is licensed under the MIT License - see the LICENSE.md file for details.