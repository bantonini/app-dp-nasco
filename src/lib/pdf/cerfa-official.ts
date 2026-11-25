import { PDFCheckBox, PDFDocument, PDFTextField } from 'pdf-lib';
import type { Dossier } from '../dossier';

/** Formulaire officiel (Cerfa n° 16702*03) servi par l'application. */
export const CERFA_URL = '/cerfa/cerfa-16702.pdf';
export const CERFA_NUMBER = '16702';
/** Pages conservées dans le dossier : récépissé, formulaire et bordereau (sans la notice). */
const KEPT_PAGES = 16;

/**
 * Valeurs des champs du Cerfa 16702 (noms des champs AcroForm du PDF officiel).
 * Fonction pure : testable sans navigateur.
 */
export function cerfaFieldValues(d: Dossier): { text: Record<string, string>; checked: string[] } {
  const text: Record<string, string> = {};
  const checked: string[] = [];
  const set = (name: string, value: string | number | null | undefined) => {
    if (value === null || value === undefined || value === '') return;
    text[name] = String(value);
  };
  const decl = d.declarant;
  const p = d.projet;

  // 1. Identité du déclarant
  if (decl.type === 'particulier') {
    set('D1N_nom', decl.nom.toUpperCase());
    set('D1P_prenom', decl.prenom);
    set('D1A_naissance', dateDigits(decl.dateNaissance));
    set('D1C_commune', decl.lieuNaissance);
  } else {
    set('D2D_denomination', decl.denomination);
    set('D2S_siret', decl.siret.replace(/\D/g, ''));
    set('D2N_nom', decl.nom.toUpperCase());
    set('D2P_prenom', decl.prenom);
  }

  // 2. Coordonnées
  const a = decl.adresse;
  set('D3N_numero', a.numero);
  set('D3V_voie', a.voie);
  set('D3W_lieudit', a.lieuDit);
  set('D3L_localite', a.localite);
  set('D3C_code', a.codePostal);
  set('D3T_telephone', phoneDigits(decl.telephone));
  const [user, domain] = decl.email.split('@');
  if (domain) {
    set('D5GE1_email', user);
    set('D5GE2_email', domain);
    if (decl.accepteEmail) checked.push('D5A_acceptation');
  }

  // 3. Le terrain
  const t = d.terrain.adresse;
  set('T2Q_numero', t.numero);
  set('T2V_voie', t.voie);
  set('T2W_lieudit', t.lieuDit);
  set('T2L_localite', t.localite);
  set('T2C_code', t.codePostal);
  const slots = [
    ['T2F_prefixe', 'T2S_section', 'T2N_numero', 'T2T_superficie'],
    ['T2FP2_prefixe', 'T2SP2_section', 'T2NP2_numero', 'T2TP2_superficie'],
    ['T2FP3_prefixe', 'T2SP3_section', 'T2NP3_numero', 'T2TP3_superficie'],
  ];
  d.terrain.parcelles.slice(0, 3).forEach((pc, i) => {
    const [fp, fs, fn, ft] = slots[i];
    set(fp, pc.prefixe);
    set(fs, pc.section);
    set(fn, pc.numero);
    set(ft, pc.contenance);
  });
  set('D5T_total', d.terrain.parcelles.reduce((s, pc) => s + pc.contenance, 0) || null);

  // 4. Le projet
  checked.push('C2ZA1_nouvelle');
  set('C2ZD1_description', p.description.slice(0, 1000));
  if (p.destination === 'annexe') checked.push('C5ZE5_annexes');
  if (p.destination === 'habitation') {
    set('C5ZA1_logements', 1);
    set('C5ZA2_individuels', 1);
  }
  set('C5ZJ1_niveaux', 1);
  set('C5ZJ2_dessous', 0);

  // 4.3 Emprise au sol
  set('W3ES1_avanttravaux', num(p.empriseExistante ?? 0));
  set('W3ES2_creee', num(p.emprise));
  set('W3ES3_supprimee', '0');

  // 4.4 Surfaces de plancher : ligne Logement (L) ou Autres hébergements touristiques (X), et totaux (S).
  const row = p.destination === 'hebergement-touristique' ? 'X' : 'L';
  for (const r of [row, 'S']) {
    set(`W2${r}A1`, num(p.surfaceExistante));
    set(`W2${r}B1`, num(p.surfacePlancher));
    set(`W2${r}F1`, num(p.surfaceExistante + p.surfacePlancher));
  }

  // 7. Engagement
  set('E1L_lieu', d.engagement.lieu);
  set('E1D_date', dateDigits(d.engagement.date));

  // Bordereau : DPC1, DPC2, DPC3, DPC4, DPC6, DPC7, DPC8
  checked.push('P5PA2', 'P5PB1', 'P3GE1', 'P3GD1', 'P3GF1', 'P3GG1', 'P3GH1');

  return { text, checked };
}

/** Remplit le Cerfa officiel ; `flatten` fige les champs (version intégrée au dossier). */
export async function fillCerfa(d: Dossier, template: ArrayBuffer, { flatten }: { flatten: boolean }): Promise<PDFDocument> {
  const pdf = await PDFDocument.load(template);
  const form = pdf.getForm();
  const { text, checked } = cerfaFieldValues(d);
  for (const [name, value] of Object.entries(text)) {
    const field = form.getFieldMaybe(name);
    if (!(field instanceof PDFTextField)) continue;
    // Les champs héritent d'une taille automatique : on la fixe pour la description, sinon le texte est démesuré.
    if (field.isMultiline()) field.acroField.setDefaultAppearance('/Helv 9 Tf 0 g');
    const max = field.getMaxLength();
    field.setText(max ? value.slice(0, max) : value);
  }
  for (const name of checked) {
    const field = form.getFieldMaybe(name);
    if (field instanceof PDFCheckBox) field.check();
  }
  if (flatten) {
    form.flatten();
    while (pdf.getPageCount() > KEPT_PAGES) pdf.removePage(pdf.getPageCount() - 1);
  }
  return pdf;
}

let template: Promise<ArrayBuffer> | null = null;
export function loadCerfaTemplate(): Promise<ArrayBuffer> {
  template ??= fetch(CERFA_URL).then((r) => {
    if (!r.ok) throw new Error('Formulaire Cerfa introuvable');
    return r.arrayBuffer();
  });
  return template;
}

/** JJMMAAAA, format des champs date « en peigne » du Cerfa. */
export function dateDigits(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}${m[2]}${m[1]}` : '';
}

const phoneDigits = (v: string) => v.replace(/\D/g, '').replace(/^33(?=\d{9}$)/, '0').slice(0, 10);
const num = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 2, useGrouping: false });
