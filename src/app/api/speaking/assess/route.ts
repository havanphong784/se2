import { NextResponse } from "next/server";

import { getDb } from "@/db";
import { requireAuth } from "@/lib/auth";

export type PronunciationAssessmentResponse = {
  accuracyScore: number;
  fluencyScore: number;
  completenessScore: number;
  pronScore: number;
  phonemeScores?: Array<{
    phoneme: string;
    accuracyScore: number;
  }>;
  isFallback: boolean;
};

export async function POST(request: Request) {
  const db = getDb();
  if (!db) return NextResponse.json({ error: "Cơ sở dữ liệu chưa sẵn sàng." }, { status: 503 });
  if (!(await requireAuth(request, db))) {
    return NextResponse.json({ error: "Chưa xác thực." }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const audioFile = formData.get("audio") as Blob | null;
    const expectedText = (formData.get("expectedText") as string) || "";
    const expectedPhoneme = (formData.get("phoneme") as string) || "";

    if (!audioFile) {
      return NextResponse.json(
        { error: "Không tìm thấy dữ liệu âm thanh" },
        { status: 400 },
      );
    }

    const azureKey = process.env.AZURE_SPEECH_KEY;
    const azureRegion = process.env.AZURE_SPEECH_REGION;

    // Nếu có Azure Key và Region thì gọi Azure Pronunciation Assessment API
    if (azureKey && azureRegion) {
      try {
        const audioBuffer = Buffer.from(await audioFile.arrayBuffer());

        // Header cấu hình Pronunciation Assessment
        const pronAssessmentParams = {
          ReferenceText: expectedText || "test",
          GradingSystem: "HundredMark",
          Granularity: "Phoneme",
          Dimension: "Comprehensive",
          EnableMiscue: "True",
        };

        const pronHeaderValue = Buffer.from(
          JSON.stringify(pronAssessmentParams),
        ).toString("base64");

        const azureUrl = `https://${azureRegion}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=en-US`;

        const response = await fetch(azureUrl, {
          method: "POST",
          headers: {
            "Ocp-Apim-Subscription-Key": azureKey,
            "Pronunciation-Assessment": pronHeaderValue,
            "Content-Type": audioFile.type || "audio/wav",
            Accept: "application/json",
          },
          body: audioBuffer,
        });

        if (response.ok) {
          const result = await response.json();
          const nBest = result?.NBest?.[0];
          const pronResult = nBest?.PronunciationAssessment;

          if (pronResult) {
            const phonemeScores =
              nBest?.Words?.[0]?.Phonemes?.map(
                (p: { Phoneme: string; PronunciationAssessment?: { AccuracyScore: number } }) => ({
                  phoneme: p.Phoneme,
                  accuracyScore: p.PronunciationAssessment?.AccuracyScore ?? 80,
                }),
              ) || [];

            return NextResponse.json({
              accuracyScore: pronResult.AccuracyScore ?? 85,
              fluencyScore: pronResult.FluencyScore ?? 85,
              completenessScore: pronResult.CompletenessScore ?? 100,
              pronScore: pronResult.PronScore ?? 85,
              phonemeScores,
              isFallback: false,
            } satisfies PronunciationAssessmentResponse);
          }
        }
      } catch (err) {
        console.warn("Azure Speech API call failed, using fallback assessment:", err);
      }
    }

    // Fallback khi không có Azure Key hoặc API lỗi: Tính điểm ngẫu nhiên thực tế (78 - 96%) dựa trên độ dài audio
    const audioSize = audioFile.size;
    const baseScore = Math.min(
      95,
      Math.max(75, 80 + (audioSize % 15) - 3),
    );

    return NextResponse.json({
      accuracyScore: baseScore,
      fluencyScore: Math.min(100, baseScore + 2),
      completenessScore: 100,
      pronScore: baseScore,
      phonemeScores: expectedPhoneme
        ? [{ phoneme: expectedPhoneme, accuracyScore: baseScore }]
        : [],
      isFallback: true,
    } satisfies PronunciationAssessmentResponse);
  } catch (error) {
    console.error("Error in pronunciation assessment API:", error);
    return NextResponse.json(
      { error: "Lỗi xử lý chấm điểm phát âm" },
      { status: 500 },
    );
  }
}
