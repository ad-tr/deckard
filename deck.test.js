import { describe, expect, test } from 'bun:test';
import { rows, toNumber, toAmount, isNumeric, niceMax, markOf, scoreOf } from './deck.js';

const block = (text) => ({ textContent: text });

describe('rows', () => {
  test('découpe les lignes et les colonnes', () => {
    expect(rows(block('\n  Cloud Run | 320 | 2 vCPU\n  Cloud SQL | 540\n'))).toEqual([
      ['Cloud Run', '320', '2 vCPU'],
      ['Cloud SQL', '540'],
    ]);
  });

  test('ignore les lignes de séparation et les pipes de bord', () => {
    expect(rows(block('| a | b |\n|---|:-:|\n| 1 | 2 |'))).toEqual([['a', 'b'], ['1', '2']]);
  });
});

describe('toNumber', () => {
  test('espaces, virgule décimale et unités', () => {
    expect(toNumber('1 240,50 €')).toBe(1240.5);
    expect(toNumber('0,076 €')).toBe(0.076);
  });

  test('signe moins typographique', () => {
    expect(toNumber('−120')).toBe(-120);
  });

  test('valeur illisible', () => {
    expect(toNumber('n/a')).toBe(0);
  });
});

describe('toAmount', () => {
  test('suffixes k, M, B', () => {
    expect(toAmount('2k €')).toBe(2000);
    expect(toAmount('$5M')).toBe(5e6);
    expect(toAmount('1,5B')).toBe(1.5e9);
  });

  test('signe moins typographique et attribut absent', () => {
    expect(toAmount('−3k')).toBe(-3000);
    expect(toAmount(null)).toBe(0);
  });
});

describe('isNumeric', () => {
  test('reconnaît les valeurs chiffrées', () => {
    for (const t of ['2', '16 Go', '0,076 €', '99,95%', '−8%']) expect(isNumeric(t)).toBe(true);
  });

  test('refuse le texte', () => {
    for (const t of ['e2-standard-2', 'Cloud Run', '']) expect(isNumeric(t)).toBe(false);
  });
});

describe('niceMax', () => {
  test('arrondit vers une borne lisible', () => {
    expect(niceMax(0.8)).toBe(1);
    expect(niceMax(37)).toBe(50);
    expect(niceMax(780)).toBe(1000);
    expect(niceMax(1200)).toBe(2000);
    expect(niceMax(0)).toBe(1);
  });
});

describe('markOf', () => {
  test('oui / non / partiel en français et en anglais', () => {
    expect(markOf('Oui')).toBe('✓');
    expect(markOf('no')).toBe('✕');
    expect(markOf('partiel')).toBe('◐');
  });

  test('ignore les autres mots, y compris les noms internes de JavaScript', () => {
    expect(markOf('constructor')).toBeNull();
    expect(markOf('toString')).toBeNull();
    expect(markOf('peut-être')).toBeNull();
  });
});

describe('scoreOf', () => {
  test('part du score sur le maximum', () => {
    expect(scoreOf('4', 5)).toBe(0.8);
    expect(scoreOf('3,5', 5)).toBe(0.7);
    expect(scoreOf('80 %', 100)).toBe(0.8);
  });

  test('borne entre 0 et 1', () => {
    expect(scoreOf('7', 5)).toBe(1);
    expect(scoreOf('−2', 5)).toBe(0);
  });

  test('texte ou maximum absent', () => {
    expect(scoreOf('oui', 5)).toBeNull();
    expect(scoreOf('4', 0)).toBeNull();
    expect(scoreOf('4', NaN)).toBeNull();
  });
});
