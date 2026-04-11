# Elepad LangGraph Agent

A scalable, production-ready LangGraph agent for the Elepad family memories application. Built with industry best practices and designed for easy tool extensibility.

## Architecture

```
agent/
├── src/
│   ├── api/           # Express API handlers
│   ├── config/        # LLM and environment configuration
│   ├── graph/         # LangGraph agent definition
│   ├── tools/         # Tools for agent (extensible)
│   ├── types/         # TypeScript type definitions
│   ├── utils/         # Utility functions (logging, etc.)
│   └── server.ts      # Main server entry point
├── package.json
├── tsconfig.json
└── README.md
```

## Features

- ✅ **LangGraph Integration** - State-of-the-art agent framework
- ✅ **Gemini API** - Uses same LLM as backend for consistency
- ✅ **REST API** - Express server with JSON endpoints
- ✅ **Conversation Management** - In-memory conversation storage (easily extensible to DB)
- ✅ **Tool Framework** - Ready for tool integration (no tools yet)
- ✅ **Error Handling** - Comprehensive error handling and logging
- ✅ **TypeScript** - Full type safety
- ✅ **Production Ready** - Best practices for scalability

## Quick Start

### Installation

```bash
npm install
```

### Configuration

1. Copy `.env.example` to `.env`
2. Add your `GEMINI_API_KEY` (same as backend)
3. Optionally configure other parameters

```bash
cp .env.example .env
# Edit .env with your API key
```

### Development

```bash
npm run dev
```

The server will start on `http://localhost:3001`

### Build

```bash
npm run build
```

### Production

```bash
npm start
```

## API Endpoints

### Health Check
```bash
GET /health
```

Returns server health status.

### Invoke Agent
```bash
POST /agent/invoke
Content-Type: application/json

{
  "message": "Create a narrative for my family album",
  "conversationId": "optional-uuid",
  "userId": "optional-user-id",
  "context": {
    "albumTheme": "Adventure",
    "familyName": "The Chronicles"
  }
}
```

Response:
```json
{
  "conversationId": "uuid",
  "message": "I'd love to help create a narrative...",
  "timestamp": "2025-04-11T10:00:00Z",
  "metadata": {
    "executionTime": 1234
  }
}
```

### Get Conversation History
```bash
GET /agent/conversations/:conversationId
```

Returns all messages in a conversation.

### Clear Conversation
```bash
DELETE /agent/conversations/:conversationId
```

Clears conversation history from memory.

## Extending with Tools

### Adding a New Tool

1. Create a new file in `src/tools/`:

```typescript
// src/tools/generateNarrative.ts
import { z } from "zod";
import type { Tool } from "@/types/index.js";

const GenerateNarrativeInput = z.object({
  memories: z.array(z.string()),
  theme: z.string(),
});

export const generateNarrativeTool: Tool = {
  name: "generate_narrative",
  description: "Generate a narrative for album pages",
  schema: GenerateNarrativeInput,
  execute: async (input) => {
    const parsed = GenerateNarrativeInput.parse(input);
    // Implementation here
    return "Generated narrative...";
  },
};
```

2. Register the tool in `src/tools/index.ts`:

```typescript
export function getAvailableTools(): Tool[] {
  return [
    generateNarrativeTool,
    // Add more tools as needed
  ];
}
```

3. The tool will be automatically available to the agent.

## Configuration

### Environment Variables

- `AGENT_PORT` - Server port (default: 3001)
- `GEMINI_API_KEY` - API key for Gemini (required)
- `GEMINI_MODEL` - Model to use (default: gemini-2.0-flash)
- `GEMINI_TEMPERATURE` - Temperature for sampling (0-2, default: 0.7)
- `GEMINI_MAX_TOKENS` - Maximum tokens per response (default: 2048)
- `GEMINI_TOP_P` - Nucleus sampling parameter (default: 0.9)
- `DEBUG` - Enable debug logging (default: false)

## Best Practices

### Message Flow
1. User sends message via `/agent/invoke`
2. Message is added to conversation history
3. LangGraph processes message with Gemini
4. Response is added to history and returned
5. Conversation state is persisted

### State Management
- Conversation state is stored in-memory
- Can be extended to use database (PostgreSQL via Supabase)
- Each conversation has isolated context

### Error Handling
- All endpoints return appropriate HTTP status codes
- Error messages are descriptive
- Logging includes execution context

## Future Enhancements

- [ ] Database persistence for conversations (Supabase)
- [ ] Tool support for:
  - Generate narratives
  - Analyze memories
  - Suggest layouts
  - Transcribe audio
  - Generate cover images
- [ ] Streaming responses for real-time feedback
- [ ] Rate limiting and authentication
- [ ] Conversation export/import
- [ ] Analytics and monitoring

## Development

### Linting
```bash
npm run lint
```

### Formatting
```bash
npm run format
```

### Type Checking
```bash
tsc --noEmit
```

## Project Structure Philosophy

- **Modular**: Each concern (config, graph, tools, API) is separated
- **Scalable**: Easy to add new tools and features
- **Typed**: Full TypeScript for safety
- **Documented**: Clear structure and inline comments
- **Production-Ready**: Error handling, logging, health checks

## Contributing

When adding new features:

1. Maintain the modular structure
2. Add types to `src/types/`
3. Include error handling
4. Add logging via `logger` utility
5. Document in README if it's a public feature

## License

Part of the Elepad project - Proprietary
