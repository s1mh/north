import { profileForScore, type InvestorProfile } from "./score";

export const QUESTIONNAIRE_VERSION = "2026-07-28";

export type SuitabilityOption = {
  id: string;
  label: string;
  points: 0 | 1 | 2 | 3;
};

export type SuitabilityQuestion = {
  id: string;
  category: string;
  prompt: string;
  options: readonly SuitabilityOption[];
};

export type TargetAllocation = {
  label: string;
  value: number;
  color: string;
};

export const suitabilityQuestions: readonly SuitabilityQuestion[] = [
  {
    id: "objetivo",
    category: "Objetivos",
    prompt: "O que você mais busca ao investir?",
    options: [
      { id: "preservar", label: "Proteger o que já conquistei", points: 0 },
      { id: "equilibrar", label: "Equilibrar segurança e crescimento", points: 2 },
      { id: "crescer", label: "Buscar crescimento, mesmo com oscilações", points: 3 },
    ],
  },
  {
    id: "prazo",
    category: "Horizonte",
    prompt: "Quando você pretende usar a maior parte desse dinheiro?",
    options: [
      { id: "ate-2", label: "Em até 2 anos", points: 0 },
      { id: "2-a-5", label: "Entre 2 e 5 anos", points: 1 },
      { id: "5-a-10", label: "Entre 5 e 10 anos", points: 2 },
      { id: "mais-10", label: "Daqui a mais de 10 anos", points: 3 },
    ],
  },
  {
    id: "reserva",
    category: "Segurança",
    prompt: "Hoje, como está sua reserva para imprevistos?",
    options: [
      { id: "nao-tenho", label: "Ainda não tenho uma reserva", points: 0 },
      { id: "parcial", label: "Cobre menos de 6 meses", points: 1 },
      { id: "completa", label: "Cobre 6 meses ou mais", points: 3 },
    ],
  },
  {
    id: "queda",
    category: "Tolerância a risco",
    prompt: "Seus investimentos caem 20% em um mês. O que você faz?",
    options: [
      { id: "vendo", label: "Vendo tudo pra não perder mais", points: 0 },
      { id: "espero", label: "Espero e não mexo, faz parte", points: 2 },
      { id: "compro", label: "Aproveito e compro mais", points: 3 },
    ],
  },
  {
    id: "experiencia",
    category: "Experiência",
    prompt: "Há quanto tempo você investe?",
    options: [
      { id: "comecando", label: "Estou começando agora", points: 0 },
      { id: "ate-2", label: "Há até 2 anos", points: 1 },
      { id: "2-a-5", label: "Entre 2 e 5 anos", points: 2 },
      { id: "mais-5", label: "Há mais de 5 anos", points: 3 },
    ],
  },
  {
    id: "conhecimento",
    category: "Conhecimento",
    prompt: "Quão à vontade você está com renda variável?",
    options: [
      { id: "pouco", label: "Ainda não entendo bem", points: 0 },
      { id: "basico", label: "Conheço o básico", points: 1 },
      { id: "acompanho", label: "Entendo e acompanho meus ativos", points: 2 },
      { id: "avancado", label: "Tenho conhecimento avançado", points: 3 },
    ],
  },
  {
    id: "renda",
    category: "Estabilidade",
    prompt: "Como você descreve sua renda mensal?",
    options: [
      { id: "instavel", label: "Varia bastante e é imprevisível", points: 0 },
      { id: "parcial", label: "Varia, mas tenho alguma previsibilidade", points: 1 },
      { id: "estavel", label: "É estável e previsível", points: 3 },
    ],
  },
  {
    id: "dependencia",
    category: "Liquidez",
    prompt: "Você pode precisar resgatar seus investimentos de repente?",
    options: [
      { id: "provavel", label: "Sim, é bem provável", points: 0 },
      { id: "talvez", label: "Talvez, em parte", points: 1 },
      { id: "improvavel", label: "É improvável", points: 3 },
    ],
  },
  {
    id: "oscilacao",
    category: "Tolerância a risco",
    prompt: "Qual oscilação anual você aceitaria sem perder o sono?",
    options: [
      { id: "ate-5", label: "Até 5%", points: 0 },
      { id: "ate-10", label: "Até 10%", points: 1 },
      { id: "ate-20", label: "Até 20%", points: 2 },
      { id: "mais-20", label: "Mais de 20%", points: 3 },
    ],
  },
  {
    id: "decisao",
    category: "Comportamento",
    prompt: "Quando um investimento oscila, como você costuma decidir?",
    options: [
      { id: "saio", label: "Prefiro sair logo para evitar perdas", points: 0 },
      { id: "avalio", label: "Reavalio o plano antes de agir", points: 2 },
      { id: "oportunidade", label: "Procuro oportunidades para aumentar posição", points: 3 },
    ],
  },
  {
    id: "diversificacao",
    category: "Carteira",
    prompt: "Quanto do seu patrimônio você colocaria em renda variável?",
    options: [
      { id: "ate-10", label: "Até 10%", points: 0 },
      { id: "ate-30", label: "Até 30%", points: 1 },
      { id: "ate-50", label: "Até 50%", points: 2 },
      { id: "mais-50", label: "Mais de 50%", points: 3 },
    ],
  },
  {
    id: "prioridade",
    category: "Escolha final",
    prompt: "Qual destas frases combina mais com você?",
    options: [
      { id: "seguranca", label: "Prefiro ganhar menos a correr risco de perder", points: 0 },
      { id: "equilibrio", label: "Aceito algum risco para buscar retorno melhor", points: 2 },
      { id: "retorno", label: "Aceito bastante risco para buscar mais retorno", points: 3 },
    ],
  },
] as const;

export const targetAllocations: Record<InvestorProfile, readonly TargetAllocation[]> = {
  conservador: [
    { label: "Renda Fixa", value: 70, color: "var(--rf)" },
    { label: "Fundos", value: 15, color: "var(--fu)" },
    { label: "Internacional", value: 10, color: "var(--intl)" },
    { label: "Ações · ETF", value: 5, color: "var(--ac)" },
  ],
  moderado: [
    { label: "Renda Fixa", value: 40, color: "var(--rf)" },
    { label: "Ações · ETF", value: 25, color: "var(--ac)" },
    { label: "FIIs", value: 15, color: "var(--fi)" },
    { label: "Internacional", value: 10, color: "var(--intl)" },
    { label: "Cripto", value: 10, color: "var(--cr)" },
  ],
  arrojado: [
    { label: "Ações · ETF", value: 40, color: "var(--ac)" },
    { label: "Internacional", value: 20, color: "var(--intl)" },
    { label: "Renda Fixa", value: 15, color: "var(--rf)" },
    { label: "FIIs", value: 15, color: "var(--fi)" },
    { label: "Cripto", value: 10, color: "var(--cr)" },
  ],
};

export const profileCopy: Record<InvestorProfile, string> = {
  conservador:
    "Você prioriza segurança e previsibilidade. Sua carteira-alvo protege a maior parte do patrimônio sem deixar de buscar crescimento gradual.",
  moderado:
    "Você aceita alguma oscilação em troca de retorno melhor, mantendo boa parte em segurança. Equilíbrio entre proteger e crescer.",
  arrojado:
    "Você aceita oscilações maiores em busca de crescimento no longo prazo, sem abrir mão de uma base diversificada.",
};

export function scoreAnswers(answers: Readonly<Record<string, string>>) {
  if (Object.keys(answers).length !== suitabilityQuestions.length) {
    throw new Error("Responda todas as perguntas antes de calcular o perfil.");
  }

  const points = suitabilityQuestions.reduce((total, question) => {
    const selected = question.options.find((option) => option.id === answers[question.id]);
    if (!selected) throw new Error(`Resposta inválida para ${question.id}.`);
    return total + selected.points;
  }, 0);

  const maximum = suitabilityQuestions.length * 3;
  const score = Math.round((points / maximum) * 100);

  return { score, profile: profileForScore(score) };
}
