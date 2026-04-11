# Agent Architecture & Best Practices

This document explains the architecture of the LangGraph Agent and how it's designed for scalability and extensibility.

## Design Principles

### 1. **Modular Architecture**
Each concern is separated into its own module:
- `config/` - Configuration and LLM initialization
- `types/` - TypeScript type definitions
- `graph/` - LangGraph agent logic
- `tools/` - Tool definitions and executors
- `api/` - Express API handlers
- `utils/` - Utilities (logging, helpers)

### 2. **State Management**
The agent uses LangGraph's state management:
- Annotations for type-safe state updates
- Reducers for state modifications
- Proper typing for all state transitions

### 3. **Tool Framework**
Extensible tool framework ready for future features:
- Consistent tool interface (`name`, `description`, `schema`, `execute`)
- Zod for input validation
- Async tool execution
- Error handling

### 4. **API Design**
Clean REST API with standard endpoints:
- `/health` - Server health
- `POST /agent/invoke` - Invoke agent
- `GET /agent/conversations/:id` - Get history
- `DELETE /agent/conversations/:id` - Clear conversation

## Component Breakdown

### Configuration Layer (`config/llm.ts`)

```typescript
// Initialize LLM with environment variables
const config = getLLMConfig(); // Reads from .env
const llm = initializeLLM(config); // Creates ChatGoogleGenerativeAI
```

**Best Practices:**
- Centralized configuration
- Environment-based setup
- Easy to swap LLM models

### Type Definitions (`types/`)

```typescript
// Main types
LLMConfig            // LLM configuration
AgentState           // Agent state structure
InvokeAgentRequest   // API request type
InvokeAgentResponse  // API response type
Tool                 // Tool interface
```

**Best Practices:**
- All types are Zod-validated where appropriate
- Clear interfaces for external APIs
- Extensible for future types

### Graph Layer (`graph/agent.ts`)

```typescript
// Create graph with nodes and edges
const graph = createAgentGraph(model);

// Nodes:
// - process_messages: Handle user input and generate response

// Flow: USER_INPUT -> process_messages -> LLM -> RESPONSE
```

**Best Practices:**
- Single responsibility per node
- Clear error handling
- State mutations through reducers

### Tools Layer (`tools/index.ts`)

```typescript
// Current: No tools
// Future tools:
// - generateNarrative
// - analyzeMemories
// - transcribeAudio
// - etc.
```

**Best Practices:**
- Consistent tool interface
- Validated inputs with Zod
- Async execution
- Error handling

### API Layer (`api/handlers.ts`)

```typescript
// Handlers:
// - invokeAgentHandler: Process messages
// - getConversationHandler: Retrieve history
// - clearConversationHandler: Clear state
// - healthCheckHandler: Server status
```

**Best Practices:**
- Separated concerns (handlers)
- Proper HTTP status codes
- Error handling for each endpoint
- Logging for debugging

### Server (`server.ts`)

```typescript
// Express app setup
// Middleware configuration
// Route definitions
// Graceful shutdown
```

**Best Practices:**
- Clean initialization
- Comprehensive error handling
- Signal handling for graceful shutdown
- Structured logging

## State Flow

```
┌───────────────────────────────────────────────────────────┐
│                     User Request                           │
└─────────┬───────────────────────────────────────────────────┘
          │
          ▼
┌───────────────────────────────────────────────────────────┐
│         POST /agent/invoke                                 │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ invokeAgentHandler                                   │  │
│  └─────────────────────────────────────────────────────┘  │
└─────────┬───────────────────────────────────────────────────┘
          │
          ▼
┌───────────────────────────────────────────────────────────┐
│  Get or Create Conversation State                          │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ {                                                    │  │
│  │   messages: [{role, content, timestamp}, ...],      │  │
│  │   context: {...},                                   │  │
│  │   metadata: {userId, conversationId, ...}           │  │
│  │ }                                                    │  │
│  └─────────────────────────────────────────────────────┘  │
└─────────┬───────────────────────────────────────────────────┘
          │
          ▼
┌───────────────────────────────────────────────────────────┐
│  Add User Message to History                               │
│  messages.push({role: 'user', content: msg})               │
└─────────┬───────────────────────────────────────────────────┘
          │
          ▼
┌───────────────────────────────────────────────────────────┐
│         Invoke LangGraph Agent                             │
│  process_messages(state) →                                 │
│    - Convert messages to LangChain format                  │
│    - Add system prompt                                     │
│    - Call Gemini LLM                                       │
│    - Return assistant message                              │
└─────────┬───────────────────────────────────────────────────┘
          │
          ▼
┌───────────────────────────────────────────────────────────┐
│  Update Conversation State                                 │
│  messages.push({role: 'assistant', content: response})     │
│  Store in conversationStore                                │
└─────────┬───────────────────────────────────────────────────┘
          │
          ▼
┌───────────────────────────────────────────────────────────┐
│         Return Response                                    │
│  {                                                         │
│    conversationId: "...",                                  │
│    message: "...",                                         │
│    timestamp: Date,                                        │
│    metadata: {executionTime}                               │
│  }                                                         │
└───────────────────────────────────────────────────────────┘
```

## Extensibility Points

### 1. Adding Tools

Create a new file in `src/tools/`:

```typescript
// src/tools/generateNarrative.ts
import { z } from "zod";
import type { Tool } from "@/types/index.js";

const GenerateNarrativeSchema = z.object({
  memories: z.array(z.string()),
  theme: z.string(),
});

export const generateNarrativeTool: Tool = {
  name: "generate_narrative",
  description: "Generate a narrative for album pages",
  schema: GenerateNarrativeSchema,
  execute: async (input) => {
    const parsed = GenerateNarrativeSchema.parse(input);
    // Implementation
    return "Generated narrative";
  },
};
```

Then register in `src/tools/index.ts`:

```typescript
export function getAvailableTools(): Tool[] {
  return [generateNarrativeTool];
}
```

### 2. Adding Endpoints

Add handler in `src/api/handlers.ts`, then add route in `src/server.ts`:

```typescript
app.post("/agent/custom", async (req, res) => {
  customHandler(req, res);
});
```

### 3. Changing LLM Configuration

Modify `src/config/llm.ts`:

```typescript
// Change temperature, model, etc.
export function getLLMConfig(): LLMConfig {
  return {
    modelName: "gemini-pro", // Different model
    temperature: 0.5, // Different temperature
    // ...
  };
}
```

### 4. Changing State Structure

Update `src/types/graph.ts`:

```typescript
export const AgentGraphStateAnnotation = Annotation.Root({
  messages: ..., // Existing
  newField: Annotation<...>({ // New field
    reducer: (state, update) => { ... }
  }),
});
```

### 5. Adding Persistence

Replace in-memory storage in `src/api/handlers.ts`:

```typescript
// Current: Map-based in-memory
const conversationStore = new Map();

// Future: Database persistence
const conversationStore = new SupabaseConversationStore();
```

## Performance Considerations

### 1. Model Initialization
- Done once at startup
- Reused for all requests
- No per-request overhead

### 2. State Management
- In-memory (fast)
- Can be migrated to database
- Conversation isolation

### 3. Concurrent Requests
- Express handles per-request
- Gemini API calls are async
- No blocking operations

### 4. Error Recovery
- Graceful degradation
- Proper error messages
- No state corruption on error

## Security Considerations

### 1. API Key Management
- Environment variables only
- Never logged
- Loaded at startup

### 2. Input Validation
- Zod schema validation
- Message content bounds
- Type checking

### 3. Rate Limiting
- Not implemented yet
- Can be added as middleware
- Per conversation or IP

### 4. Authentication
- Not required currently
- Can add JWT validation
- Optional user ID tracking

## Testing Strategy

### Unit Tests
- Tool functions
- Handlers (mocked graph)
- Utilities

### Integration Tests
- Full request/response flow
- Graph execution
- State updates

### E2E Tests
- Full server
- Real Gemini API calls
- Multiple conversations

## Monitoring & Observability

### Logging
- `logger` utility with levels
- Debug mode for detailed logs
- Structured logging ready

### Metrics
- Execution time tracking
- Token usage (from LLM)
- Request count

### Error Tracking
- Comprehensive error logging
- Context in error messages
- Graceful degradation

## Migration Path: Adding Database

When scaling beyond in-memory storage:

```typescript
// 1. Create repository interface
interface ConversationRepository {
  get(id: string): Promise<ConversationData>;
  save(id: string, data: ConversationData): Promise<void>;
  delete(id: string): Promise<void>;
}

// 2. Implement Supabase repository
class SupabaseConversationRepository implements ConversationRepository {
  async get(id: string): Promise<ConversationData> {
    return this.supabase
      .from('conversations')
      .select('*')
      .eq('id', id)
      .single();
  }
  // ... other methods
}

// 3. Update handlers to use repository
const conversationRepo = new SupabaseConversationRepository();
conversationData = await conversationRepo.get(conversationId);
```

## Summary

The agent is built with scalability in mind:

✅ **Modular** - Easy to understand and modify
✅ **Typed** - Full TypeScript safety
✅ **Extensible** - Ready for tools and features
✅ **Observable** - Logging and error handling
✅ **Testable** - Clear component boundaries
✅ **Performant** - Optimized for real-time responses
✅ **Maintainable** - Clear structure and documentation

Future enhancements are straightforward to implement without refactoring the core architecture.
