/**
 * Example: Using the Agent API
 *
 * This file shows how to interact with the LangGraph agent
 * from different parts of the application
 */

/**
 * Example 1: Direct invocation via REST API
 */
async function exampleRestAPI() {
  const response = await fetch("http://localhost:3001/agent/invoke", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: "Create a poetic narrative for a family beach day album",
      conversationId: "my-conversation-123",
      userId: "user-456",
      context: {
        albumTheme: "Adventure",
        familyName: "The Smith Family",
        numberOfPhotos: 8,
      },
    }),
  });

  const result = await response.json();
  console.log("Agent response:", result);
  // Output:
  // {
  //   "conversationId": "my-conversation-123",
  //   "message": "What a beautiful summer memory! The golden hour light...",
  //   "timestamp": "2025-04-11T10:00:00Z",
  //   "metadata": { "executionTime": 1234 }
  // }
}

/**
 * Example 2: Multi-turn conversation
 */
async function exampleMultiTurnConversation() {
  const conversationId = "summer-album-2024";

  // First message
  const response1 = await fetch("http://localhost:3001/agent/invoke", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: "Help me create an album about our summer vacation",
      conversationId,
      userId: "user-789",
    }),
  });

  const result1 = await response1.json();
  console.log("Agent:", result1.message);

  // Second message - continuing the conversation
  const response2 = await fetch("http://localhost:3001/agent/invoke", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: "We have photos from the beach and mountains",
      conversationId, // Same conversation ID
      userId: "user-789",
    }),
  });

  const result2 = await response2.json();
  console.log("Agent:", result2.message);

  // Third message
  const response3 = await fetch("http://localhost:3001/agent/invoke", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message:
        "Can you suggest how to organize these into meaningful pages?",
      conversationId, // Same conversation ID
      userId: "user-789",
    }),
  });

  const result3 = await response3.json();
  console.log("Agent:", result3.message);
}

/**
 * Example 3: Retrieve conversation history
 */
async function exampleGetConversationHistory() {
  const conversationId = "my-conversation-123";

  const response = await fetch(
    `http://localhost:3001/agent/conversations/${conversationId}`,
  );

  const history = await response.json();
  console.log("Conversation history:", history);
  // Output:
  // {
  //   "conversationId": "my-conversation-123",
  //   "messages": [
  //     {
  //       "role": "user",
  //       "content": "Create a poetic narrative...",
  //       "timestamp": "2025-04-11T10:00:00Z"
  //     },
  //     {
  //       "role": "assistant",
  //       "content": "What a beautiful summer memory...",
  //       "timestamp": "2025-04-11T10:00:01Z"
  //     }
  //   ],
  //   "metadata": { "userId": "user-456", "conversationId": "..." }
  // }
}

/**
 * Example 4: Clear conversation
 */
async function exampleClearConversation() {
  const conversationId = "my-conversation-123";

  const response = await fetch(
    `http://localhost:3001/agent/conversations/${conversationId}`,
    {
      method: "DELETE",
    },
  );

  const result = await response.json();
  console.log("Result:", result);
  // Output: { "message": "Conversation cleared successfully", "conversationId": "..." }
}

/**
 * Example 5: Using the agent from the backend API
 *
 * This shows how to call the agent from the Elepad API
 * (e.g., from the MemoriesAlbumService)
 */
async function exampleFromBackendAPI() {
  // This could be used in /apps/api/src/modules/memoriesAlbum/service.ts
  async function generateAlbumNarrativeWithAgent(
    albumTitle: string,
    albumDescription: string,
    memories: Array<{ title: string; caption: string }>,
  ): Promise<string> {
    const message = `
      Please create a poetic narrative for an album with the following details:
      
      Title: ${albumTitle}
      Description: ${albumDescription}
      
      Memories:
      ${memories.map((m) => `- ${m.title}: ${m.caption}`).join("\n")}
      
      The narrative should be emotionally compelling and suitable for a family photo album.
    `;

    const response = await fetch("http://localhost:3001/agent/invoke", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        userId: "system",
        context: {
          source: "album-generation",
          albumId: albumTitle, // Would be real album ID in actual implementation
        },
      }),
    });

    const result = await response.json();
    return result.message;
  }

  // Usage
  const narrative = await generateAlbumNarrativeWithAgent(
    "Summer 2024",
    "A collection of our best summer moments",
    [
      { title: "Beach Day", caption: "Fun in the sun" },
      { title: "Mountain Hike", caption: "Scenic views" },
    ],
  );

  console.log("Generated narrative:", narrative);
}

/**
 * Example 6: Health check
 */
async function exampleHealthCheck() {
  const response = await fetch("http://localhost:3001/health");
  const health = await response.json();
  console.log("Agent health:", health);
  // Output: { "status": "healthy", "timestamp": "...", "uptime": 3600 }
}

// Run examples
console.log("Agent API Examples");
console.log("==================\n");

console.log("Note: Make sure the agent server is running:");
console.log("  npm run dev  (in the agent directory)\n");

console.log("Examples available:");
console.log("1. exampleRestAPI() - Simple REST API call");
console.log("2. exampleMultiTurnConversation() - Multi-turn conversation");
console.log("3. exampleGetConversationHistory() - Retrieve history");
console.log("4. exampleClearConversation() - Clear conversation");
console.log("5. exampleFromBackendAPI() - Integration with backend API");
console.log("6. exampleHealthCheck() - Health check");
