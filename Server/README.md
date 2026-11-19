
# Mafia City - Online Server

## 1. Server Overview
The Mafia City server manages online multiplayer games for Android players.

## 2. Technology
- Node.js
- TypeScript
- WebSocket
- PostgreSQL

## 3. Main Responsibilities
- Create and manage game rooms
- Support 6, 8 and 10 player rooms
- Assign player roles securely
- Manage night and day phases
- Process mafia, doctor and detective actions
- Handle voting and player elimination
- Check game results and winning teams

## 4. Player Communication
Players communicate with the server through WebSocket connections.

## 5. Security
- Role information must remain private.
- Players cannot choose or change their own roles.
- The server validates every game action.
- Player rewards must be calculated on the server.
- Admin permissions must be protected.

## 6. Database
The database will store:
- Player accounts
- Player statistics
- Game history
- League rankings
- Coins and diamonds
- VIP status

## 7. Development Milestones
1. Build the room system.
2. Implement player connections.
3. Implement role assignment.
4. Implement night and day actions.
5. Implement voting.
6. Test multiplayer games.
7. Deploy the production server.
