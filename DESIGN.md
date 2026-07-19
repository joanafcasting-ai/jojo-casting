# DESIGN.md — Le Studio de Joana (v2 — Premium Dark)

Direction artistique de référence. **Toute modification UI doit respecter ce document.**
Aucune couleur, fonte ou composant hors de ce système sans validation explicite.

---

## Intention

Une salle de projection privée. L'app doit respirer le haut de gamme : noir chaud
en couches, lumière laiton, typographie de générique de film. Références :
rigueur d'Apple (espace, hiérarchie, retenue), précision de Linear (surfaces,
traits fins), élégance d'un site d'agence de talents de luxe.

Règle d'or du premium : **la discipline**. Une seule couleur d'accent, des
surfaces en couches, et l'information hiérarchisée par la typo — jamais par
l'accumulation de couleurs.

---

## Palette

### Neutres (structure en couches, du plus profond au plus clair)
| Rôle | Nom | Hex | Usage |
|---|---|---|---|
| Fond | Noir velours | `#0E0D0B` | Fond général (jamais #000 pur) |
| Surface 1 | Fusain | `#161411` | Sidebar, panneaux |
| Surface 2 | Graphite chaud | `#1E1B17` | Cards, lignes de liste, champs |
| Surface 3 | Hover | `#26221D` | Survol, ligne active |
| Trait | Charnière | `#2E2A24` | Bordures et séparateurs, 1px |
| Texte principal | Ivoire | `#F1EDE5` | Titres, noms |
| Texte secondaire | Fumée | `#989184` | Métadonnées, labels |
| Texte discret | Cendre | `#5F594F` | Placeholders, compteurs inactifs |

### Accent — un seul
| Rôle | Nom | Hex |
|---|---|---|
| Accent | Laiton | `#C6A567` |
| Accent hover | Laiton clair | `#D9BC82` |
| Accent sur fond | Laiton voilé | `rgba(198,165,103,0.12)` |

Le laiton est réservé à : l'action principale de l'écran (un seul bouton),
l'élément de navigation actif, le focus. **C'est tout.** S'il apparaît plus de
trois fois sur un écran, c'est trop.

### Statuts (pastilles et compteurs uniquement)
| Statut | Hex | Note |
|---|---|---|
| Oui / retenu·e | `#7C9E82` (sauge) | Éteint, jamais vert vif |
| Peut-être / en attente | `#A88D55` (ocre) | |
| Non / indisponible | `#9E6B60` (brique) | Jamais rouge vif |

### Interdits couleur
- Violet / indigo / purple — suppression totale (tags actuels compris)
- Bleu système (liens, icônes vidéo) → remplacé par Ivoire ou Laiton
- Gradients, glassmorphism, glow
- Doré saturé/jaune type `#E8C55F` → toujours Laiton `#C6A567`
- Plus d'une couleur d'accent par écran

---

## Typographie

Deux fontes. La hiérarchie se fait par la taille et la couleur, pas par le bold.

- **Display : Georgia** — noms de comédiens, titres de projets, titres de pages.
  Graisse 400, jamais bold au-dessus de 20px. C'est la signature de l'app :
  les noms se lisent comme un générique de film.
- **UI : Helvetica Neue** (fallback : -apple-system, Helvetica, Arial) — tout le reste.

### Échelle
| Usage | Fonte | Taille | Style |
|---|---|---|---|
| Titre de page | Georgia | 28px | 400, Ivoire |
| Nom de comédien (liste) | Georgia | 19px | 400, Ivoire |
| Nom de comédien (fiche) | Georgia | 26px | 400, Ivoire |
| Label de section / eyebrow | Helvetica | 11px | 600, majuscules, letter-spacing 0.1em, Fumée |
| Corps / UI | Helvetica | 14px | 400, Ivoire |
| Métadonnées | Helvetica | 13px | 400, Fumée |

- Un seul eyebrow espacé par écran maximum (pas de "CASTING DIRECTOR" décoratif
  dans le header — le nom du projet suffit).
- Interligne 1.5. Rien sous 11px.

---

## Photos de comédiens

- Portrait 3:4, `object-fit: cover`, `border-radius: 4px`
- Trait 1px Charnière autour, pas d'ombre
- En liste : vignette 56×72px alignée sur une grille stricte
- En grille (planche) : colonnes régulières, gouttières 20px, le nom en Georgia
  sous la photo, métadonnées en Fumée
- Placeholder sans photo : Surface 2 + initiales en Georgia Cendre — jamais
  d'icône générique

---

## Composants

- **Bouton principal** (1 par écran) : fond Laiton, texte Noir velours,
  `border-radius: 6px`, padding 9px 18px, Helvetica 14px 500.
- **Boutons secondaires** : fond transparent, trait 1px Charnière, texte Ivoire.
  Hover : fond Surface 3.
- **Champs & recherche** : fond Surface 2, trait Charnière, `border-radius: 6px`.
  Focus : trait Laiton, sans glow.
- **Filtres (pills)** : trait 1px, texte Fumée ; actif = texte Ivoire + trait
  Laiton. Pas de fond plein.
- **Tags de type (acteur, modèle…)** : texte Fumée 11px majuscules espacées,
  sans fond ni bordure. L'information suffit, pas besoin d'un badge coloré.
- **Compteurs de statut** : pastille 6px couleur statut + chiffre Ivoire +
  label Fumée.
- **Lignes de liste** : fond transparent, séparées par un trait Charnière 1px.
  Hover : Surface 3. Pas de cards flottantes pour les listes.
- **Sidebar** : fond Surface 1, item actif = texte Ivoire + barre verticale
  2px Laiton à gauche + fond Laiton voilé. Items inactifs : Fumée.
- **Étoiles de notation** : Cendre à vide, Laiton pleines.

---

## Espacement & mise en page

- Base 8px (8, 16, 24, 32, 48, 64)
- Sidebar : 240px fixe
- Contenu : max 1100px, marges latérales ≥ 40px
- Le vide est un matériau : les écrans premium sont aérés, jamais denses par défaut

---

## Interactions & mouvement

C'est ici que se joue le "interactif haut de gamme" — dans la micro-réactivité,
pas dans le spectaculaire :
- Transitions 160ms `cubic-bezier(0.25, 0.1, 0.25, 1)` sur couleur, opacité,
  et translations ≤ 2px
- Hover de ligne : fond Surface 3 + la vignette photo passe de 92% à 100%
  d'opacité — l'app "regarde" le comédien qu'on survole
- Apparition de contenu : fondu simple 160ms, sans slide ni scale
- **Interdits** : parallax, skeletons brillants, confettis, spring animations
  exagérées
- Respecter `prefers-reduced-motion`

---

## Ton & rédaction (UI en français)

- Verbes d'action explicites : "Ajouter un profil", pas "+ Ajouter"
- Sentence case, pas d'emojis dans l'UI
- Vocabulaire métier : comédien·ne, essai, dépouillement, retour — pas de
  jargon système
- Les erreurs disent quoi faire, sans s'excuser

---

## Interdits généraux (rappel)

- Plus d'un accent coloré par écran (le violet et le bleu actuels disparaissent)
- Bold systématique — la hiérarchie vient de la taille, de la fonte et de la couleur
- `border-radius` > 8px, pills pleines multicolores
- Ombres portées, glow, gradients
- Icônes décoratives sans fonction
- Toute densité de couleurs type "dashboard SaaS"
