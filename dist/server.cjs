var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_config = require("dotenv/config");
var import_express = __toESM(require("express"), 1);
var import_cors = __toESM(require("cors"), 1);
var import_express_rate_limit = require("express-rate-limit");
var import_multer = __toESM(require("multer"), 1);
var import_node_path = __toESM(require("node:path"), 1);
var import_vite = require("vite");

// services/IntelligenceRouter.ts
var import_genai = require("@google/genai");
var IntelligenceRouter = class {
  constructor() {
    this.ai = new import_genai.GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  pickBestModel(complexity) {
    switch (complexity) {
      case "FAST_ANALYSIS":
        return "gemini-3-flash-preview";
      case "DEEP_REASONING":
        return "gemini-3-pro-preview";
      case "VISION_ANALYSIS":
        return "gemini-3-pro-image-preview";
      case "CREATIVE_EDIT":
        return "gemini-2.5-flash-image";
      case "VIDEO_GENERATION":
        return "veo-3.1-fast-generate-preview";
      case "LOCATION_SERVICES":
        return "gemini-2.5-flash";
      default:
        return "gemini-3-flash-preview";
    }
  }
  async execute(complexity, contents, config = {}) {
    const model = this.pickBestModel(complexity);
    if (complexity === "VIDEO_GENERATION") {
      throw new Error("Video generation requires specific operation handling via generateVideo method.");
    }
    const generationConfig = {
      systemInstruction: config.systemInstruction,
      responseMimeType: config.responseMimeType,
      responseSchema: config.responseSchema,
      tools: config.tools,
      toolConfig: config.toolConfig,
      imageConfig: config.imageConfig
    };
    if (config.thinkingBudget && (model === "gemini-3-pro-preview" || model === "gemini-3-pro-image-preview")) {
      generationConfig.thinkingConfig = { thinkingBudget: config.thinkingBudget };
    }
    return await this.ai.models.generateContent({
      model,
      contents: typeof contents === "string" ? { parts: [{ text: contents }] } : contents,
      config: generationConfig
    });
  }
  async parseFieldIntent(userInput, projectContext) {
    return await this.execute(
      "FAST_ANALYSIS",
      `You are a restoration AI assistant. Analyze this field technician's input: "${userInput}". 
         Context: ${JSON.stringify(projectContext)}.
         Categorize the input into: 'Psychrometrics', 'Equipment', 'Safety', or 'General'.
         Extract structured data if possible (e.g. temp, rh, count).
         Provide a clean, professional summary sentence.`,
      {
        responseMimeType: "application/json",
        responseSchema: {
          type: import_genai.Type.OBJECT,
          properties: {
            category: { type: import_genai.Type.STRING, enum: ["Psychrometrics", "Equipment", "Safety", "General"] },
            structuredData: { type: import_genai.Type.OBJECT, description: "Any extracted numbers or entities" },
            summary: { type: import_genai.Type.STRING, description: "A polished log entry string" },
            action: { type: import_genai.Type.STRING, description: "Suggested system action ID if applicable" }
          }
        }
      }
    );
  }
  async generateScope(projectContext) {
    return await this.execute(
      "DEEP_REASONING",
      `Generate a professional mitigation scope (Xactimate style) based on this data: ${projectContext}. 
        You must include appropriate line items for Water Extraction, Demolition (e.g. drywall, flooring), and Equipment Setup/Monitoring (e.g. air movers, dehumidifiers) based on typical project requirements for the given Category and Class.
        Return an array of line items with: code, description, quantity, unit (LF, SF, EA), and rate.`,
      {
        responseMimeType: "application/json",
        responseSchema: {
          type: import_genai.Type.OBJECT,
          properties: {
            lineItems: {
              type: import_genai.Type.ARRAY,
              items: {
                type: import_genai.Type.OBJECT,
                properties: {
                  code: { type: import_genai.Type.STRING },
                  description: { type: import_genai.Type.STRING },
                  quantity: { type: import_genai.Type.NUMBER },
                  unit: { type: import_genai.Type.STRING },
                  rate: { type: import_genai.Type.NUMBER }
                },
                required: ["code", "description", "quantity", "unit", "rate"]
              }
            },
            justification: { type: import_genai.Type.STRING }
          }
        }
      }
    );
  }
  async generateTasks(projectContext) {
    return await this.execute(
      "DEEP_REASONING",
      `Based on the following restoration project details, auto-generate a comprehensive list of recommended tasks strictly adhering to IICRC S500 (Water) and IICRC S520 (Mold) standard requirements per room and per material listed. 
        Context: ${projectContext}
        Ensure tasks cover material removal, equipment recommendations, containment (if needed), and daily dry logging requirements. For each overall task, identify 2 to 5 specific, actionable compliance checklist subtasks or verification steps (e.g. particular items from S500/S520 guidance).
        Return the tasks as a JSON array of objects, where each object has a 'text' (string), a 'priority' (string: 'high', 'medium', or 'low'), and 'subtasks' (an array of strings).`,
      {
        responseMimeType: "application/json",
        responseSchema: {
          type: import_genai.Type.ARRAY,
          items: {
            type: import_genai.Type.OBJECT,
            properties: {
              text: { type: import_genai.Type.STRING },
              priority: { type: import_genai.Type.STRING },
              subtasks: {
                type: import_genai.Type.ARRAY,
                items: { type: import_genai.Type.STRING }
              }
            },
            required: ["text", "priority", "subtasks"]
          }
        }
      }
    );
  }
  async generateDailyDryingNarrative(context) {
    const prompt = `Act as a professional IICRC-certified Water Mitigation Technician. 
    Write a formal Daily Drying Narrative based on the following psychrometric readings and material status logs.
    
    DATA SOURCE:
    - Date: ${context.date || (/* @__PURE__ */ new Date()).toLocaleDateString()}
    - Psychrometric Readings: ${JSON.stringify(context.psychrometricReadings || [])}
    - Tracked Materials & Status: ${JSON.stringify(context.trackedMaterials || [])}
    
    INSTRUCTIONS:
    - Write an analytical summary of the drying progress.
    - Mention significant changes in temperature, relative humidity, or GPP.
    - Highlight material moisture content trends (e.g., reaching dry goals or remaining wet).
    - Note any materials that were removed or changed status.
    - Keep it under 150 words.
    - Use professional, objective language suitable for an insurance claim file.
    - ALL field reports MUST be wrapped in markdown code blocks (\`\`\`).
    - Use plain-text dashes (-) for individual sentences/bullet points to prevent markdown parsers from converting them into standard HTML lists.`;
    return await this.execute("DEEP_REASONING", prompt);
  }
  async generateNarrative(context) {
    const prompt = `Act as a professional IICRC-certified Water Mitigation Technician. Write a formal Daily Project Log based on the following data.
    
    DATA SOURCE:
    - Date: ${(/* @__PURE__ */ new Date()).toLocaleDateString()}
    - Project Status: ${context.currentStage}
    - Equipment Active: ${context.equipment?.length || 0} units
    - Recent Readings (Last 24h): ${JSON.stringify(context.readings?.slice(-2))}
    - New Photos Taken: ${context.newPhotosCount || 0}
    - Compliance Issues: ${context.complianceIssues || "None"}
    
    INSTRUCTIONS:
    - Write in past tense, professional tone.
    - Mention specific atmospheric changes if readings are available.
    - Mention equipment manipulation.
    - Mention safety checks.
    - Keep it under 100 words.
    - ALL field reports MUST be wrapped in markdown code blocks (\`\`\`).
    - Use plain-text dashes (-) for individual sentences/bullet points to prevent markdown parsers from converting them into standard HTML lists.
    `;
    return await this.execute("DEEP_REASONING", prompt);
  }
  async generateComprehensiveReport(reportType, projectContext, imagesBase64) {
    const prompt = `Act as an expert IICRC-certified Water Mitigation Estimator and Technician.
    Generate a highly professional, comprehensive, and client-ready report for a water mitigation project.
    
    Report Type: ${reportType.toUpperCase()}
    
    Project Context Data: 
    ${JSON.stringify(projectContext)}
    
    INSTRUCTIONS:
    - Use Markdown formatting with clear headings, bullet points, and tables where appropriate.
    - If the report type is 'daily', focus on the work in progress, daily readings, equipment status, and next steps.
    - If the report type is 'final', include sections for initial conditions, work performed throughout the project duration, final structural materials status (completion status), and sign-off.
    - If the report type is 'insurance', focus on the claim details, justification of the scope of work (mitigation steps taken), estimated costs/line items, and compliance verification (IICRC standards).
    - If the report type is 'assessment', focus on the initial damage assessment. You MUST include explicit sections for: Cause of Damage, Affected Materials, and Initial Mitigation Steps Taken. Base this on the provided project context, photos context, and initial conditions.
    - If the report type is 'psychrometric', focus on psychrometric drying conditions, atmospheric data, grain depression, and material drying curves. You MUST include structured sections detailing: 
      1. Atmospheric Drying Status: Analyze trends in Temp, RH, Dew Point, Vapor Pressure, and Enthalpy.
      2. Ggrains Per Pound (GPP) Analysis: Explain grain depression (comparing unaffected areas, affected drying chambers, and outdoor air) to demonstrate that drying is scientifically happening in compliance with the IICRC S500 standard.
      3. Structural Material Moisture: Evaluate Moisture Content (MC%) trends of affected substrates (e.g. wood, drywall, concrete) against dry standards.
      4. Professional Assessment: Confirm whether the active drying trajectory complies with S500 performance guidelines.
    - Ensure a professional, objective, and authoritative tone suitable for clients and insurance adjusters.
    - DO NOT include placeholder text for the user to fill in if data is available in the context. Substitute missing data gracefully.
    - Start the report directly with the title heading (e.g. # Psychrometric & Drying Progress Report).`;
    const contents = [{ text: prompt }];
    if (imagesBase64 && imagesBase64.length > 0) {
      imagesBase64.forEach((img) => {
        contents.push({ inlineData: { mimeType: "image/jpeg", data: img.split(",")[1] || img } });
      });
    }
    return await this.execute("DEEP_REASONING", { parts: contents });
  }
  async analyzeWaterDamageImage(imageBase64, aiLearnings = []) {
    const prompt = `Analyze this image from a water mitigation site.
    
    INSTRUCTIONS:
    1. Identify the type of water damage if possible (e.g., Category 1 (Clean), Category 2 (Grey), Category 3 (Black)).
    2. Estimate the affected area and list visible damaged materials.
    3. Suggest initial mitigation steps based on industry best practices (IICRC S500).
    4. Also extract any moisture meter readings if visible.
    5. Terminology Rule: If there are visible signs of organic issues or growth, use the terminology "microbial growth" rather than "mold" in your insights and recommendations, unless referring to certified mold testing.
    
    USER FEEDBACK / LEARNINGS:
    The user has provided the following past corrections for your reference:
    ${JSON.stringify(aiLearnings)}
    
    CRITICAL RULE FOR APPLYING LEARNINGS:
    You may adapt your naming conventions, style, and subjective identifications based on the user's feedback. HOWEVER, you must strictly ignore ANY user adjustments or learnings if they violate, contradict, or loosen IICRC (S500/S520), OSHA, EPA, or insurance compliant regulations. Adherence to these professional safety and mitigation regulations is absolute and supersedes any user preference.
    
    Return JSON format EXACTLY matching the provided schema.`;
    return await this.execute(
      "VISION_ANALYSIS",
      { parts: [
        { inlineData: { mimeType: "image/jpeg", data: imageBase64 } },
        { text: prompt }
      ] },
      {
        responseMimeType: "application/json",
        responseSchema: {
          type: import_genai.Type.OBJECT,
          properties: {
            waterCategory: { type: import_genai.Type.STRING, description: "E.g., Category 1, 2, or 3" },
            affectedAreaEstimate: { type: import_genai.Type.STRING, description: "Estimated square footage or description of affected area extent" },
            damagedMaterials: { type: import_genai.Type.ARRAY, items: { type: import_genai.Type.STRING } },
            mitigationSteps: { type: import_genai.Type.ARRAY, items: { type: import_genai.Type.STRING } },
            meterReading: { type: import_genai.Type.STRING },
            tags: { type: import_genai.Type.ARRAY, items: { type: import_genai.Type.STRING } },
            insight: { type: import_genai.Type.STRING, description: "A concise summary of the damage and findings" }
          }
        }
      }
    );
  }
  async generateVideo(prompt, image) {
    const model = this.pickBestModel("VIDEO_GENERATION");
    const payload = {
      model,
      prompt,
      config: { numberOfVideos: 1, resolution: "720p", aspectRatio: "16:9" }
    };
    if (image) {
      payload.image = { imageBytes: image.split(",")[1], mimeType: "image/png" };
    }
    return await this.ai.models.generateVideos(payload);
  }
  getOperationsClient() {
    return this.ai.operations;
  }
};

// server.ts
var import_genai2 = require("@google/genai");
var admin = __toESM(require("firebase-admin"), 1);
var import_storage = require("@google-cloud/storage");
var import_node_stream = require("node:stream");
var mockProjectsStore = [
  {
    id: "P-1001",
    companyId: "default-company",
    client: "Sarah Johnson",
    clientEmail: "s.johnson@example.com",
    clientPhone: "555-123-4567",
    address: "124 Maple Ave",
    status: "Active",
    currentStage: "Monitor",
    progress: 65,
    estimate: "Oct 16",
    logs: "GPP trending down steadily.",
    insurance: "State Farm",
    policyNumber: "SF-987654321",
    adjuster: "Tom Brown",
    claimNumber: "CLM-778899",
    startDate: "Oct 12, 2023",
    summary: "Class 3 Water Loss. Overhead pipe burst affecting kitchen and living room.",
    riskLevel: "high",
    waterCategory: "CAT_3",
    lossClass: "CLASS_3",
    budget: 15e3,
    assignedTeam: ["Mike R.", "Jessica P."],
    equipment: [
      { id: "AM-4022", type: "Air Mover", model: "Phoenix AirMax", status: "Running", hours: 42.5, room: "Living Room" },
      { id: "DH-1102", type: "Dehumidifier", model: "LGR 3500i", status: "Running", hours: 42.5, room: "Living Room" }
    ],
    rooms: [
      {
        id: "r1",
        name: "Living Room",
        status: "drying",
        dimensions: { length: 15.2, width: 20.1, height: 8 },
        photos: [],
        readings: [
          { timestamp: Date.now() - 864e5, temp: 72, rh: 85, gpp: 98, mc: 45 },
          { timestamp: Date.now(), temp: 78, rh: 45, gpp: 62, mc: 28 }
        ]
      }
    ],
    dryingMonitor: [
      {
        id: "tm-1",
        name: 'Drywall 5/8"',
        location: "East Wall (Living Room)",
        type: 'Drywall 5/8"',
        dryGoal: 10,
        initialReading: 99,
        readings: [
          { timestamp: Date.now() - 1728e5, value: 99, dateStr: "Oct 12" },
          { timestamp: Date.now() - 864e5, value: 45, dateStr: "Oct 13" },
          { timestamp: Date.now(), value: 28, dateStr: "Oct 14" }
        ],
        status: "Wet"
      }
    ],
    milestones: [],
    tasks: [
      { id: "t1", text: "Extract standing water", isCompleted: true, priority: "high", dueDate: "2026-02-25" },
      { id: "t2", text: "Set up dehumidifiers", isCompleted: false, priority: "high", dueDate: "2026-02-24" }
    ],
    lineItems: [
      { id: "li1", description: "Emergency Water Extraction", quantity: 4, rate: 250, total: 1e3 }
    ],
    totalCost: 1450,
    invoiceStatus: "Draft"
  }
];
var mockUsersStore = [
  {
    id: `local-admin`,
    email: "admin@restorationai.com",
    name: "Local Admin",
    role: "SuperAdmin",
    companyId: "default-company",
    permissions: ["manage_users", "view_billing", "manage_billing", "view_projects", "edit_projects", "view_admin", "use_ai_tools", "manage_company"]
  }
];
var mockCompaniesStore = [
  { id: "default-company", name: "Elite Restoration Services", subscriptionPlan: "Enterprise", maxUsers: 50, isActive: true }
];
var mockInventoryStore = [
  { id: "inv-1", type: "Dehumidifier", model: "Dri-Eaz Revolution LGR", status: "available" }
];
var MockFirestore = class {
  constructor() {
    this.store = {
      projects: mockProjectsStore,
      users: mockUsersStore,
      companies: mockCompaniesStore,
      inventory: mockInventoryStore
    };
  }
  collection(name) {
    const list = this.store[name] || [];
    class MockQuery {
      constructor() {
        this.filteredList = [...list];
      }
      where(field, op, val) {
        if (op === "==") {
          this.filteredList = this.filteredList.filter((item) => item[field] === val);
        }
        return this;
      }
      limit(n) {
        this.filteredList = this.filteredList.slice(0, n);
        return this;
      }
      async get() {
        return {
          empty: this.filteredList.length === 0,
          docs: this.filteredList.map((item) => ({
            id: String(item.id || ""),
            exists: true,
            data: () => item
          }))
        };
      }
    }
    class MockDocRef {
      constructor(id) {
        this.id = id;
      }
      async get() {
        const item = list.find((x) => String(x.id || "") === this.id);
        return {
          id: this.id,
          exists: !!item,
          data: () => item || null
        };
      }
      async set(data) {
        const index = list.findIndex((x) => String(x.id || "") === this.id);
        const item = { id: this.id, ...data };
        if (index > -1) {
          list[index] = item;
        } else {
          list.push(item);
        }
      }
      async update(data) {
        const index = list.findIndex((x) => String(x.id || "") === this.id);
        if (index > -1) {
          list[index] = { ...list[index], ...data };
        } else {
          throw new Error(`Document ${this.id} not found for update`);
        }
      }
    }
    return {
      doc(id) {
        return new MockDocRef(id);
      },
      where(field, op, val) {
        return new MockQuery().where(field, op, val);
      },
      limit(n) {
        return new MockQuery().limit(n);
      },
      async get() {
        return new MockQuery().get();
      }
    };
  }
};
try {
  if (!admin.apps.length) {
    admin.initializeApp();
  }
} catch (_err) {
  console.warn("Could not auto-initialize Firebase Admin SDK. Web application continuing using robust memory-fallback mode.");
}
var mockDb = new MockFirestore();
var realDbInstance = null;
var useFallbackDb = false;
try {
  realDbInstance = admin.apps.length ? admin.firestore() : null;
} catch (_err) {
  console.warn("Could not retrieve FireStore instance from initialized Firebase App. Resorting to local emulator/memory database.");
  useFallbackDb = true;
}
var db = new Proxy({}, {
  get(_target, prop) {
    if (prop === "collection") {
      return function(...args) {
        const collectionName = String(args[0] || "");
        return new Proxy({}, {
          get(_cTarget, cProp) {
            return function(...cArgs) {
              if (useFallbackDb) {
                const mockCollection = mockDb.collection(collectionName);
                const val2 = mockCollection[String(cProp)];
                return typeof val2 === "function" ? val2(...cArgs) : val2;
              }
              try {
                if (!realDbInstance) {
                  throw new Error("No real database instance of firestore available.");
                }
                const realCollection = realDbInstance.collection(collectionName);
                const realVal = realCollection[String(cProp)];
                if (typeof realVal === "function") {
                  const result = realVal(...cArgs);
                  if (result && typeof result === "object") {
                    return wrapChainObject(result, collectionName, [cProp, cArgs]);
                  }
                  return result;
                }
                return realVal;
              } catch (err) {
                console.warn(`Firestore collection error, fallback triggered for collection: ${collectionName}`, err);
                useFallbackDb = true;
                const mockCollection = mockDb.collection(collectionName);
                const val2 = mockCollection[String(cProp)];
                return typeof val2 === "function" ? val2(...cArgs) : val2;
              }
            };
          }
        });
      };
    }
    const activeDb = useFallbackDb ? mockDb : realDbInstance || mockDb;
    const val = activeDb[String(prop)];
    if (typeof val === "function") {
      return val.bind(activeDb);
    }
    return val;
  }
});
function wrapChainObject(obj, collectionName, lastStep) {
  return new Proxy(obj, {
    get(target, prop) {
      if (prop === "catch" || prop === "then") {
        const val2 = target[String(prop)];
        return typeof val2 === "function" ? val2.bind(target) : val2;
      }
      const val = target[String(prop)];
      if (typeof val === "function") {
        return function(...args) {
          if (useFallbackDb) {
            const mockCollection = mockDb.collection(collectionName);
            let current = mockCollection;
            if (lastStep && typeof mockCollection[String(lastStep[0])] === "function") {
              const prevFunc = mockCollection[String(lastStep[0])];
              current = prevFunc(...lastStep[1]);
            }
            const mockFunc = current[String(prop)];
            return typeof mockFunc === "function" ? mockFunc(...args) : mockFunc;
          }
          try {
            const result = val(...args);
            if (result instanceof Promise) {
              return result.catch((err) => {
                console.warn(`Async Firestore database operation failed, falling back: ${String(err)}`);
                useFallbackDb = true;
                const mockCollection = mockDb.collection(collectionName);
                let current = mockCollection;
                if (lastStep && typeof mockCollection[String(lastStep[0])] === "function") {
                  const prevFunc = mockCollection[String(lastStep[0])];
                  current = prevFunc(...lastStep[1]);
                }
                const mockFunc = current[String(prop)];
                if (typeof mockFunc === "function") {
                  return mockFunc(...args);
                }
                return mockFunc;
              });
            }
            if (result && typeof result === "object") {
              return wrapChainObject(result, collectionName, [prop, args]);
            }
            return result;
          } catch (err) {
            console.warn(`Firestore database operation failed synchronously, falling back: ${String(err)}`);
            useFallbackDb = true;
            const mockCollection = mockDb.collection(collectionName);
            let current = mockCollection;
            if (lastStep && typeof mockCollection[String(lastStep[0])] === "function") {
              const prevFunc = mockCollection[String(lastStep[0])];
              current = prevFunc(...lastStep[1]);
            }
            const mockFunc = current[String(prop)];
            return typeof mockFunc === "function" ? mockFunc(...args) : mockFunc;
          }
        };
      }
      return val;
    }
  });
}
var storageInstance = null;
var bucketInstance = null;
var bucketName = process.env.GCS_BUCKET_NAME || "restorationai-uploads-bucket";
try {
  storageInstance = new import_storage.Storage();
  bucketInstance = storageInstance.bucket(bucketName);
} catch (_err) {
  console.warn("Storage SDK failed to initialize at startup. Web application launching using GCS test fallback wrapper.");
  bucketInstance = {
    file: (_name) => ({
      createWriteStream: (_options) => {
        const stream = new import_node_stream.Writable();
        setTimeout(() => stream.emit("error", new Error("Google Cloud Storage not configured on current environment")), 50);
        return stream;
      }
    })
  };
}
var bucket = bucketInstance;
var gcsStorage = {
  _handleFile(req, file, cb) {
    const filename = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const gcFile = bucket.file(filename);
    const stream = gcFile.createWriteStream({
      resumable: false,
      contentType: file.mimetype
    });
    file.stream.pipe(stream);
    stream.on("error", cb);
    stream.on("finish", () => {
      cb(null, {
        path: `https://storage.googleapis.com/${bucketName}/${filename}`,
        size: Number(gcFile.metadata?.size || 0)
      });
    });
  },
  _removeFile(req, file, cb) {
    cb(null);
  }
};
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = Number(process.env.PORT) || 3e3;
  const isProd = process.env.NODE_ENV === "production";
  const DIST_DIR = import_node_path.default.resolve(process.cwd(), "dist");
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(import_express.default.json({ limit: "10mb" }));
  app.use(import_express.default.urlencoded({ extended: true, limit: "10mb" }));
  app.use(
    (0, import_cors.default)({
      origin: process.env.CORS_ORIGIN?.split(",").map((s) => s.trim()) || true,
      credentials: true
    })
  );
  const apiLimiter = (0, import_express_rate_limit.rateLimit)({
    windowMs: 6e4,
    // 1 minute
    limit: 120,
    // 120 requests / minute / IP
    standardHeaders: "draft-7",
    legacyHeaders: false
  });
  const upload = (0, import_multer.default)({
    storage: gcsStorage,
    limits: { fileSize: 200 * 1024 * 1024 }
    // 200 MB
  });
  app.get("/healthz", (_req, res) => {
    res.status(200).json({ status: "ok", uptime: process.uptime() });
  });
  app.get("/readyz", (_req, res) => {
    res.status(200).json({ status: "ready" });
  });
  const api = import_express.default.Router();
  api.use(apiLimiter);
  api.get("/version", (_req, res) => {
    res.json({
      name: "restorationai",
      commit: process.env.K_REVISION || process.env.COMMIT_SHA || "unknown"
    });
  });
  api.get("/projects", async (req, res) => {
    try {
      let query = db.collection("projects");
      if (req.query.companyId) {
        query = query.where("companyId", "==", req.query.companyId);
      }
      const snapshot = await query.get();
      const projects = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      res.json(projects);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });
  api.get("/projects/:id", async (req, res) => {
    try {
      const doc = await db.collection("projects").doc(req.params.id).get();
      if (!doc.exists) return res.status(404).json({ error: "Project not found" });
      res.json({ id: doc.id, ...doc.data() });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });
  api.post("/projects", async (req, res) => {
    try {
      const newProject = {
        id: `proj-${Date.now()}`,
        ...req.body,
        rooms: req.body.rooms || [],
        milestones: req.body.milestones || [],
        tasks: req.body.tasks || [],
        lineItems: req.body.lineItems || [],
        roomScans: req.body.roomScans || [],
        videos: req.body.videos || [],
        equipment: req.body.equipment || [],
        dailyNarratives: req.body.dailyNarratives || [],
        dryingMonitor: req.body.dryingMonitor || []
      };
      await db.collection("projects").doc(newProject.id).set(newProject);
      res.status(201).json(newProject);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });
  api.patch("/projects/:id", async (req, res) => {
    try {
      const projectRef = db.collection("projects").doc(req.params.id);
      const doc = await projectRef.get();
      if (!doc.exists) return res.status(404).json({ error: "Project not found" });
      await projectRef.update(req.body);
      const updatedDoc = await projectRef.get();
      res.json({ id: updatedDoc.id, ...updatedDoc.data() });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });
  api.get("/companies", async (_req, res) => {
    try {
      const snapshot = await db.collection("companies").get();
      res.json(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });
  api.get("/companies/:id/users", async (req, res) => {
    try {
      const snapshot = await db.collection("users").where("companyId", "==", req.params.id).get();
      res.json(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });
  api.post("/users", async (req, res) => {
    try {
      const newUser = { id: `user-${Date.now()}`, ...req.body };
      await db.collection("users").doc(newUser.id).set(newUser);
      res.status(201).json(newUser);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });
  api.get("/inventory", async (_req, res) => {
    try {
      const snapshot = await db.collection("inventory").get();
      res.json(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });
  api.post("/inventory", async (req, res) => {
    try {
      const newItem = { id: `inv-${Date.now()}`, ...req.body };
      await db.collection("inventory").doc(newItem.id).set(newItem);
      res.status(201).json(newItem);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });
  api.post("/ai/weather-alerts", async (req, res) => {
    const { address } = req.body;
    if (!address) {
      return res.status(400).json({ error: "Address is required." });
    }
    try {
      const ai = new import_genai2.GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build"
          }
        }
      });
      const prompt = `You are a weather intelligence assistant. Search the web for any active severe weather alerts, warnings, advisories, or watches for the location/address: "${address}".
Search specifically for local severe weather warnings (such as floods, high winds, wildfires, storms, extreme temperature, lightning) from official meteorological services (e.g., National Weather Service in the US, or equivalent local authorities).
If there are no severe weather warnings or alerts, set hasAlerts to false and leave the alerts array empty.
Return a structured JSON response.`;
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          responseSchema: {
            type: import_genai2.Type.OBJECT,
            properties: {
              hasAlerts: { type: import_genai2.Type.BOOLEAN },
              alerts: {
                type: import_genai2.Type.ARRAY,
                items: {
                  type: import_genai2.Type.OBJECT,
                  properties: {
                    severity: { type: import_genai2.Type.STRING, description: "Must be 'info', 'warning', or 'danger'" },
                    title: { type: import_genai2.Type.STRING, description: "Title of the alert" },
                    description: { type: import_genai2.Type.STRING, description: "Full details or description of the alert" },
                    ends: { type: import_genai2.Type.STRING, description: "When the alert expires, or 'Unknown'" }
                  },
                  required: ["severity", "title", "description", "ends"]
                }
              },
              summary: { type: import_genai2.Type.STRING, description: "A concise summary paragraph of the weather threat level" }
            },
            required: ["hasAlerts", "alerts", "summary"]
          }
        }
      });
      let text = response.text || "{}";
      if (text.startsWith("```")) {
        text = text.replace(/```json/g, "").replace(/```/g, "").trim();
      }
      const result = JSON.parse(text);
      const citations = [];
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (chunks) {
        for (const chunk of chunks) {
          if (chunk.web?.uri) {
            citations.push({
              title: chunk.web.title || "Source",
              url: chunk.web.uri
            });
          }
        }
      }
      res.json({
        ...result,
        citations
      });
    } catch (error) {
      console.error("Error fetching weather alerts with search grounding:", error);
      res.status(500).json({ error: String(error) });
    }
  });
  api.post("/ai/intent", async (req, res) => {
    const { userInput, projectContext } = req.body;
    const aiRouter = new IntelligenceRouter();
    try {
      const aiResponse = await aiRouter.parseFieldIntent(userInput, projectContext);
      const text = aiResponse.response.text();
      res.json(JSON.parse(text));
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });
  api.post("/ai/narrative", async (req, res) => {
    const aiRouter = new IntelligenceRouter();
    try {
      const aiResponse = await aiRouter.generateNarrative(req.body);
      res.json({ narrative: aiResponse.response.text() });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });
  api.post("/ai/drying-narrative", async (req, res) => {
    const aiRouter = new IntelligenceRouter();
    try {
      const aiResponse = await aiRouter.generateDailyDryingNarrative(req.body);
      res.json({ narrative: aiResponse.response.text() });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });
  api.post("/ai/process-scan", async (req, res) => {
    const { capturedImages } = req.body;
    if (!capturedImages || !Array.isArray(capturedImages)) {
      return res.status(400).json({ error: "capturedImages array is required." });
    }
    try {
      const ai = new import_genai2.GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const imageParts = capturedImages.map((img) => ({ inlineData: { mimeType: "image/jpeg", data: img.base64 } }));
      const baseTextPart = { text: `You are an expert restoration estimator. Analyze these images of a room scan to extract key structural and material information.
    1. Estimate the room dimensions (length, width in feet). Provide a logical label for the room (e.g. Master Bedroom, Kitchen).
    2. Identify the materials used in the room (flooring, walls, trim).
    3. Provide a brief assessment of any water/mold damage visible, or general condition.` };
      const baseResponse = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: { parts: [baseTextPart, ...imageParts] },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: import_genai2.Type.OBJECT,
            properties: {
              length: { type: import_genai2.Type.NUMBER },
              width: { type: import_genai2.Type.NUMBER },
              roomLabel: { type: import_genai2.Type.STRING },
              damageAssessment: { type: import_genai2.Type.STRING },
              materials: {
                type: import_genai2.Type.OBJECT,
                properties: {
                  flooring_system: {
                    type: import_genai2.Type.OBJECT,
                    properties: {
                      material_category: { type: import_genai2.Type.STRING },
                      grade_estimation: { type: import_genai2.Type.STRING }
                    }
                  },
                  wall_system: {
                    type: import_genai2.Type.OBJECT,
                    properties: {
                      substrate_material: { type: import_genai2.Type.STRING },
                      finish_type: { type: import_genai2.Type.STRING }
                    }
                  },
                  trim_and_millwork: {
                    type: import_genai2.Type.OBJECT,
                    properties: {
                      baseboard_material: { type: import_genai2.Type.STRING },
                      height_inches: { type: import_genai2.Type.NUMBER }
                    }
                  }
                }
              }
            },
            required: ["length", "width", "roomLabel", "damageAssessment", "materials"]
          }
        }
      });
      let baseText = baseResponse.text || "{}";
      if (baseText.startsWith("```")) {
        baseText = baseText.replace(/```json/g, "").replace(/```/g, "").trim();
      }
      const baseResult = JSON.parse(baseText);
      const svgTextPart = { text: `You are an AR spatial mapping assistant. Given the following room details and the visual frames, generate a top-down 2D SVG floor plan (viewBox="0 0 100 100").
    Make it clean, use <rect>, <line>, <path>. Include doors/windows if visible.
    
    Room Details:
    Label: ${baseResult.roomLabel}
    Dimensions: ${baseResult.length}ft x ${baseResult.width}ft
    Damage: ${baseResult.damageAssessment}
    
    Output your response as JSON with a single "floorPlanSvg" string field containing the raw SVG code.` };
      const svgResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: { parts: [svgTextPart, ...imageParts] },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: import_genai2.Type.OBJECT,
            properties: {
              floorPlanSvg: { type: import_genai2.Type.STRING }
            },
            required: ["floorPlanSvg"]
          }
        }
      });
      let svgText = svgResponse.text || "{}";
      if (svgText.startsWith("```")) {
        svgText = svgText.replace(/```json/g, "").replace(/```/g, "").trim();
      }
      const svgResult = JSON.parse(svgText);
      res.json({
        baseResult,
        svgResult
      });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });
  api.post("/login", async (_req, res) => {
    try {
      const snapshot = await db.collection("users").limit(1).get();
      let user = null;
      if (!snapshot.empty) {
        user = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
      } else {
        user = {
          id: `local-admin`,
          email: "admin@restorationai.com",
          name: "Local Admin",
          role: "SuperAdmin",
          companyId: "default-company",
          permissions: ["manage_users", "view_billing", "manage_billing", "view_projects", "edit_projects", "view_admin", "use_ai_tools", "manage_company"]
        };
        await db.collection("users").doc(user.id).set(user);
      }
      res.json({ user });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });
  api.get("/me", async (_req, res) => {
    try {
      const snapshot = await db.collection("users").limit(1).get();
      if (!snapshot.empty) {
        res.json({ authenticated: true, user: { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } });
      } else {
        res.json({ authenticated: false });
      }
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });
  api.post("/upload", upload.single("file"), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "file field is required" });
    }
    res.json({
      received: req.file.originalname,
      bytes: req.file.size,
      mimetype: req.file.mimetype,
      url: req.file.path
      // GCS URL from custom storage
    });
  });
  app.use("/api", api);
  if (!isProd) {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    app.use(
      import_express.default.static(DIST_DIR, {
        index: false,
        maxAge: "1d"
      })
    );
    app.get(/^(?!\/api\/).*/, (_req, res, next) => {
      res.sendFile(import_node_path.default.join(DIST_DIR, "index.html"), (err) => {
        if (err) next(err);
      });
    });
  }
  app.use((err, _req, res, _next) => {
    console.error("[server] unhandled error", err);
    const message = err instanceof Error ? err.message : "internal server error";
    res.status(500).json({ error: message });
  });
  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`[server] listening on :${PORT} (${isProd ? "production" : "development"})`);
  });
  const shutdown = (signal) => {
    console.log(`[server] received ${signal}, shutting down`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 1e4).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}
startServer();
//# sourceMappingURL=server.cjs.map
