# NASCO — Déclarations préalables du Pavillon N°1

Application web qui constitue le dossier complet de **déclaration préalable de travaux** (Cerfa n° 13703)
pour l'installation d'un Pavillon N°1 NASCO chez un client.

| Étape | Ce que fait l'application |
| --- | --- |
| Déclarant | Identité et coordonnées du client (rubriques 1 et 2 du Cerfa) |
| Terrain | Recherche d'adresse (Base Adresse Nationale), parcelle retrouvée automatiquement dans le cadastre (API Carto IGN) |
| Projet | Description, destination, surfaces — pré-remplies avec les caractéristiques du module |
| Implantation · DP2 | Plan de masse : module glissé/pivoté sur la parcelle, cotes aux limites, parcelles voisines et bâti existant, points de vue des photos |
| Photographies · DP7 / DP8 | Dépôt des photos, redimensionnées automatiquement |
| Insertion · DP6 | Photomontage dans le navigateur : placement, perspective par les 4 coins, ombre, réglages, masque au pinceau pour la végétation au premier plan |
| Dossier PDF | Page de garde, récapitulatif Cerfa, DP1 (1/25 000 et 1/5 000), DP2 coté à l'échelle, DP3 coupes et DP4 façades au 1/50, DP6, DP7, DP8 |

Les coupes, façades et le plan du module proviennent directement des fichiers DWG (`assets/dwg`),
convertis en SVG à l'échelle réelle par `npm run assets:module`.

## Lancer en local

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # tests unitaires (géométrie, perspective)
npm run lint && npm run typecheck
```

Sans configuration, l'application fonctionne en **mode local** : les dossiers et photos restent dans le
navigateur (IndexedDB). Pratique pour une démonstration, mais rien n'est partagé entre ordinateurs.

## Mise en ligne (pas à pas)

### 1. Supabase (base de données et photos)

1. Sur [supabase.com](https://supabase.com), ouvrir le projet (ou **New project**, région *West EU (Paris)*).
2. Menu **SQL Editor** → **New query** → coller le contenu de [`supabase/schema.sql`](supabase/schema.sql) → **Run**.
   Cela crée la table des dossiers et l'espace de stockage privé des photos.
3. Menu **Authentication → Users → Add user** : créer un compte (e-mail + mot de passe) pour chaque personne
   de l'équipe. Il n'y a pas d'inscription publique.
4. Menu **Project Settings → API** : copier **Project URL** et la clé **anon public**.

### 2. Vercel (hébergement)

1. Sur [vercel.com](https://vercel.com) : **Add New… → Project** → importer le dépôt `app-dp-nasco`.
2. Avant de cliquer sur **Deploy**, ouvrir **Environment Variables** et ajouter :
   - `NEXT_PUBLIC_SUPABASE_URL` = la *Project URL* copiée plus haut
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = la clé *anon public*
3. **Deploy**. L'adresse du site s'affiche à la fin ; on s'y connecte avec les comptes créés à l'étape 1.3.

Sans ces deux variables, le site déployé fonctionne quand même, en mode local.

## Architecture

```
src/
  app/                 pages (Next.js App Router) et routes /api/ign/* (relais vers l'IGN)
  components/steps/    une étape du dossier = un composant
  components/plan/     plan de masse (SVG partagé entre l'éditeur et le PDF)
  components/insertion éditeur de photomontage (canvas)
  lib/dossier.ts       modèle de données et contrôle de complétude
  lib/module.ts        caractéristiques fixes du Pavillon N°1
  lib/geo/             géométrie, projection locale, services IGN, cartes à l'échelle
  lib/pdf/             génération du dossier PDF (pdf-lib, dans le navigateur)
  lib/storage/         stockage local (IndexedDB) ou Supabase
scripts/
  dwg-to-svg.mjs       conversion des DWG du module en SVG (libredwg WebAssembly)
  insertion-sprites.mjs vues colorées du module pour le photomontage
supabase/schema.sql    tables, sécurité (RLS) et stockage
```

Données externes, toutes ouvertes et sans clé : Géoplateforme IGN (géocodage, Plan IGN, orthophotos,
BD TOPO), API Carto (cadastre PCI Express).

## Limites connues

- Le Cerfa n'est pas encore rempli dans le **formulaire officiel** : le PDF contient un récapitulatif
  rubrique par rubrique à reporter. Le remplissage automatique du PDF officiel est prévu (voir la PR).
- La façade arrière (N1) n'existe pas dans les DWG fournis ; DP4 présente N4, N2 et N3.
- Les réglages de luminosité et le flou de l'ombre du photomontage utilisent `ctx.filter`, non pris en
  charge par Safari (le montage reste possible, sans ces réglages).
- La police Univers est commerciale : l'interface utilise Univers si elle est installée sur le poste,
  sinon Archivo (licence libre OFL), et le PDF utilise Helvetica.
