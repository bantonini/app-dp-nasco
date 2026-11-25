import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PDFCheckBox, PDFTextField } from 'pdf-lib';
import type { Dossier } from '../dossier.ts';
import { cerfaFieldValues, dateDigits, fillCerfa } from './cerfa-official.ts';

const address = { numero: '12', voie: 'chemin des Oliviers', lieuDit: '', codePostal: '84160', localite: 'Lourmarin' };
const dossier = {
  reference: 'DP-2026-0001',
  declarant: {
    type: 'particulier', civilite: 'Madame', nom: 'Martin', prenom: 'Claire', dateNaissance: '1984-03-07', lieuNaissance: 'Avignon',
    denomination: '', siret: '', adresse: address, telephone: '+33 6 12 34 56 78', email: 'claire.martin@example.fr', accepteEmail: true,
  },
  terrain: {
    adresse: address, codeInsee: '84068', commune: 'Lourmarin', location: null, voisines: [], batiments: [],
    parcelles: [{ idu: '840680000AB0123', prefixe: '000', section: 'AB', numero: '0123', contenance: 1250, geometry: { type: 'Polygon', coordinates: [] } }],
  },
  projet: { description: 'Pavillon', destination: 'habitation', surfacePlancher: 14.2, emprise: 19.8, hauteur: 3, surfaceExistante: 0, empriseExistante: 0, raccordements: '' },
  engagement: { lieu: 'Lourmarin', date: '2026-11-25' },
} as unknown as Dossier;

test('valeurs des champs du Cerfa 16702', () => {
  const { text, checked } = cerfaFieldValues(dossier);
  assert.equal(text.D1N_nom, 'MARTIN');
  assert.equal(text.D1A_naissance, '07031984');
  assert.equal(text.D3T_telephone, '0612345678');
  assert.equal(text.D5GE1_email, 'claire.martin');
  assert.equal(text.D5GE2_email, 'example.fr');
  assert.equal(text.T2S_section, 'AB');
  assert.equal(text.D5T_total, '1250');
  assert.equal(text.W3ES2_creee, '19,8');
  assert.equal(text.W2LB1, '14,2');
  assert.equal(text.W2SF1, '14,2');
  assert.equal(text.E1D_date, '25112026');
  assert.ok(checked.includes('C2ZA1_nouvelle') && checked.includes('P5PA2'));
});

test('dateDigits', () => {
  assert.equal(dateDigits('2026-01-09'), '09012026');
  assert.equal(dateDigits(''), '');
});

test('remplit le formulaire officiel', async () => {
  const template = await readFile(new URL('../../../public/cerfa/cerfa-16702.pdf', import.meta.url));
  const pdf = await fillCerfa(dossier, template.buffer as ArrayBuffer, { flatten: false });
  const form = pdf.getForm();
  const { text, checked } = cerfaFieldValues(dossier);
  for (const name of Object.keys(text)) assert.ok(form.getField(name) instanceof PDFTextField, `champ texte ${name}`);
  for (const name of checked) assert.ok((form.getField(name) as PDFCheckBox).isChecked(), `case ${name}`);
  const flat = await fillCerfa(dossier, template.buffer as ArrayBuffer, { flatten: true });
  assert.equal(flat.getPageCount(), 16);
  assert.equal(flat.getForm().getFields().length, 0);
});
