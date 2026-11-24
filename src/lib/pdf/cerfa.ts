import type { PDFDocument } from 'pdf-lib';
import { formatAddress, parcelLabel, type Dossier } from '../dossier';
import { MODULE } from '../module';
import { A4_PORTRAIT, COLORS, MM, Sheet, type Fonts } from './sheet';

const DESTINATION_LABELS: Record<Dossier['projet']['destination'], string> = {
  habitation: 'Habitation — logement',
  annexe: 'Habitation — annexe à une construction existante',
  'hebergement-touristique': 'Commerce et activités de service — hébergement touristique',
};

type Row = [string, string];

/**
 * Récapitulatif des informations à porter sur le formulaire Cerfa n° 13703
 * (déclaration préalable — maison individuelle et/ou ses annexes), dans
 * l'ordre de ses rubriques.
 */
export async function cerfaPages(pdf: PDFDocument, fonts: Fonts, d: Dossier) {
  const decl = d.declarant;
  const p = d.projet;
  const fr = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
  const sections: { n: string; title: string; rows: Row[]; text?: string }[] = [
    {
      n: '1',
      title: 'Identité du déclarant',
      rows:
        decl.type === 'particulier'
          ? [
              ['Vous êtes un particulier', `${decl.civilite} ${decl.nom.toUpperCase()} ${decl.prenom}`.trim()],
              ['Date et lieu de naissance', [decl.dateNaissance && new Date(decl.dateNaissance).toLocaleDateString('fr-FR'), decl.lieuNaissance].filter(Boolean).join(' à ') || '—'],
            ]
          : [
              ['Vous êtes une personne morale', decl.denomination],
              ['N° SIRET', decl.siret],
              ['Représentant', `${decl.nom.toUpperCase()} ${decl.prenom}`.trim()],
            ],
    },
    {
      n: '2',
      title: 'Coordonnées du déclarant',
      rows: [
        ['Adresse', formatAddress(decl.adresse) || '—'],
        ['Téléphone', decl.telephone || '—'],
        ['Adresse électronique', decl.email || '—'],
        ['Accepte les envois électroniques', decl.accepteEmail ? 'Oui' : 'Non'],
      ],
    },
    {
      n: '3',
      title: 'Le terrain',
      rows: [
        ['Adresse du terrain', formatAddress(d.terrain.adresse) || '—'],
        ['Commune', `${d.terrain.commune} (code INSEE ${d.terrain.codeInsee})`],
        ...d.terrain.parcelles.map(
          (pc, i): Row => [`Parcelle ${i + 1} — préfixe / section / numéro`, `${pc.prefixe} / ${pc.section} / ${pc.numero} (${parcelLabel(pc)}) — ${fr(pc.contenance)} m²`],
        ),
        ['Superficie totale du terrain', `${fr(d.terrain.parcelles.reduce((s, x) => s + x.contenance, 0))} m²`],
      ],
    },
    {
      n: '4',
      title: 'Le projet',
      rows: [
        ['Nature des travaux', 'Nouvelle construction'],
        ['Destination', DESTINATION_LABELS[p.destination]],
        ['Emprise au sol créée', `${fr(p.emprise)} m²`],
        ['Hauteur maximale', `${fr(p.hauteur)} m`],
        ['Surface de plancher existante', `${fr(p.surfaceExistante)} m²`],
        ['Surface de plancher créée', `${fr(p.surfacePlancher)} m²`],
        ['Surface de plancher supprimée', '0 m²'],
        ['Surface de plancher totale après travaux', `${fr(p.surfaceExistante + p.surfacePlancher)} m²`],
        ['Raccordements', p.raccordements],
      ],
      text: p.description,
    },
    {
      n: '6',
      title: 'Engagement du déclarant',
      rows: [
        ['Lieu', d.engagement.lieu || '—'],
        ['Date', d.engagement.date ? new Date(d.engagement.date).toLocaleDateString('fr-FR') : '—'],
      ],
    },
    {
      n: '8',
      title: 'Éléments nécessaires au calcul des impositions',
      rows: [
        ['Surface taxable créée', `${fr(p.surfacePlancher)} m²`],
        ['Nombre de logements créés', p.destination === 'habitation' ? '1' : '0'],
        ['Places de stationnement créées', '0'],
        ['Type de construction', `Construction légère préfabriquée — ${MODULE.brand} ${MODULE.name}`],
      ],
    },
  ];

  let s = newPage(pdf, fonts, d, true);
  let y = 50;
  const W = 210 - 36;

  for (const sec of sections) {
    const need = 14 + sec.rows.length * 7 + (sec.text ? 26 : 0);
    if (y + need > 278) {
      s = newPage(pdf, fonts, d, false);
      y = 34;
    }
    s.rect(18, y - 5, 9, 7, { fill: COLORS.ink });
    s.text(22.5, y - 0.2, sec.n, { size: 9, bold: true, color: COLORS.cream, align: 'center' });
    s.text(30, y, sec.title, { size: 11, bold: true });
    y += 7;
    for (const [k, v] of sec.rows) {
      s.text(18, y, k, { size: 8, color: COLORS.muted });
      y = Math.max(y + 5.4, s.paragraph(92, y, W - 74, v || '—', { size: 9, leading: 4 }) + 1.4);
      s.line(18, y - 3.6, 18 + W, y - 3.6, { color: COLORS.line, width: 0.3 });
    }
    if (sec.text) {
      s.text(18, y + 1, 'Courte description du projet', { size: 8, color: COLORS.muted });
      y = s.paragraph(18, y + 6, W, sec.text, { size: 9, leading: 4.1 }) + 2;
    }
    y += 7;
  }
  // Cadre de signature
  if (y + 32 > 285) {
    s = newPage(pdf, fonts, d, false);
    y = 34;
  }
  s.paragraph(18, y, W, 'J’atteste avoir qualité pour faire la présente déclaration préalable et je certifie exacts les renseignements fournis.', { size: 8.5, leading: 3.8 });
  s.rect(124, y + 6, 68, 24, { stroke: COLORS.ink, width: 0.5 });
  s.text(127, y + 11, 'Signature du déclarant', { size: 7, color: COLORS.muted });
}

function newPage(pdf: PDFDocument, fonts: Fonts, d: Dossier, first: boolean) {
  const s = new Sheet(pdf.addPage(A4_PORTRAIT.map((v) => v * MM) as [number, number]), fonts);
  s.rect(0, 0, 210, 22, { fill: COLORS.cream });
  s.text(18, 14, 'NASCO.', { size: 12, bold: true, tracking: 0.8 });
  s.text(192, 10.5, 'Formulaire Cerfa n° 13703', { size: 8.5, bold: true, align: 'right' });
  s.text(192, 15, 'Données à reporter — déclaration préalable', { size: 7.5, align: 'right', color: COLORS.muted });
  if (first) {
    s.text(18, 34, 'Récapitulatif du formulaire', { size: 17, bold: true });
    s.paragraph(18, 40, 174, `Informations du dossier ${d.reference} classées selon les rubriques du Cerfa n° 13703. À reporter sur le formulaire officiel, à dater et à signer par le déclarant.`, { size: 8.5, leading: 3.8, color: COLORS.muted });
  }
  return s;
}
