"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  profileCopy,
  suitabilityQuestions,
  targetAllocations,
} from "./questionnaire";
import type { InvestorProfile } from "./score";

type Answers = Record<string, string>;
export type SuitabilityResult = { score: number; profile: InvestorProfile };

const profileLabels: Record<InvestorProfile, string> = {
  conservador: "Conservador",
  moderado: "Moderado",
  arrojado: "Arrojado",
};

export function SuitabilityFlow({ initialResult = null }: { initialResult?: SuitabilityResult | null }) {
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [result, setResult] = useState<SuitabilityResult | null>(initialResult);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const question = suitabilityQuestions[current]!;
  const selected = answers[question.id];
  const progress = ((current + 1) / suitabilityQuestions.length) * 100;

  const allocation = useMemo(
    () => (result ? targetAllocations[result.profile] : []),
    [result],
  );

  function choose(optionId: string) {
    setAnswers((previous) => ({ ...previous, [question.id]: optionId }));
  }

  function previous() {
    if (current === 0) return;
    setCurrent((value) => value - 1);
  }

  async function next() {
    if (!selected) return;
    if (current < suitabilityQuestions.length - 1) {
      setCurrent((value) => value + 1);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/suitability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const payload = await response.json() as SuitabilityResult | { error?: string };
      if (!response.ok || !("profile" in payload)) {
        throw new Error("error" in payload ? payload.error : undefined);
      }
      setResult(payload);
    } catch (submissionError) {
      setError(submissionError instanceof Error && submissionError.message
        ? submissionError.message
        : "Não foi possível salvar seu perfil agora.");
    } finally {
      setSaving(false);
    }
  }

  function restart() {
    setAnswers({});
    setCurrent(0);
    setResult(null);
    setError("");
  }

  if (result) {
    const label = profileLabels[result.profile];
    return (
      <main className="onboarding-shell">
        <section className="result-card" aria-labelledby="profile-title">
          <p className="eyebrow">Seu perfil de investidor</p>
          <h1 className="profile-title" id="profile-title">{label}</h1>
          <p className="profile-copy">{profileCopy[result.profile]}</p>

          <div className="profile-scale" aria-label={`Perfil ${label}`}>
            {(["conservador", "moderado", "arrojado"] as const).map((profile) => (
              <span key={profile} data-active={profile === result.profile} />
            ))}
          </div>
          <div className="profile-scale-labels" aria-hidden="true">
            <span>Conservador</span><span>Moderado</span><span>Arrojado</span>
          </div>

          <p className="eyebrow allocation-title">Carteira-alvo sugerida</p>
          <div className="allocation-bar" aria-label="Distribuição sugerida">
            {allocation.map((item) => (
              <span key={item.label} style={{ background: item.color, width: `${item.value}%` }} />
            ))}
          </div>
          <div className="allocation-list">
            {allocation.map((item) => (
              <div key={item.label}>
                <span className="allocation-dot" style={{ background: item.color }} />
                <span>{item.label}</span>
                <strong>{item.value}%</strong>
              </div>
            ))}
          </div>

          <p className="result-note">
            Este resultado é educacional e considera somente suas respostas. Você pode refazer o questionário quando quiser.
          </p>
          <Link className="button onboarding-action" href="/inicio">Ir para o início</Link>
          <button className="text-action" type="button" onClick={restart}>Refazer agora</button>
        </section>
      </main>
    );
  }

  return (
    <main className="onboarding-shell">
      <section className="question-card" aria-labelledby="question-title">
        <header className="question-progress">
          <button type="button" onClick={previous} disabled={current === 0} aria-label="Pergunta anterior">←</button>
          <div className="progress-track" aria-hidden="true">
            <span style={{ width: `${progress}%` }} />
          </div>
          <span>{String(current + 1).padStart(2, "0")} / {suitabilityQuestions.length}</span>
        </header>

        <p className="question-category">{question.category}</p>
        <h1 id="question-title">{question.prompt}</h1>

        <fieldset className="answer-list">
          <legend className="sr-only">Escolha uma resposta</legend>
          {question.options.map((option, index) => {
            const active = selected === option.id;
            return (
              <label key={option.id} data-selected={active}>
                <input
                  type="radio"
                  name={question.id}
                  value={option.id}
                  checked={active}
                  onChange={() => choose(option.id)}
                />
                <span className="answer-letter">{String.fromCharCode(65 + index)}</span>
                <span>{option.label}</span>
              </label>
            );
          })}
        </fieldset>

        {error && <p className="form-error suitability-error" role="alert">{error}</p>}
        <button className="button onboarding-action" type="button" onClick={next} disabled={!selected || saving}>
          {saving ? "Salvando seu perfil…" : current === suitabilityQuestions.length - 1 ? "Ver meu perfil" : "Próxima"}
        </button>
      </section>
    </main>
  );
}
