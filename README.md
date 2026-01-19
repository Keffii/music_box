<p align="center">
  <img
    src="https://github.com/user-attachments/assets/c6afa18b-e0f7-463c-9f81-14609c0139a9"
    alt="Music Box logo"
    width="220"
    height="202"
  />
</p>
<h1 align="center">Music Box</h1>
<p align="center">
  <strong>A cloud-based music streaming platform</strong>
</p>

## Website
[https://develop.d2ma9zjubqxtjv.amplifyapp.com/](https://develop.d2ma9zjubqxtjv.amplifyapp.com/)

### Testing the Platform
To register and test the platform without using your personal email, you can use a temporary email service:
- [10 Minute Mail](https://10minutemail.com/)

## Features
- Cloud-based music streaming
- User authentication and registration
- Real-time monitoring and analytics
- Web interface with realtime updates
- Scalable infrastructure
- Containerized architecture with Docker for both frontend and backend
- ESP32 Bluetooth physical controller integration

## System Architecture
The Music Box platform follows a microservices architecture deployed on AWS:

<img width="551" alt="System Architecture Diagram" src="https://github.com/user-attachments/assets/f37ef939-1489-4e2e-bb2d-3df03fbf4195" />

**Architecture Components:**
- **Frontend**: React application hosted on AWS Amplify
- **Backend**: Spring Boot REST API deployed on Elastic Beanstalk
- **Database**: MySQL on AWS RDS for persistent storage
- **Storage**: AWS S3 for music file storage
- **Authentication**: AWS Cognito for secure user management
- **Monitoring**: Grafana (Cloud) for real-time analytics and metrics
- **IoT Controller**: ESP32 microcontroller with Bluetooth connectivity

## Database Schema
The application uses a relational database design to manage users, songs, playlists, and analytics:

<img width="1539" alt="Database ER Diagram" src="https://github.com/user-attachments/assets/bbe7cc1b-f81e-4a0e-93bc-e209d112d77e" />

**Key Entities:**
- **Users**: Managed through AWS Cognito
- **Songs**: Metadata stored in MySQL, files in S3
- **Playlists**: User-created collections with many-to-many relationships
- **Favorites**: User's liked songs
- **Command Log**: Analytics tracking for user interactions
- **Volume Log**: Historical volume adjustment data

## Security
- **Spring Security**: Backend authentication and authorization
- **AWS Cognito**: Secure user identity management and JWT validation
- **HTTPS/SSL**: Backend hosted on a domain with SSL certificate
- **Environment Variables**: Sensitive configuration kept secure

## ESP32 Bluetooth Controller
Physical hardware controller for wireless music playback control:

<img width="695" alt="ESP32 Controller Diagram" src="https://github.com/user-attachments/assets/f7d478de-0e7f-420b-b9a4-987a25af09f8" />

**Features:**
- Play/Pause control
- Next/Previous track navigation
- Volume adjustment with rotary encoder
- Seek (+10s skip)
- Mute functionality
- Bluetooth Low Energy (BLE) communication

## Application Interface
<img src="https://github.com/user-attachments/assets/9fcbcc33-5b61-4bd5-86a5-4694c5369077" alt="Music Box application preview" width="100%"/>

## Monitoring
The platform includes comprehensive monitoring and analytics powered by Grafana, providing real-time insights into top 5 songs, last commands, command distribution, and song count.

### Grafana Dashboard
<img src="https://github.com/user-attachments/assets/4c54b681-7d9a-4d33-a0a5-873e218b46bb" alt="Grafana monitoring dashboard" width="100%"/>

## Tech Stack
- **Frontend**: React, TypeScript (Dockerized)
- **Backend**: Spring Boot (Dockerized)
- **Cloud**: AWS (Amplify, Elastic Beanstalk, RDS, S3, Cognito)
- **Monitoring**: Grafana Cloud
- **Database**: MySQL (AWS RDS)
- **IoT**: ESP32 microcontroller with Bluetooth
- **Containerization**: Docker & Docker Compose

## Installation
```bash
# Clone the repository
git clone https://github.com/Keffii/music_box.git

# Enter the correct repo folder
cd music_box

# Option A: Run with Docker Compose (from repo root)
docker-compose up -d

# Option B: Run services locally
# Start backend (new terminal recommended)
cd backend
./mvnw spring-boot:run

# Start frontend (new terminal)
cd ../frontend
npm install
npm start
```

## Music Tracklist
All music used is royalty-free from Pixabay:

**Electronic:**
- [Better Day](https://pixabay.com/music/beats-better-day-186374/)
- [Abstract Beauty](https://pixabay.com/music/upbeat-abstract-beauty-378257/)
- [Cascade Breathe](https://pixabay.com/music/beats-cascade-breathe-future-garage-412839/)
- [Running Night](https://pixabay.com/music/funk-running-night-393139/)

**Lofi:**
- [Coffee Lofi](https://pixabay.com/music/lofi-coffee-lofi-lofi-music-chill-ambient-458900/)
- [Good Night Lofi](https://pixabay.com/music/beats-good-night-lofi-cozy-chill-music-160166/)
- [Lofi Study](https://pixabay.com/music/beats-lofi-study-calm-peaceful-chill-hop-112191/)
- [Lofi Chill](https://pixabay.com/music/lofi-lofi-lofi-chill-lofi-girl-456265/)

**Hip Hop:**
- [Hype Drill Music](https://pixabay.com/music/trap-hype-drill-music-438398/)
- [Lonewolf Dark Trap](https://pixabay.com/music/trap-lonewolf-dark-hard-sad-trap-beat-prod-by-onesevenbeatxs-156895/)
- [Hip Hop Beat](https://pixabay.com/music/beats-hiphop-427992/)
- [Energetic Hip Hop](https://pixabay.com/music/beats-energetic-hip-hop-8303/)

**Trance:**
- [Trance Dance Club](https://pixabay.com/music/upbeat-trance-dance-club-music-409571/)
- [Trance 123192](https://pixabay.com/music/techno-trance-trance-123192/)
- [Dance Trance](https://pixabay.com/music/dance-trance-137032/)
- [Pure Trance](https://pixabay.com/music/electro-pure-trance-459528/)
