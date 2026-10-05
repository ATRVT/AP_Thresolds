import { DilutionLevel } from '../types';

export const OFFICIAL_DILUTION_TABLE: DilutionLevel[] = [
  {
    id: 'stock',
    name: 'Solución Madre (Stock)',
    theoreticalRatio: '1 : 1.000',
    ratioValue: 1_000,
    stepIndex: 1,
  },
  {
    id: 'lvl-0',
    name: 'Nivel 0',
    theoreticalRatio: '1 : 2.000',
    ratioValue: 2_000,
    stepIndex: 2,
  },
  {
    id: 'lvl-1',
    name: 'Nivel 1',
    theoreticalRatio: '1 : 10.000',
    ratioValue: 10_000,
    stepIndex: 3,
  },
  {
    id: 'lvl-1.5',
    name: 'Nivel 1,5',
    theoreticalRatio: '1 : 20.000',
    ratioValue: 20_000,
    stepIndex: 4,
  },
  {
    id: 'lvl-2',
    name: 'Nivel 2',
    theoreticalRatio: '1 : 100.000',
    ratioValue: 100_000,
    stepIndex: 5,
  },
  {
    id: 'lvl-2.5',
    name: 'Nivel 2,5',
    theoreticalRatio: '1 : 200.000',
    ratioValue: 200_000,
    stepIndex: 6,
  },
  {
    id: 'lvl-3',
    name: 'Nivel 3',
    theoreticalRatio: '1 : 1.000.000',
    ratioValue: 1_000_000,
    stepIndex: 7,
  },
  {
    id: 'lvl-3.5',
    name: 'Nivel 3,5',
    theoreticalRatio: '1 : 2.000.000',
    ratioValue: 2_000_000,
    stepIndex: 8,
  },
  {
    id: 'lvl-4',
    name: 'Nivel 4',
    theoreticalRatio: '1 : 10.000.000',
    ratioValue: 10_000_000,
    stepIndex: 9,
  },
  {
    id: 'lvl-4.5',
    name: 'Nivel 4,5',
    theoreticalRatio: '1 : 20.000.000',
    ratioValue: 20_000_000,
    stepIndex: 10,
  },
  {
    id: 'lvl-5',
    name: 'Nivel 5',
    theoreticalRatio: '1 : 100.000.000',
    ratioValue: 100_000_000,
    stepIndex: 11,
  },
  {
    id: 'lvl-5.5',
    name: 'Nivel 5,5',
    theoreticalRatio: '1 : 200.000.000',
    ratioValue: 200_000_000,
    stepIndex: 12,
  },
  {
    id: 'lvl-6',
    name: 'Nivel 6',
    theoreticalRatio: '1 : 1.000.000.000',
    ratioValue: 1_000_000_000,
    stepIndex: 13,
  },
];

export const DEFAULT_WEBHOOK_URL =
  'https://script.google.com/macros/s/AKfycbwM-q5k4hIE-goBXfrd5FpzPECEioX4o6-CsOKx-adnvo-QsHL167a36l-ATlOQlp7fIQ/exec';

