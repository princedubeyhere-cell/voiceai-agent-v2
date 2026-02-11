# 🎙️ VoiceAI-Agent

**Multi-Client, Multi-Industry AI Calling Agent System** powered by OpenAI (STT + GPT-4o + TTS).

---

## Architecture

```
VoiceAI-Agent/
├── config/config.json               # Global configuration
├── package.json
├── README.md
└── src/
    ├── server.js                     # Express API server
    ├── openai/                       # OpenAI API wrappers
    │   ├── speech.js                 # Whisper STT
    │   ├── llm.js                    # GPT-4o chat + summary
    │   └── tts.js                    # TTS-1 voice synthesis
    ├── engine/                       # Core logic engine
    │   ├── masterPromptBuilder.js    # Merges all data into one LLM prompt
    │   ├── memoryManager.js          # 6-turn conversation pruning
    │   ├── callStateMachine.js       # FSM: OPENING→QUAL→OBJ→CLOSING
    │   ├── statePathTracker.js       # Records state transition history
    │   ├── inputAdapter.js           # Unified I/O (simulator + telephony)
    │   ├── interruptHandler.js       # Detects interrupts & topic switches
    │   ├── rulesGuard.js             # Forbidden response filter
    │   ├── callTimeout.js            # 90-second call cap
    │   ├── clientConstraintsLoader.js
    │   └── qualityScorer.js          # Auto-scores calls 1-10
    ├── agents/
    │   ├── callAgent.js              # Main call orchestrator
    │   ├── personaManager.js         # Loads client profiles
    │   └── fallback.js               # 3-level fallback escalation
    ├── leads/
    │   ├── leadRouter.js             # Lead API routes
    │   ├── leadProcessor.js          # Lead→Call pipeline
    │   └── clientRouter.js           # Client management routes
    ├── clients/                      # Client profile folders
    │   ├── travel-agency-01/
    │   ├── doctor-clinic-01/
    │   └── coaching-seller-01/
    ├── simulator/
    │   └── simulator.js              # CLI call simulator
    ├── logs/                         # Runtime logs
    │   └── logger.js                 # JSONL safe writer
    └── utils/
        ├── db.js                     # SQLite (WAL mode, 5 tables)
        ├── validator.js
        ├── rateLimiter.js            # Exponential backoff
        ├── errorHandler.js           # Global error handling
        └── timeoutPromise.js         # Async timeout wrapper
```

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set your OpenAI API key
# Edit config/config.json → openai.apiKey

# 3. Start the server
npm start

# 4. Run a simulated call (optional)
npm run simulate                        # Default: travel-agency-01
npm run simulate -- doctor-clinic-01    # Doctor scenario
npm run simulate -- coaching-seller-01  # Coaching scenario
```

## API Endpoints

| Method | Endpoint             | Description              |
|--------|----------------------|--------------------------|
| POST   | `/lead`              | Submit a new lead        |
| POST   | `/client/create`     | Create a client profile  |
| GET    | `/client/list`       | List all clients         |
| GET    | `/lead/logs/:leadId` | Get call logs            |
| GET    | `/lead/:id/path`     | Get state path history   |
| GET    | `/health`            | Health check             |

### Example: Submit a Lead

```bash
curl -X POST http://localhost:3000/lead \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "travel-agency-01",
    "name": "John Doe",
    "phone": "+1-555-0123",
    "email": "john@example.com",
    "requirement": "Looking for a Europe trip",
    "budget": "$3000"
  }'
```

### Example: Create a New Client

```bash
curl -X POST http://localhost:3000/client/create \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "real-estate-01",
    "name": "Prime Properties",
    "industry": "Real Estate",
    "tone": "professional",
    "greeting": "Hello! This is Prime Properties. Looking to buy or sell?"
  }'
```

## Pre-Built Client Profiles

| Client ID           | Industry              | Voice | Tone         |
|---------------------|-----------------------|-------|--------------|
| travel-agency-01    | Travel Agency         | nova  | friendly     |
| doctor-clinic-01    | Doctor/Clinic         | nova  | professional |
| coaching-seller-01  | Coaching/Course Seller| nova  | friendly     |

## Key Features

- **19 safety patches** applied (see implementation plan)
- **Master Prompt Builder** — unified LLM prompt from all client data
- **6-turn memory window** — prevents context bloat
- **Call State Machine** — OPENING → QUALIFICATION → OBJECTION → CLOSING
- **3-level fallback** — graceful escalation to human handoff
- **Rules Guard** — blocks forbidden responses in real-time
- **Quality Scoring** — auto-rates every call 1-10
- **Call Timeout** — 90-second cap with wrap-up detection
- **Interrupt Detection** — handles topic switches and frustration
- **Client Constraints** — per-industry compliance rules
- **Rate Limiter** — exponential backoff for OpenAI API
- **SQLite WAL mode** — concurrent-safe database
- **JSONL safe logging** — properly escaped, corruption-proof
- **UUID audio files** — no filename collision
- **Input Adapter** — pluggable for future telephony (Twilio/WebRTC)

## Database Tables

| Table           | Purpose                        |
|-----------------|--------------------------------|
| leads           | Lead records                   |
| call_logs       | Conversation messages          |
| call_outcomes   | Post-call summaries            |
| call_paths      | State transition history       |
| quality_scores  | Call quality ratings           |

## License

ISC
