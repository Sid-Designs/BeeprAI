"use client";

import { useEffect, useMemo, useState } from "react";
import { buildKbFormatPrompt } from "@/lib/kbTextPrompt";
import { cn } from "@/lib/cn";
import { Label, Textarea } from "@/components/shared/FormField";
import { Button } from "@/components/shared/Button";
import type { Agent } from "@/lib/types";

const STEP_META = [
  { id: 1, title: "Raw text", short: "Paste notes" },
  { id: 2, title: "AI format", short: "Copy prompt" },
  { id: 3, title: "Paste & save", short: "Finish" },
] as const;

type StepId = (typeof STEP_META)[number]["id"];

type KbTextPrepareFlowProps = {
  value: string;
  onChange: (value: string) => void;
  agent?: Agent | null;
  orgName?: string;
  industry?: string;
  compact?: boolean;
  pasteFieldId?: string;
  pasteLabel?: string;
  pastePlaceholder?: string;
  /** Notifies parent when step changes (e.g. to gate the save button). */
  onActiveStepChange?: (step: StepId) => void;
};

export function KbTextPrepareFlow({
  value,
  onChange,
  agent,
  orgName,
  industry,
  compact = false,
  pasteFieldId = "kb-formatted-text",
  pasteLabel = "Formatted knowledge",
  pastePlaceholder = "Paste the structured output from ChatGPT here…",
  onActiveStepChange,
}: KbTextPrepareFlowProps) {
  const [rawText, setRawText] = useState("");
  const [activeStep, setActiveStep] = useState<StepId>(() => (value.trim() ? 3 : 1));
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const [promptOpened, setPromptOpened] = useState(false);

  const prompt = useMemo(
    () => buildKbFormatPrompt({ agent, orgName, industry, rawText }),
    [agent, orgName, industry, rawText],
  );

  useEffect(() => {
    onActiveStepChange?.(activeStep);
  }, [activeStep, onActiveStepChange]);

  const goToStep = (step: StepId) => setActiveStep(step);

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopyState("copied");
      setPromptOpened(true);
      window.setTimeout(() => setCopyState("idle"), 2500);
    } catch {
      setCopyState("error");
      window.setTimeout(() => setCopyState("idle"), 2500);
    }
  };

  const canContinue =
    activeStep === 1
      ? rawText.trim().length > 0
      : activeStep === 2
        ? promptOpened
        : value.trim().length > 0;

  const handleContinue = () => {
    if (activeStep === 1 && rawText.trim()) goToStep(2);
    else if (activeStep === 2) goToStep(3);
  };

  const handleBack = () => {
    if (activeStep === 2) goToStep(1);
    else if (activeStep === 3) goToStep(2);
  };

  const currentMeta = STEP_META.find((s) => s.id === activeStep)!;

  return (
    <div className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white">
      {/* Stepper */}
      <div className="border-b border-[#E2E8F0] bg-[#F8FAFC] px-4 py-4 sm:px-5">
        <div className="flex items-center justify-between gap-2">
          {STEP_META.map((step, index) => {
            const done = activeStep > step.id;
            const current = activeStep === step.id;
            const reachable = step.id < activeStep || (step.id === 2 && rawText.trim()) || step.id === 1;

            return (
              <div key={step.id} className="flex min-w-0 flex-1 items-center">
                <button
                  type="button"
                  disabled={!reachable && !done && !current}
                  onClick={() => {
                    if (step.id === 1) goToStep(1);
                    else if (step.id === 2 && rawText.trim()) goToStep(2);
                    else if (step.id === 3 && rawText.trim()) goToStep(3);
                  }}
                  className={cn(
                    "flex min-w-0 flex-1 flex-col items-center gap-1.5 text-center transition",
                    (reachable || done || current) && "cursor-pointer",
                    !reachable && !done && !current && "cursor-not-allowed opacity-50",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition",
                      current && "bg-[#2563EB] text-white ring-4 ring-[#2563EB]/20",
                      done && !current && "bg-emerald-500 text-white",
                      !current && !done && "border-2 border-[#CBD5E1] bg-white text-[#64748B]",
                    )}
                  >
                    {done && !current ? "✓" : step.id}
                  </span>
                  <span
                    className={cn(
                      "hidden text-[11px] font-medium sm:block",
                      current ? "text-[#2563EB]" : done ? "text-emerald-700" : "text-[#94A3B8]",
                    )}
                  >
                    {step.title}
                  </span>
                  <span
                    className={cn(
                      "text-[10px] sm:hidden",
                      current ? "font-semibold text-[#2563EB]" : "text-[#94A3B8]",
                    )}
                  >
                    {step.short}
                  </span>
                </button>
                {index < STEP_META.length - 1 ? (
                  <div
                    className={cn(
                      "mx-1 h-0.5 w-full min-w-[12px] max-w-[40px] shrink rounded-full sm:mx-2",
                      activeStep > step.id ? "bg-emerald-400" : "bg-[#E2E8F0]",
                    )}
                    aria-hidden
                  />
                ) : null}
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-center text-xs text-[#64748B]">
          Step {activeStep} of 3 — <span className="font-medium text-[#0F172A]">{currentMeta.title}</span>
        </p>
      </div>

      {/* Active step panel */}
      <div className="p-4 sm:p-5">
        {activeStep === 1 ? (
          <div className="grid gap-3">
            <div>
              <h4 className="text-base font-semibold text-[#0F172A]">Prepare your raw text</h4>
              <p className="mt-1 text-sm text-[#64748B]">
                Paste whatever you have — notes, brochure copy, website text, or FAQs. Messy is fine;
                you will format it with AI in the next step.
              </p>
            </div>
            <div>
              <Label htmlFor="kb-raw-text">Raw business information</Label>
              <Textarea
                id="kb-raw-text"
                rows={compact ? 6 : 8}
                placeholder="Paste unformatted content here…"
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                className="min-h-[140px]"
              />
              <p className="mt-1.5 text-xs text-[#94A3B8]">
                {rawText.trim()
                  ? `${rawText.trim().split(/\s+/).length} words ready to format`
                  : "Add some text to continue"}
              </p>
            </div>
          </div>
        ) : null}

        {activeStep === 2 ? (
          <div className="grid gap-4">
            <div>
              <h4 className="text-base font-semibold text-[#0F172A]">Format with ChatGPT</h4>
              <p className="mt-1 text-sm text-[#64748B]">
                Copy our prompt (it includes your raw text), paste it into ChatGPT, and send. Then
                come back here for step 3.
              </p>
            </div>

            <ol className="grid gap-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-sm text-[#475569]">
              <li className="flex gap-2">
                <span className="font-semibold text-[#2563EB]">1.</span>
                Click <strong>Copy prompt</strong> below
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-[#2563EB]">2.</span>
                Open ChatGPT and paste the prompt
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-[#2563EB]">3.</span>
                Copy the AI&apos;s structured answer for step 3
              </li>
            </ol>

            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={handleCopyPrompt}>
                {copyState === "copied"
                  ? "Copied!"
                  : copyState === "error"
                    ? "Copy failed"
                    : "Copy prompt"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => window.open("https://chatgpt.com", "_blank", "noopener,noreferrer")}
              >
                Open ChatGPT
              </Button>
              <button
                type="button"
                onClick={() => setPromptOpened((v) => !v)}
                className="rounded-xl px-3 py-2 text-sm font-medium text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A]"
              >
                {promptOpened ? "Hide preview" : "Preview prompt"}
              </button>
            </div>

            {promptOpened ? (
              <pre className="max-h-52 overflow-auto rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-xs leading-relaxed whitespace-pre-wrap text-[#475569]">
                {prompt}
              </pre>
            ) : null}

            {!copyState && !promptOpened ? (
              <p className="text-xs text-amber-700">
                Copy the prompt or preview it before continuing — so your raw text is included.
              </p>
            ) : null}
          </div>
        ) : null}

        {activeStep === 3 ? (
          <div className="grid gap-3">
            <div>
              <h4 className="text-base font-semibold text-[#0F172A]">Paste formatted knowledge</h4>
              <p className="mt-1 text-sm text-[#64748B]">
                Paste the structured output from ChatGPT below. This is what your calling agent will
                use — then click <strong>Save</strong>.
              </p>
            </div>
            <div>
              <Label htmlFor={pasteFieldId}>{pasteLabel}</Label>
              <Textarea
                id={pasteFieldId}
                rows={compact ? 8 : 10}
                placeholder={pastePlaceholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                required
                className="min-h-[160px]"
              />
              <p className="mt-1.5 text-xs text-[#94A3B8]">
                {value.trim()
                  ? `${value.trim().split(/\s+/).length} words ready to save`
                  : "Paste formatted text to enable save"}
              </p>
            </div>
          </div>
        ) : null}

        {/* Navigation */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#E2E8F0] pt-4">
          <div>
            {activeStep > 1 ? (
              <Button type="button" variant="ghost" size="sm" onClick={handleBack}>
                Back
              </Button>
            ) : (
              <span className="text-xs text-[#94A3B8]">Start with your raw notes</span>
            )}
          </div>

          {activeStep < 3 ? (
            <Button type="button" size="sm" disabled={!canContinue} onClick={handleContinue}>
              Continue to step {activeStep + 1}
            </Button>
          ) : (
            <span className="text-xs font-medium text-emerald-700">
              Ready — use the save button below
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
