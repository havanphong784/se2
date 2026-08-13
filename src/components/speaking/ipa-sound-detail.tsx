"use client";

import { Volume2, Sparkles, AlertCircle, CheckCircle, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { IpaSound } from "@/lib/ipa/types";
import { speakEnglish, speakIpaSound } from "@/lib/speech";
import { IpaRecorder } from "./ipa-recorder";
import { MinimalPairPractice } from "./minimal-pair-practice";

interface IpaSoundDetailProps {
  sound: IpaSound;
}

export function IpaSoundDetail({ sound }: IpaSoundDetailProps) {
  const playSoundAudio = () => {
    speakIpaSound(sound.id, sound.symbol, sound.audioUrl);
  };

  const playExampleAudio = (word: string) => {
    speakEnglish(word, "normal");
  };

  return (
    <div className="flex flex-col gap-6 rounded-2xl border-2 border-[#e5e5e5] bg-white p-6 shadow-sm md:p-8">
      {/* HEADER CARD */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-[#f0f0f0] pb-6">
        <div className="flex items-center gap-4">
          <div className="grid size-16 place-items-center rounded-2xl bg-[#f7fff1] border-2 border-eel-light font-display text-3xl font-black text-[#438f0e]">
            {sound.symbol}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-2xl font-black text-eel-dark-blue">{sound.name}</h2>
              <Badge variant="blue">{sound.typeLabel}</Badge>
            </div>
            <p className="text-sm font-extrabold text-ash">
              Tên tiếng Việt: <span className="text-charcoal">{sound.vietnameseName}</span>
            </p>
          </div>
        </div>

        <Button
          type="button"
          onClick={playSoundAudio}
          variant="default"
          size="lg"
          className="gap-2"
        >
          <Volume2 className="size-5" /> Nghe âm chuẩn
        </Button>
      </div>

      {/* TRÌNH GHI ÂM CHẤM ĐIỂM IPA */}
      <IpaRecorder
        soundSymbol={sound.symbol}
        soundName={sound.name}
        expectedPhoneme={sound.symbol}
      />

      {/* 1. ĐỊNH DANH ÂM (MÔ TẢ NGỮ ÂM HỌC) */}
      <section className="flex flex-col gap-3">
        <h3 className="flex items-center gap-2 font-display text-lg font-extrabold text-eel-dark-blue">
          <Sparkles className="size-5 text-[#438f0e]" /> 1. Định danh ngữ âm học
        </h3>
        <div className="grid gap-3 rounded-xl border-2 border-[#f0f0f0] bg-[#fafafa] p-4 text-sm font-bold sm:grid-cols-2">
          {sound.phoneticProperties.voicing && (
            <div>
              <span className="text-ash">Thanh quản: </span>
              <span className="text-charcoal font-extrabold">
                {sound.phoneticProperties.voicing === "voiced" ? "Hữu thanh (Voiced - Rung)" : "Vô thanh (Voiceless - Không rung)"}
              </span>
            </div>
          )}
          {sound.phoneticProperties.length && (
            <div>
              <span className="text-ash">Độ dài: </span>
              <span className="text-charcoal font-extrabold">
                {sound.phoneticProperties.length === "long" ? "Dài (Long)" : "Ngắn (Short)"}
              </span>
            </div>
          )}
          {sound.phoneticProperties.tonguePosition && (
            <div>
              <span className="text-ash">Vị trí lưỡi: </span>
              <span className="text-charcoal">{sound.phoneticProperties.tonguePosition}</span>
            </div>
          )}
          {sound.phoneticProperties.lipShape && (
            <div>
              <span className="text-ash">Khẩu hình môi: </span>
              <span className="text-charcoal">{sound.phoneticProperties.lipShape}</span>
            </div>
          )}
          {sound.phoneticProperties.jawOpening && (
            <div>
              <span className="text-ash">Độ mở hàm: </span>
              <span className="text-charcoal">{sound.phoneticProperties.jawOpening}</span>
            </div>
          )}
          {sound.phoneticProperties.mannerOfArticulation && (
            <div>
              <span className="text-ash">Phương thức cấu âm: </span>
              <span className="text-charcoal">{sound.phoneticProperties.mannerOfArticulation}</span>
            </div>
          )}
          <div className="sm:col-span-2 border-t border-[#e5e5e5] pt-2 text-xs text-ash">
            <span className="font-extrabold text-charcoal">Tóm tắt: </span>
            {sound.phoneticProperties.summary}
          </div>
        </div>
      </section>

      {/* 2. CẤU HÌNH KHẨU HÌNH MIỆNG */}
      <section className="flex flex-col gap-3">
        <h3 className="flex items-center gap-2 font-display text-lg font-extrabold text-eel-dark-blue">
          <ListChecks className="size-5 text-[#438f0e]" /> 2. Cấu hình khẩu hình miệng & Mẹo
        </h3>
        <div className="flex flex-col gap-3 rounded-xl border-2 border-[#e5e5e5] bg-white p-4">
          <div className="space-y-2">
            <h4 className="text-xs font-extrabold uppercase tracking-wide text-ash">Các bước thực hiện:</h4>
            <ol className="list-decimal pl-5 space-y-1 text-sm font-bold text-charcoal">
              {sound.articulation.steps.map((step, idx) => (
                <li key={idx}>{step}</li>
              ))}
            </ol>
          </div>

          {sound.articulation.commonMistakes.length > 0 && (
            <div className="rounded-lg bg-amber-50 p-3 border border-amber-200">
              <h4 className="flex items-center gap-1.5 text-xs font-extrabold text-amber-800">
                <AlertCircle className="size-4" /> Lỗi thường gặp người Việt hay mắc:
              </h4>
              <ul className="list-disc pl-5 mt-1 text-xs font-bold text-amber-900">
                {sound.articulation.commonMistakes.map((mistake, idx) => (
                  <li key={idx}>{mistake}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-lg bg-green-50 p-3 border border-green-200">
            <h4 className="flex items-center gap-1.5 text-xs font-extrabold text-green-800">
              <CheckCircle className="size-4" /> Mẹo tự kiểm tra:
            </h4>
            <p className="mt-0.5 text-xs font-bold text-green-900">
              {sound.articulation.selfCheckTip}
            </p>
          </div>
        </div>
      </section>

      {/* 3. TỪ VỰNG VÍ DỤ */}
      <section className="flex flex-col gap-3">
        <h3 className="font-display text-lg font-extrabold text-eel-dark-blue">
          3. Từ vựng ví dụ
        </h3>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {sound.examples.map((ex, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between rounded-xl border-2 border-[#f0f0f0] bg-white p-3 hover:border-eel-light transition-colors"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-charcoal">{ex.word}</span>
                  <span className="text-xs font-bold text-ash">({ex.ipa})</span>
                </div>
                <p className="text-xs font-bold text-ash">&quot;{ex.translation}&quot;</p>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => playExampleAudio(ex.word)}
                className="size-9 p-0"
                title={`Nghe ${ex.word}`}
              >
                <Volume2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      </section>

      {/* 4. DẤU HIỆU NHẬN BIẾT QUA CHỮ VIẾT (SPELLING PATTERNS) */}
      <section className="flex flex-col gap-3">
        <h3 className="font-display text-lg font-extrabold text-eel-dark-blue">
          4. Dấu hiệu nhận biết qua chữ viết (Spelling Patterns)
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {sound.spellingPatterns.map((pat, idx) => (
            <div
              key={idx}
              className="rounded-xl border-2 border-[#f0f0f0] bg-[#fafafa] p-3.5"
            >
              <span className="text-xs font-extrabold text-[#438f0e] bg-[#f7fff1] border border-eel-light px-2 py-0.5 rounded">
                Chữ cái: {pat.letters}
              </span>
              <p className="mt-2 text-xs font-extrabold text-charcoal">
                Từ mẫu: <span className="text-eel-dark-blue">{pat.examples.join(", ")}</span>
              </p>
              {pat.note && (
                <p className="mt-1 text-[11px] font-bold text-ash">Ghi chú: {pat.note}</p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 5. CẶP ÂM DỄ NHẦM LẪN (MINIMAL PAIRS) */}
      <section className="flex flex-col gap-3">
        <h3 className="font-display text-lg font-extrabold text-eel-dark-blue">
          5. Cặp âm dễ nhầm lẫn (Minimal Pairs)
        </h3>
        <MinimalPairPractice
          minimalPairs={sound.minimalPairs}
          soundSymbol={sound.symbol}
        />
      </section>
    </div>
  );
}
