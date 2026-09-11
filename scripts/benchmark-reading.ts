import fs from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";

import { extractStructuredPdf, extractStructuredText } from "../src/lib/reading/extractors";
import { segmentText } from "../src/lib/reading/text-segmenter";
import { tagSentenceWords } from "../src/lib/reading/pos-tagger";
import { detectPhrasesInSentence } from "../src/lib/reading/phrase-matcher";
import { prefetchDocumentWords, getCachedWord } from "../src/lib/reading/dictionary-cache";
import { analyzeSentence } from "../src/lib/ai/local-ai-client";
import type { ClientAIConfig, SentenceBreakdownResponse } from "../src/types/reading";

const PDF_PATH = "/home/phongha/Downloads/[1] Modern Operating Systems 4th Edition--Andrew Tanenbaum.pdf";
const TXT_PATH = "/home/phongha/Downloads/PART_ONE_VERBATIM.txt";

const AI_CONFIG: ClientAIConfig = {
  provider: "local_tunnel",
  baseUrl: "http://localhost:20128/v1",
  apiKey: "sk-718d821f44fc8b3d-9djgjz-60475e04",
  model: "ag/gemini-3.8-flash-high",
  temperature: 0.1,
  autoAnalyzeOnClick: true,
};

interface BenchmarkReport {
  timestamp: string;
  pdfImport: {
    fileName: string;
    fileSizeMb: number;
    extractTimeMs: number;
    totalPages: number;
    totalChunks: number;
    totalWords: number;
    tocCount: number;
    avgChunkParseTimeMs: number;
  };
  txtImport: {
    fileName: string;
    fileSizeKb: number;
    extractTimeMs: number;
    totalChunks: number;
    totalWords: number;
    tocCount: number;
  };
  hoverLookup: {
    posTaggerAvgMs: number;
    phraseMatcherAvgMs: number;
    dictLookupAvgMs: number;
    testedSentencesCount: number;
  };
  aiAnalysis: Array<{
    scenario: string;
    sentence: string;
    latencyMs: number;
    model: string;
    complexity: string;
    translationVi: string;
    coreIdeaVi: string;
    skeletonPattern: string;
    skeletonPartsCount: number;
    chunksCount: number;
    clausesCount: number;
    vocabCount: number;
    vocabWithIpaCount: number;
    hasGrammarMechanic: boolean;
    mentalModelStepsCount: number;
    schemaValid: boolean;
  }>;
}

async function runBenchmark() {
  console.log("================================================================================");
  console.log("🚀 STARTING VOCABLOOM SMART READING END-TO-END REAL WORLD BENCHMARK");
  console.log("================================================================================\n");

  const report: Partial<BenchmarkReport> = {
    timestamp: new Date().toISOString(),
    aiAnalysis: [],
  };

  // --------------------------------------------------------------------------
  // PHASE 1: IMPORT & PARSING BENCHMARK (REAL FILES)
  // --------------------------------------------------------------------------
  console.log("📂 [PHASE 1] Benchmark Import & Document Parsing...");

  // 1.1 Text Import Benchmark
  try {
    const txtStat = await fs.stat(TXT_PATH);
    const txtBuffer = await fs.readFile(TXT_PATH, "utf-8");
    const t0 = performance.now();
    const txtResult = extractStructuredText(txtBuffer, "PART_ONE_VERBATIM", 10);
    const txtTime = performance.now() - t0;

    report.txtImport = {
      fileName: "PART_ONE_VERBATIM.txt",
      fileSizeKb: Math.round((txtStat.size / 1024) * 100) / 100,
      extractTimeMs: Math.round(txtTime * 100) / 100,
      totalChunks: txtResult.chunks.length,
      totalWords: txtResult.meta.totalWords,
      tocCount: txtResult.meta.toc.length,
    };
    console.log(`  ✓ Text File Import: ${report.txtImport.totalWords} words, ${report.txtImport.totalChunks} chunks in ${report.txtImport.extractTimeMs}ms`);
  } catch (e) {
    console.error("  ✗ Text Import Failed:", e);
  }

  // 1.2 PDF Import Benchmark
  try {
    const pdfStat = await fs.stat(PDF_PATH);
    const pdfBuffer = await fs.readFile(PDF_PATH);
    console.log(`  - Loading PDF: ${path.basename(PDF_PATH)} (${(pdfStat.size / (1024 * 1024)).toFixed(2)} MB)...`);
    
    const t0 = performance.now();
    // Test geometry-aware structured PDF extraction
    const pdfResult = await extractStructuredPdf(pdfBuffer, 10);
    const pdfTime = performance.now() - t0;

    // Benchmark segmenting the first 3 chunks
    const chunkParseTimes: number[] = [];
    for (let i = 0; i < Math.min(3, pdfResult.chunks.length); i++) {
      const ct0 = performance.now();
      segmentText(pdfResult.chunks[i].rawText);
      chunkParseTimes.push(performance.now() - ct0);
    }
    const avgChunkParse = chunkParseTimes.reduce((a, b) => a + b, 0) / chunkParseTimes.length;

    report.pdfImport = {
      fileName: path.basename(PDF_PATH),
      fileSizeMb: Math.round((pdfStat.size / (1024 * 1024)) * 100) / 100,
      extractTimeMs: Math.round(pdfTime * 100) / 100,
      totalPages: pdfResult.meta.totalPages,
      totalChunks: pdfResult.chunks.length,
      totalWords: pdfResult.meta.totalWords,
      tocCount: pdfResult.meta.toc.length,
      avgChunkParseTimeMs: Math.round(avgChunkParse * 100) / 100,
    };
    console.log(`  ✓ PDF Import (Layout & Geometry): ${pdfResult.meta.totalPages} pages, ${pdfResult.meta.totalWords} words, ${pdfResult.meta.toc.length} TOC entries in ${report.pdfImport.extractTimeMs}ms`);
    console.log(`  ✓ Average Chunk Segmentation Time (10 pages): ${report.pdfImport.avgChunkParseTimeMs}ms`);
  } catch (e) {
    console.error("  ✗ PDF Import Failed:", e);
  }

  // --------------------------------------------------------------------------
  // PHASE 2: CLIENT INTERACTIVE LATENCY (HOVER & LOOKUP)
  // --------------------------------------------------------------------------
  console.log("\n⚡ [PHASE 2] Benchmark Client Interactive Latency (Hover & Lookup)...");

  const sampleSentences = [
    "To appreciate the role that an operating system plays in a modern computer, it is useful to consider the physical machine on which software executes.",
    "The CPU executes instructions from memory sequentially unless a jump or branch occurs.",
    "Operating systems provide abstract representations of hardware resources such as processors, memory, and disks.",
    "Multi-threading allows concurrent execution within the same process address space.",
    "A page fault occurs when a program attempts to access a block of memory that is not currently mapped into physical RAM.",
    "Deadlock is a situation in which two or more processes are unable to proceed because each is waiting for the other to release a resource.",
    "Virtual memory creates an illusion of a very large uniform array of storage.",
    "Device drivers encapsulate hardware-specific details and provide a standard interface to the kernel.",
    "Interrupt handlers must execute quickly to avoid delaying critical system events.",
    "File systems organize unstructured byte sequences into human-readable hierarchical directories.",
  ];

  // Repeat to test 100 sentence evaluations
  const testSet = Array.from({ length: 10 }, () => sampleSentences).flat();

  // 2.1 POS Tagging
  const tPos0 = performance.now();
  for (const s of testSet) {
    tagSentenceWords(s);
  }
  const posAvgMs = (performance.now() - tPos0) / testSet.length;

  // 2.2 Phrase Matching
  const tPhrase0 = performance.now();
  for (const s of testSet) {
    const tokens = tagSentenceWords(s);
    detectPhrasesInSentence(s, tokens);
  }
  const phraseAvgMs = (performance.now() - tPhrase0) / testSet.length;

  // 2.3 Dictionary Cache Prefetch & Retrieval
  const allTokens = testSet.flatMap((s) => tagSentenceWords(s).map((t) => t.cleanText).filter(Boolean));
  const tDict0 = performance.now();
  prefetchDocumentWords(allTokens.slice(0, 50), ["operating system", "virtual memory", "page fault"]);
  for (const token of allTokens.slice(0, 50)) {
    getCachedWord(token);
  }
  const dictAvgMs = (performance.now() - tDict0) / 50;

  report.hoverLookup = {
    posTaggerAvgMs: Math.round(posAvgMs * 1000) / 1000,
    phraseMatcherAvgMs: Math.round(phraseAvgMs * 1000) / 1000,
    dictLookupAvgMs: Math.round(dictAvgMs * 1000) / 1000,
    testedSentencesCount: testSet.length,
  };

  console.log(`  ✓ POS Tagging Latency: ${report.hoverLookup.posTaggerAvgMs} ms/sentence`);
  console.log(`  ✓ Phrase Matching Latency: ${report.hoverLookup.phraseMatcherAvgMs} ms/sentence`);
  console.log(`  ✓ Dictionary Cache Lookup Latency: ${report.hoverLookup.dictLookupAvgMs} ms/word`);

  // --------------------------------------------------------------------------
  // PHASE 3: AI SENTENCE ANALYSIS WITH 9ROUTER (LIVE API)
  // --------------------------------------------------------------------------
  console.log("\n🤖 [PHASE 3] Benchmark Live AI Sentence Analysis (9router at localhost:20128)...");

  const aiTestScenarios = [
    {
      scenario: "Scenario 1: Simple & Direct Command/Definition",
      sentence: "An operating system acts as an intermediary between computer users and computer hardware.",
      contextBefore: "Computers are complex electronic devices.",
      contextAfter: "It provides a user-friendly environment to run programs efficiently.",
    },
    {
      scenario: "Scenario 2: Compound Academic Sentence with Contrast",
      contextBefore: "In traditional architectures, processors executed single instructions synchronously.",
      sentence: "Modern superscalar processors, however, can issue multiple independent instructions per clock cycle to maximize throughput.",
      contextAfter: "This mechanism requires sophisticated out-of-order execution logic.",
    },
    {
      scenario: "Scenario 3: Complex OS Concept with Dependent Relative Clauses",
      contextBefore: "When physical memory becomes constrained, the kernel must intervene.",
      sentence: "To appreciate the role that an operating system plays in a modern computer, it is useful to consider the physical machine on which software executes.",
      contextAfter: "Without hardware abstraction, application developers would have to manage raw hardware registers directly.",
    },
    {
      scenario: "Scenario 4: Heavy Technical Engineering Sentence with Collocations",
      contextBefore: "Deep learning models require billions of floating-point operations.",
      sentence: "Deploying these complex virtual memory architectures on resource-constrained embedded systems, however, presents substantial engineering bottlenecks.",
      contextAfter: "Developers must therefore adopt memory compaction and aggressive quantization techniques.",
    },
  ];

  for (const tc of aiTestScenarios) {
    console.log(`\n  👉 Testing ${tc.scenario}...`);
    console.log(`     Target Sentence: "${tc.sentence}"`);

    const tStart = performance.now();
    try {
      const fullContext = `${tc.contextBefore}\n\n${tc.sentence}\n\n${tc.contextAfter}`;
      const result: SentenceBreakdownResponse = await analyzeSentence(
        tc.sentence,
        fullContext,
        AI_CONFIG
      );
      const latencyMs = Math.round((performance.now() - tStart) * 100) / 100;

      const vocabWithIpa = (result.vocabulary || []).filter((v) => Boolean(v.ipa)).length;
      const isValid = Boolean(
        result.translationVi &&
        (result.skeleton?.parts?.length ?? 0) > 0 &&
        (result.chunks?.length ?? 0) > 0 &&
        result.grammar?.whyUsedVi &&
        result.grammar?.mechanicVi &&
        (result.mentalModelSteps?.length ?? 0) > 0
      );

      const scenarioReport = {
        scenario: tc.scenario,
        sentence: tc.sentence,
        latencyMs,
        model: AI_CONFIG.model,
        complexity: result.complexity || "complex",
        translationVi: result.translationVi,
        coreIdeaVi: result.coreIdeaVi || "",
        skeletonPattern: result.skeleton?.pattern || "N/A",
        skeletonPartsCount: result.skeleton?.parts?.length || 0,
        chunksCount: result.chunks?.length || 0,
        clausesCount: result.clauses?.length || 0,
        vocabCount: result.vocabulary?.length || 0,
        vocabWithIpaCount: vocabWithIpa,
        hasGrammarMechanic: Boolean(result.grammar?.mechanicVi),
        mentalModelStepsCount: result.mentalModelSteps?.length || 0,
        schemaValid: isValid,
      };

      report.aiAnalysis!.push(scenarioReport);

      console.log(`     - Raw response received: ${JSON.stringify(result).slice(0, 300)}...`);
      console.log(`     ✓ Latency: ${latencyMs} ms`);
      console.log(`     ✓ Translation: "${result.translationVi}"`);
      console.log(`     ✓ Core Idea: "${result.coreIdeaVi}"`);
      console.log(`     ✓ Skeleton: [${result.skeleton?.pattern}] with ${result.skeleton?.parts?.length} parts`);
      console.log(`     ✓ Semantic Chunks: ${result.chunks?.length} chunks`);
      console.log(`     ✓ Vocabulary: ${result.vocabulary?.length} words (IPA enriched: ${vocabWithIpa}/${result.vocabulary?.length})`);
      console.log(`     ✓ Grammar Mechanic: "${result.grammar?.mechanicVi?.slice(0, 80)}..."`);
      console.log(`     ✓ Mental Model Steps: ${result.mentalModelSteps?.length} steps`);
      console.log(`     ✓ Schema Valid: ${isValid ? "PASS (100%)" : "FAIL"}`);
    } catch (err) {
      const latencyMs = Math.round((performance.now() - tStart) * 100) / 100;
      console.error(`     ✗ Failed after ${latencyMs}ms:`, err);
    }
  }

  // --------------------------------------------------------------------------
  // SUMMARY REPORT
  // --------------------------------------------------------------------------
  console.log("\n================================================================================");
  console.log("📊 REAL WORLD PERFORMANCE SUMMARY REPORT");
  console.log("================================================================================");
  console.log(JSON.stringify(report, null, 2));

  // Save report to disk
  await fs.writeFile(
    path.join(process.cwd(), "benchmark_report.json"),
    JSON.stringify(report, null, 2),
    "utf-8"
  );
  console.log("\n📁 Full Benchmark Report saved to /mnt/D/Code/Web/se2/benchmark_report.json");
}

runBenchmark().catch(console.error);
