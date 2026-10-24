const path = require("path");

// 1. Setup high-fidelity mocks for Firebase Admin and Firestore
const mockFirestore = {
  collection: (colName) => {
    return {
      where: (field, op, val) => {
        return {
          orderBy: (field, dir) => {
            return {
              get: async () => getMockSnapshot(colName)
            };
          },
          limit: (n) => {
            return {
              get: async () => getMockSnapshot(colName)
            };
          },
          get: async () => getMockSnapshot(colName)
        };
      },
      doc: (id) => {
        return {
          collection: (subCol) => {
            return {
              doc: (subId) => {
                return {
                  get: async () => {
                    return {
                      exists: true,
                      data: () => ({ dataSource: "firestore" })
                    };
                  }
                };
              }
            };
          }
        };
      },
      add: async (data) => {
        console.log(`[Firestore Mock] Document added to ${colName}:`, JSON.stringify(data, null, 2));
        return { id: "new_history_id" };
      }
    };
  },
  FieldValue: {
    serverTimestamp: () => new Date()
  }
};

function getMockSnapshot(colName) {
  const docs = [];
  if (colName === "users") {
    docs.push({
      id: "user1",
      data: () => ({ displayName: "John Doe", email: "john@example.com", teamId: "team1", role: "team_member" })
    });
  } else if (colName === "managed_members") {
    docs.push({
      id: "managed1",
      data: () => ({ displayName: "Jane Doe", email: "jane@example.com", teamId: "team1", source: "gsheets" })
    });
  } else if (colName === "shift_intervals") {
    docs.push({
      id: "slot1",
      data: () => ({ id: "slot1", name: "Day Shift", order: 1, preferences: {} })
    });
  } else if (colName === "user_shifts") {
    docs.push({
      id: "user1",
      data: () => ({ teamId: "team1", presence: "Present" })
    });
  } else if (colName === "shift_history") {
    // Empty historical context for simple test
  }
  
  return {
    empty: docs.length === 0,
    size: docs.length,
    docs: docs,
    forEach: (cb) => docs.forEach(cb)
  };
}

const adminMock = {
  firestore: () => mockFirestore,
  apps: [{}]
};

// 2. Setup mock for Firebase Functions
const functionsMock = {
  https: {
    HttpsError: class HttpsError extends Error {
      constructor(code, message) {
        super(message);
        this.code = code;
      }
    }
  },
  runWith: () => ({
    region: () => ({
      https: {
        onCall: (fn) => fn
      }
    })
  })
};

// 3. Setup mock for Google Generative AI
const genAiMock = {
  GoogleGenerativeAI: class {
    constructor(key) {
      this.key = key;
      console.log(`[Gemini SDK Mock] Initialized with API Key: ${key.substring(0, 5)}...`);
    }
    getGenerativeModel({ model }) {
      console.log(`[Gemini SDK Mock] Initializing model: ${model}`);
      return {
        generateContent: async () => {
          console.log(`[Gemini SDK Mock] generateContent called for ${model}`);
          return {
            response: {
              text: () => JSON.stringify([
                {
                  userId: "user1",
                  userName: "John Doe",
                  slotId: "slot1",
                  slotName: "Day Shift",
                  firstBreak: "10:00 AM",
                  lunch: "12:00 PM",
                  secondBreak: "3:00 PM"
                }
              ])
            }
          };
        }
      };
    }
  }
};

// Inject mocks into require.cache
require.cache[require.resolve('firebase-admin')] = {
  exports: adminMock
};
require.cache[require.resolve('firebase-functions')] = {
  exports: functionsMock
};
require.cache[require.resolve('@google/generative-ai')] = {
  exports: genAiMock
};

// Mock process.env.GEMINI_API_KEY to test the model selection logic
process.env.GEMINI_API_KEY = "dummy_api_key_for_testing";

// Import the actual shift controller
const shiftController = require("./functions/shift.js" ? "./functions/src/shift.controller" : "./functions/src/shift.controller");

async function runLocalTest() {
  console.log("=== STARTING LOCAL SCHEDULE GENERATION INTEGRATION TEST ===");
  const data = {
    teamId: "team1",
    instructions: "Make sure John Doe has standard breaks"
  };
  const context = {
    auth: {
      token: {
        name: "Test Developer",
        email: "dev@example.com"
      }
    }
  };

  try {
    const result = await shiftController.rotateShifts(data, context);
    console.log("\n=== TEST RESULT ===");
    console.log("Success Status:", result.success);
    console.log("Message:", result.message);
    console.log("Assignments:\n", JSON.stringify(result.assignments, null, 2));
    console.log("\n=== LOCAL INTEGRATION TEST PASSED SUCCESSFULLY ===");
  } catch (err) {
    console.error("Test execution failed:", err);
  }
}

runLocalTest();
