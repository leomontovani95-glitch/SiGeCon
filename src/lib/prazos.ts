import { addDays } from "date-fns";

export function calcularPrazoDefesa(dataBase: Date): Date {
  let dias = 0;
  let atual = new Date(dataBase);
  while (dias < 2) {
    atual = addDays(atual, 1);
    const diaSemana = atual.getDay();
    if (diaSemana !== 0 && diaSemana !== 6) {
      dias++;
    }
  }
  return atual;
}

export function prazoExpirado(deadline: Date | null): boolean {
  if (!deadline) return false;
  return new Date() > deadline;
}
