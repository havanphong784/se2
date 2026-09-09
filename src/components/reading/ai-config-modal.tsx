"use client";

import React, { useState } from "react";
import { Sparkles, Terminal, CheckCircle2, AlertCircle, RefreshCw, X, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getSavedAIConfig,
  saveAIConfig,
  testAIConnection,
} from "@/lib/ai/local-ai-client";
import type { ClientAIConfig } from "@/types/reading";

interface AIConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigUpdated?: (config: ClientAIConfig) => void;
}

function AIConfigModalContent({ onClose, onConfigUpdated }: { onClose: () => void; onConfigUpdated?: (config: ClientAIConfig) => void }) {
  const [config, setConfig] = useState<ClientAIConfig>(() => getSavedAIConfig());
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    tested: boolean;
    ok: boolean;
    message: string;
    models?: string[];
  }>({ tested: false, ok: false, message: "" });
  const [copiedCmd, setCopiedCmd] = useState(false);

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult({ tested: false, ok: false, message: "" });
    try {
      const res = await testAIConnection(config.baseUrl, config.apiKey);
      setTestResult({
        tested: true,
        ok: res.ok,
        message: res.message,
        models: res.availableModels,
      });
      if (res.ok && res.availableModels && res.availableModels.length > 0) {
        if (!config.model || !res.availableModels.includes(config.model)) {
          setConfig((prev) => ({ ...prev, model: res.availableModels![0] }));
        }
      }
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    saveAIConfig(config);
    if (onConfigUpdated) onConfigUpdated(config);
    onClose();
  };

  const tunnelCommand = "cloudflared tunnel --url http://localhost:11434";

  const handleCopyCommand = () => {
    navigator.clipboard.writeText(tunnelCommand);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-xl rounded-2xl border-2 border-b-4 border-[#e5e5e5] bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#eeeeee] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-[#e5f6fd] text-[#1cb0f6]">
              <Sparkles className="size-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-eel-dark-blue">Cấu hình Local AI cá nhân</h2>
              <p className="text-xs font-bold text-ash">Kết nối Ollama / LM Studio qua Cloudflare Tunnel</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-ash hover:bg-gray-100 hover:text-charcoal"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="mt-5 space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {/* Hướng dẫn nhanh */}
          <div className="rounded-xl border-2 border-[#e5e5e5] bg-[#fafafa] p-4 text-xs">
            <div className="flex items-center justify-between font-bold text-eel-dark-blue">
              <span className="flex items-center gap-1.5">
                <Terminal className="size-4 text-ecto-green" /> 1 Lệnh tạo HTTPS Tunnel cho Ollama:
              </span>
              <button
                type="button"
                onClick={handleCopyCommand}
                className="flex items-center gap-1 text-[11px] font-extrabold text-[#1cb0f6] hover:underline"
              >
                {copiedCmd ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                {copiedCmd ? "Đã chép" : "Sao chép lệnh"}
              </button>
            </div>
            <code className="mt-2 block rounded-lg bg-white border border-[#e5e5e5] p-2.5 font-mono text-[11.5px] text-charcoal select-all">
              {tunnelCommand}
            </code>
            <p className="mt-2 text-[11px] text-ash">
              👉 Chạy lệnh trên máy tính của bạn, copy đường link <span className="font-mono text-charcoal">https://...trycloudflare.com</span> dán vào ô bên dưới.
            </p>
          </div>

          {/* Endpoint URL */}
          <div>
            <label className="block text-xs font-black text-eel-dark-blue mb-1">
              Base URL Endpoint (OpenAI-compatible)
            </label>
            <input
              type="text"
              value={config.baseUrl}
              onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })}
              placeholder="https://random-id.trycloudflare.com/v1"
              className="w-full rounded-xl border-2 border-[#e5e5e5] px-3.5 py-2.5 text-sm font-semibold text-charcoal focus:border-macaw-blue focus:outline-none"
            />
            <span className="mt-1 block text-[11px] text-ash">
              Ví dụ: <code className="font-mono">http://localhost:11434/v1</code> (nếu chạy local) hoặc <code className="font-mono">https://*.trycloudflare.com/v1</code>
            </span>
          </div>

          {/* Model Name */}
          <div>
            <label className="block text-xs font-black text-eel-dark-blue mb-1">
              Tên Model (Ollama / Local Model)
            </label>
            <input
              type="text"
              value={config.model}
              onChange={(e) => setConfig({ ...config, model: e.target.value })}
              placeholder="qwen2.5:7b hoặc llama3.1:8b"
              className="w-full rounded-xl border-2 border-[#e5e5e5] px-3.5 py-2.5 text-sm font-semibold text-charcoal focus:border-macaw-blue focus:outline-none"
            />
            {testResult.models && testResult.models.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="text-[11px] font-bold text-ash mr-1 self-center">Models có sẵn:</span>
                {testResult.models.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setConfig({ ...config, model: m })}
                    className={`rounded-lg border px-2 py-0.5 text-[11px] font-bold transition-colors ${
                      config.model === m
                        ? "border-[#1cb0f6] bg-[#e5f6fd] text-[#1cb0f6]"
                        : "border-[#e5e5e5] bg-white text-ash hover:border-gray-400"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* API Key (Optional) */}
          <div>
            <label className="block text-xs font-black text-eel-dark-blue mb-1">
              API Key <span className="text-ash font-normal">(Tùy chọn, để trống nếu dùng Ollama)</span>
            </label>
            <input
              type="password"
              value={config.apiKey || ""}
              onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
              placeholder="sk-..."
              className="w-full rounded-xl border-2 border-[#e5e5e5] px-3.5 py-2.5 text-sm font-semibold text-charcoal focus:border-macaw-blue focus:outline-none"
            />
          </div>

          {/* Kết quả kiểm tra */}
          {testResult.tested && (
            <div
              className={`rounded-xl border-2 p-3 text-xs font-bold ${
                testResult.ok
                  ? "border-[#a5ed6e] bg-[#f7fff1] text-[#438f0e]"
                  : "border-[#ffccd5] bg-[#fff5f7] text-[#c92a2a]"
              }`}
            >
              <div className="flex items-start gap-2">
                {testResult.ok ? (
                  <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="size-4 shrink-0 mt-0.5" />
                )}
                <span>{testResult.message}</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="mt-6 flex items-center justify-between border-t border-[#eeeeee] pt-4">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleTest}
            disabled={isTesting || !config.baseUrl}
            className="gap-1.5"
          >
            <RefreshCw className={`size-4 ${isTesting ? "animate-spin" : ""}`} />
            {isTesting ? "Đang kiểm tra..." : "Kiểm tra kết nối"}
          </Button>

          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              Hủy
            </Button>
            <Button type="button" variant="default" size="sm" onClick={handleSave}>
              Lưu cấu hình
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AIConfigModal({ isOpen, onClose, onConfigUpdated }: AIConfigModalProps) {
  if (!isOpen) return null;
  return <AIConfigModalContent onClose={onClose} onConfigUpdated={onConfigUpdated} />;
}
