# AI-Diary (智能日记)

AI-Diary is an intelligent journaling application that combines traditional diary-keeping with AI-powered insights and Chinese traditional calendar information. The application helps users maintain a consistent journaling habit while providing useful context and analysis through AI.

## Features

### Current Features

- **Diary Entries Management**: Create, edit, view, and delete diary entries with a clean and intuitive interface.
- **AI-Powered Analysis**: Get AI-generated insights from your diary entries.
- **Chinese Traditional Calendar Integration**: 
  - Display lunar calendar information for each date
  - Show 干支年月日 (celestial stem and terrestrial branch)
  - Display 节气 (Solar Terms) on their first day
  - Provide 宜忌 (recommendations and taboos) for each day
- **Calendar View**: Navigate through your entries with a calendar interface showing entry indicators.
- **Responsive Design**: Works seamlessly on both desktop and mobile devices.

### Planned Features

1. **AI Topic Suggestion Kanban**:
   - AI will suggest topics based on your journal entries
   - Users can select which topics should be tracked as ongoing threads
   - Visual kanban board for managing topic threads

2. **Local Topic Data Storage**:
   - Topic-related data will be stored locally
   - No need to generate topic information at runtime
   - Improved performance and offline capabilities

3. **Multiple Thread Visualization Options**:
   - Display topic threads in different formats (Gantt charts, timelines, etc.)
   - Track progress and changes over time
   - Visual identification of connections between entries

4. **八字 (BaZi) Personalized Advice**:
   - Calculate and store user's 八字 (Chinese birth chart)
   - Provide specialized advice based on personal BaZi information
   - Integrate traditional Chinese metaphysics into diary recommendations

## Getting Started

### Prerequisites

- Python 3.8+ (for server)
- Node.js and npm (for client)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/miofuku/ai-diary.git
cd ai-diary
```

2. Set up the server:
```bash
# Install Python dependencies
pip install -r requirements.txt

# Start the server
python server.py
```

3. Set up the client:
```bash
# Navigate to client directory
cd client

# Install dependencies
npm install

# Start the development server
npm start
```

4. Open your browser and navigate to `http://localhost:3000`

## Technology Stack

### Backend
- Python (Flask) for API endpoints
- tyme4ts for Chinese calendar calculations

### Frontend
- React for UI components
- react-calendar for calendar visualization

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

```bash
python server.py
```

### Client

```bash
cd client
npm start
```
