
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";

export type TaskComplexity = 
  | 'FAST_ANALYSIS'      
  | 'DEEP_REASONING'     
  | 'VISION_ANALYSIS'    
  | 'CREATIVE_EDIT'      
  | 'VIDEO_GENERATION'   
  | 'LOCATION_SERVICES'; 

interface RouterConfig {
  systemInstruction?: string;
  responseMimeType?: string;
  responseSchema?: unknown;
  tools?: unknown[];
  imageConfig?: unknown;
  toolConfig?: unknown;
  thinkingBudget?: number;
}

export class IntelligenceRouter {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }

  private pickBestModel(complexity: TaskComplexity): string {
    switch (complexity) {
      case 'FAST_ANALYSIS': return 'gemini-3-flash-preview';
      case 'DEEP_REASONING': return 'gemini-3-pro-preview';
      case 'VISION_ANALYSIS': return 'gemini-3-pro-image-preview';
      case 'CREATIVE_EDIT': return 'gemini-2.5-flash-image';
      case 'VIDEO_GENERATION': return 'veo-3.1-fast-generate-preview';
      case 'LOCATION_SERVICES': return 'gemini-2.5-flash'; 
      default: return 'gemini-3-flash-preview';
    }
  }

  async execute(complexity: TaskComplexity, contents: unknown, config: RouterConfig = {}): Promise<GenerateContentResponse> {
    const model = this.pickBestModel(complexity);
    
    if (complexity === 'VIDEO_GENERATION') {
        throw new Error("Video generation requires specific operation handling via generateVideo method.");
    }

    const generationConfig: Record<string, unknown> = {
        systemInstruction: config.systemInstruction,
        responseMimeType: config.responseMimeType,
        responseSchema: config.responseSchema,
        tools: config.tools,
        toolConfig: config.toolConfig,
        imageConfig: config.imageConfig,
    };

    if (config.thinkingBudget && (model === 'gemini-3-pro-preview' || model === 'gemini-3-pro-image-preview')) {
        generationConfig.thinkingConfig = { thinkingBudget: config.thinkingBudget };
    }
    
    return await this.ai.models.generateContent({
      model,
      contents: typeof contents === 'string' ? { parts: [{ text: contents }] } : contents,
      config: generationConfig
    });
  }

  async parseFieldIntent(userInput: string, projectContext: unknown): Promise<GenerateContentResponse> {
      return await this.execute('FAST_ANALYSIS', 
        `You are a restoration AI assistant. Analyze this field technician's input: "${userInput}". 
         Context: ${JSON.stringify(projectContext)}.
         Categorize the input into: 'Psychrometrics', 'Equipment', 'Safety', or 'General'.
         Extract structured data if possible (e.g. temp, rh, count).
         Provide a clean, professional summary sentence.`,
        {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    category: { type: Type.STRING, enum: ['Psychrometrics', 'Equipment', 'Safety', 'General'] },
                    structuredData: { type: Type.OBJECT, description: "Any extracted numbers or entities" },
                    summary: { type: Type.STRING, description: "A polished log entry string" },
                    action: { type: Type.STRING, description: "Suggested system action ID if applicable" }
                }
            }
        }
      );
  }

  async generateScope(projectContext: string): Promise<GenerateContentResponse> {
    return await this.execute('DEEP_REASONING', 
        `Generate a professional mitigation scope (Xactimate style) based on this data: ${projectContext}. 
        You must include appropriate line items for Water Extraction, Demolition (e.g. drywall, flooring), and Equipment Setup/Monitoring (e.g. air movers, dehumidifiers) based on typical project requirements for the given Category and Class.
        Return an array of line items with: code, description, quantity, unit (LF, SF, EA), and rate.`,
        {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    lineItems: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                code: { type: Type.STRING },
                                description: { type: Type.STRING },
                                quantity: { type: Type.NUMBER },
                                unit: { type: Type.STRING },
                                rate: { type: Type.NUMBER }
                            },
                            required: ['code', 'description', 'quantity', 'unit', 'rate']
                        }
                    },
                    justification: { type: Type.STRING }
                }
            }
        }
    );
  }

  async generateTasks(projectContext: string): Promise<GenerateContentResponse> {
    return await this.execute('DEEP_REASONING', 
        `Based on the following restoration project details, auto-generate a comprehensive list of recommended tasks strictly adhering to IICRC S500 (Water) and IICRC S520 (Mold) standard requirements per room and per material listed. 
        Context: ${projectContext}
        Ensure tasks cover material removal, equipment recommendations, containment (if needed), and daily dry logging requirements. For each overall task, identify 2 to 5 specific, actionable compliance checklist subtasks or verification steps (e.g. particular items from S500/S520 guidance).
        Return the tasks as a JSON array of objects, where each object has a 'text' (string), a 'priority' (string: 'high', 'medium', or 'low'), and 'subtasks' (an array of strings).`,
        {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        text: { type: Type.STRING },
                        priority: { type: Type.STRING },
                        subtasks: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING }
                        }
                    },
                    required: ["text", "priority", "subtasks"]
                }
            }
        }
    );
  }

  async generateDailyDryingNarrative(context: { date?: string; psychrometricReadings?: unknown[]; trackedMaterials?: unknown[] }): Promise<GenerateContentResponse> {
    const prompt = `Act as a professional IICRC-certified Water Mitigation Technician. 
    Write a formal Daily Drying Narrative based on the following psychrometric readings and material status logs.
    
    DATA SOURCE:
    - Date: ${context.date || new Date().toLocaleDateString()}
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

    return await this.execute('DEEP_REASONING', prompt);
  }

  async generateNarrative(context: { currentStage: string; equipment?: unknown[]; readings?: unknown[]; newPhotosCount?: number; complianceIssues?: string }): Promise<GenerateContentResponse> {
    const prompt = `Act as a professional IICRC-certified Water Mitigation Technician. Write a formal Daily Project Log based on the following data.
    
    DATA SOURCE:
    - Date: ${new Date().toLocaleDateString()}
    - Project Status: ${context.currentStage}
    - Equipment Active: ${context.equipment?.length || 0} units
    - Recent Readings (Last 24h): ${JSON.stringify(context.readings?.slice(-2))}
    - New Photos Taken: ${context.newPhotosCount || 0}
    - Compliance Issues: ${context.complianceIssues || 'None'}
    
    INSTRUCTIONS:
    - Write in past tense, professional tone.
    - Mention specific atmospheric changes if readings are available.
    - Mention equipment manipulation.
    - Mention safety checks.
    - Keep it under 100 words.
    - ALL field reports MUST be wrapped in markdown code blocks (\`\`\`).
    - Use plain-text dashes (-) for individual sentences/bullet points to prevent markdown parsers from converting them into standard HTML lists.
    `;

    return await this.execute('DEEP_REASONING', prompt);
  }

  async generateComprehensiveReport(reportType: 'daily' | 'final' | 'insurance' | 'assessment' | 'psychrometric', projectContext: unknown, imagesBase64?: string[]): Promise<GenerateContentResponse> {
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

    const contents: Array<{text?: string; inlineData?: {mimeType: string; data: string}}> = [{ text: prompt }];
    if (imagesBase64 && imagesBase64.length > 0) {
        imagesBase64.forEach(img => {
            contents.push({ inlineData: { mimeType: 'image/jpeg', data: img.split(',')[1] || img } });
        });
    }

    return await this.execute('DEEP_REASONING', { parts: contents });
  }

  async analyzeWaterDamageImage(imageBase64: string, aiLearnings: unknown[] = []): Promise<GenerateContentResponse> {
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

    return await this.execute('VISION_ANALYSIS', 
        { parts: [
            { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } },
            { text: prompt }
        ]},
        { 
            responseMimeType: "application/json", 
            responseSchema: { 
                type: Type.OBJECT, 
                properties: { 
                    waterCategory: { type: Type.STRING, description: "E.g., Category 1, 2, or 3" },
                    affectedAreaEstimate: { type: Type.STRING, description: "Estimated square footage or description of affected area extent" },
                    damagedMaterials: { type: Type.ARRAY, items: { type: Type.STRING } },
                    mitigationSteps: { type: Type.ARRAY, items: { type: Type.STRING } },
                    meterReading: { type: Type.STRING },
                    tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                    insight: { type: Type.STRING, description: "A concise summary of the damage and findings" }
                }
            }
        }
    );
  }

  async generateVideo(prompt: string, image?: string) {
      const model = this.pickBestModel('VIDEO_GENERATION');
      const payload: {
          model: string;
          prompt: string;
          config: { numberOfVideos: number; resolution: '720p' | '1080p'; aspectRatio: '16:9' | '9:16' };
          image?: { imageBytes: string; mimeType: string };
      } = {
          model,
          prompt,
          config: { numberOfVideos: 1, resolution: '720p', aspectRatio: '16:9' }
      };
      if (image) {
          payload.image = { imageBytes: image.split(',')[1], mimeType: 'image/png' };
      }
      return await this.ai.models.generateVideos(payload);
  }

  getOperationsClient() {
      return this.ai.operations;
  }
}
