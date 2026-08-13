"use client";

import { useRef, useState } from "react";
import { Mic, Square, Volume2, RotateCcw, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PronunciationAssessmentResponse } from "@/app/api/speaking/assess/route";

interface IpaRecorderProps {
  soundSymbol: string;
  soundName: string;
  expectedPhoneme: string;
}

export function IpaRecorder({ soundSymbol, soundName, expectedPhoneme }: IpaRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isAssessing, setIsAssessing] = useState(false);
  const [assessment, setAssessment] = useState<PronunciationAssessmentResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      setError(null);
      setAssessment(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioUrl(url);

        // Tự động giải phóng microphone
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error(err);
      setError("Không thể truy cập microphone. Vui lòng cho phép trình duyệt truy cập micro.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const playRecordedAudio = () => {
    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audio.play();
    }
  };

  const assessPronunciation = async () => {
    if (!audioBlob) return;
    setIsAssessing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");
      formData.append("expectedText", soundSymbol);
      formData.append("phoneme", expectedPhoneme);

      const res = await fetch("/api/speaking/assess", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Lỗi khi kết nối tới máy chủ chấm điểm");
      }

      const data: PronunciationAssessmentResponse = await res.json();
      setAssessment(data);
    } catch (err) {
      console.error(err);
      setError("Không thể đánh giá phát âm. Vui lòng thử lại.");
    } finally {
      setIsAssessing(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border-2 border-eel-light bg-[#fbfff8] p-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-extrabold text-eel-dark-blue">Luyện đọc âm & Ghi âm</h4>
          <p className="text-xs font-bold text-ash">
            Âm IPA cần đọc: <span className="font-black text-eel-dark-blue text-base">{soundSymbol}</span> ({soundName})
          </p>
        </div>

        {!isRecording ? (
          <Button
            type="button"
            onClick={startRecording}
            variant="default"
            size="sm"
            className="gap-2"
          >
            <Mic className="size-4" /> Ghi âm
          </Button>
        ) : (
          <Button
            type="button"
            onClick={stopRecording}
            variant="danger"
            size="sm"
            className="animate-pulse gap-2"
          >
            <Square className="size-4 fill-current" /> Dừng ghi âm
          </Button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-xs font-bold text-red-600 border border-red-200">
          <AlertCircle className="size-4 shrink-0" />
          {error}
        </div>
      )}

      {audioUrl && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-eel-light pt-3">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={playRecordedAudio}
              variant="outline"
              size="sm"
              className="gap-1.5"
            >
              <Volume2 className="size-4" /> Nghe lại giọng đọc
            </Button>
            <Button
              type="button"
              onClick={startRecording}
              variant="ghost"
              size="sm"
              className="gap-1 text-ash hover:text-charcoal"
            >
              <RotateCcw className="size-4" /> Ghi lại
            </Button>
          </div>

          <Button
            type="button"
            onClick={assessPronunciation}
            disabled={isAssessing}
            variant="secondary"
            size="sm"
          >
            {isAssessing ? "Đang đánh giá..." : "Chấm điểm phát âm"}
          </Button>
        </div>
      )}

      {assessment && (
        <div className="flex flex-col gap-3 rounded-lg border border-[#e5e5e5] bg-white p-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-extrabold text-[#438f0e]">
              <CheckCircle2 className="size-4" />
              <span>Điểm chuẩn phát âm: {assessment.accuracyScore}/100</span>
            </div>
            {assessment.isFallback && (
              <span className="text-[10px] font-bold text-ash bg-[#f0f0f0] px-2 py-0.5 rounded">
                Chế độ mô phỏng
              </span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-lg bg-[#f9f9f9] p-2 border border-[#eee]">
              <p className="text-ash font-bold">Chính xác</p>
              <p className="font-black text-eel-dark-blue text-sm">{assessment.accuracyScore}%</p>
            </div>
            <div className="rounded-lg bg-[#f9f9f9] p-2 border border-[#eee]">
              <p className="text-ash font-bold">Trôi chảy</p>
              <p className="font-black text-eel-dark-blue text-sm">{assessment.fluencyScore}%</p>
            </div>
            <div className="rounded-lg bg-[#f9f9f9] p-2 border border-[#eee]">
              <p className="text-ash font-bold">Hoàn thiện</p>
              <p className="font-black text-eel-dark-blue text-sm">{assessment.completenessScore}%</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
