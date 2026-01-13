import fs from "fs";
import path from "path";

interface ThirdPartyResult {
  qid: string;
  query: string;
  source: string;
  speed: number;
  result: string;
}

interface Question {
  qid: string;
  query: string;
  level: number;
  categories: string[];
  tags: string[] | null;
  sectors: string[] | null;
}

interface CacheFormat {
  metadata: {
    cachedAt: string;
    sourceFile: string;
    runId: string;
    system: string;
    qid: string;
    evaluationVersion: string;
  };
  question: Question & { dataset: string };
  agentResult: {
    system: string;
    steps: any[];
    finalAnswer: string;
    executionTimeMs: number;
    stepCount: number;
    toolCalls: any[];
    totalTokens: number;
  };
  config: {
    judgeModel: string;
    rankingMethod: string;
    standardAgentConfig?: any;
    droydAgentConfig?: any;
  };
}

// Parse TypeScript result files to extract data
function parseResultsFile(filePath: string): ThirdPartyResult[] {
  const content = fs.readFileSync(filePath, "utf-8");

  // Extract the array data using regex (simple approach for this specific format)
  const match = content.match(/export const \w+ = (\[[\s\S]*\]);/);

  if (!match) {
    console.error(`Failed to parse ${filePath}`);
    return [];
  }

  // Use eval to parse the array (safe in this controlled context)
  // Replace template literals with proper strings
  const arrayStr = match[1];
  const results = eval(arrayStr);

  return results;
}

// Load all dataset files to build question metadata map
function loadQuestionMetadata(): Map<string, Question & { dataset: string }> {
  const questionMap = new Map<string, Question & { dataset: string }>();
  const datasetDir = path.join(__dirname, "../datasets/agent");
  const datasetFiles = [
    "assetDiscovery.json",
    "assetEvaluation.json",
    "projectFundamentals.json",
    "trendAnalysis.json",
    "trendDiscovery.json",
    "trendEvalution.json",
  ];

  for (const file of datasetFiles) {
    const filePath = path.join(datasetDir, file);
    if (fs.existsSync(filePath)) {
      const datasetName = path.basename(file, ".json");
      const questions = JSON.parse(fs.readFileSync(filePath, "utf-8"));

      for (const question of questions) {
        questionMap.set(question.qid, { ...question, dataset: datasetName });
      }
    }
  }

  return questionMap;
}

// Convert a third-party result to cache format
function convertToCache(
  result: ThirdPartyResult,
  questionMetadata: Question & { dataset: string },
  runDate: string
): CacheFormat {
  const timestamp = new Date(runDate).toISOString();

  return {
    metadata: {
      cachedAt: timestamp,
      sourceFile: "third-party-conversion",
      runId: timestamp,
      system: result.source,
      qid: result.qid,
      evaluationVersion: "v2",
    },
    question: questionMetadata,
    agentResult: {
      system: result.source,
      steps: [],
      finalAnswer: result.result,
      executionTimeMs: 0,
      stepCount: 0,
      toolCalls: [],
      totalTokens: 0,
    },
    config: {
      judgeModel: "gemini-3-flash",
      rankingMethod: "elo",
    },
  };
}

// Main conversion function
async function convertThirdPartyResults() {
  const runDate = "2026-01-13";
  const questionMetadata = loadQuestionMetadata();
  const outputBaseDir = path.join(
    __dirname,
    "../datasets/_results/agent/response_cache"
  );

  // Ensure base cache directory exists
  if (!fs.existsSync(outputBaseDir)) {
    fs.mkdirSync(outputBaseDir, { recursive: true });
  }

  // Process each third-party source
  const thirdPartyDir = path.join(
    __dirname,
    "../datasets/_results/agent/third_party_results"
  );

  const sources = [
    {
      results: parseResultsFile(path.join(thirdPartyDir, "surf/surf-quick.ts")),
      name: "surf-quick",
    },
    {
      results: parseResultsFile(path.join(thirdPartyDir, "elfa/elfa-fast.ts")),
      name: "elfa-fast",
    },
    {
      results: parseResultsFile(path.join(thirdPartyDir, "elfa/elfa-expert.ts")),
      name: "elfa-expert",
    },
    {
      results: parseResultsFile(
        path.join(thirdPartyDir, "messari/messari-assistant.ts")
      ),
      name: "messari-assistant",
    },
  ];

  for (const source of sources) {
    console.log(`\nProcessing ${source.name}...`);

    // Create provider directory
    const providerDir = path.join(outputBaseDir, source.name);
    if (!fs.existsSync(providerDir)) {
      fs.mkdirSync(providerDir, { recursive: true });
    }

    // Convert each result
    let converted = 0;
    let skipped = 0;

    for (const result of source.results) {
      const metadata = questionMetadata.get(result.qid);

      if (!metadata) {
        console.warn(
          `  ⚠️  No metadata found for qid: ${result.qid} - skipping`
        );
        skipped++;
        continue;
      }

      const cacheData = convertToCache(result, metadata, runDate);
      const outputPath = path.join(providerDir, `${result.qid}.json`);

      fs.writeFileSync(outputPath, JSON.stringify(cacheData, null, 2));
      converted++;
    }

    console.log(
      `  ✓ Converted ${converted} results, skipped ${skipped}`
    );
  }

  console.log("\n✓ Conversion complete!");
}

// Run the conversion
convertThirdPartyResults().catch(console.error);
