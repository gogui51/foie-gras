# Foie gras maison

Un petit carnet de cuisine interactif, sans serveur ni compte utilisateur.

## Ce que fait la page

- Recalcule sel, poivre et sucre selon le poids de foie (base : 12 / 3 / 1 g par kilo).
- Présente les 10 gestes de la recette familiale, sous forme de checklist.
- Propose deux vues : toutes les étapes ou mode guidé.
- Fournit trois minuteurs indépendants : repos (1 h), immersion (30 à 45 min) et réfrigération (48 h).
- Mémorise les étapes et minuteurs avec `localStorage`. En rouvrant la page, le temps écoulé est recalculé.
- S'adapte au mobile et propose une mise en page imprimable.

**Limite technique :** sans serveur de notifications push, la sonnerie n'est pas garantie lorsque le navigateur ferme ou suspend la page. Le minuteur reste cependant calculé d'après l'heure réelle.

**Sécurité alimentaire :** les durées décrivent une recette familiale transmise par SMS et ne constituent pas un barème thermique validé. Se référer à un protocole de cuisson fiable pour maîtriser la température à cœur et l'hygiène.

## Déploiement sur GitHub Pages

1. Aller dans [Settings → Pages](https://github.com/gogui51/foie-gras/settings/pages).
2. Dans **Build and deployment → Source**, choisir **GitHub Actions**.
3. Ouvrir [Actions](https://github.com/gogui51/foie-gras/actions) et relancer le workflow **Publier le carnet de cuisine** s'il ne démarre pas automatiquement.

Le site doit ensuite être visible à l'adresse https://gogui51.github.io/foie-gras/.

## Organisation

- `index.html` : la recette, les cartes et les boutons.
- `style.css` : le design et le responsive.
- `app.js` : les calculs et minuteurs.
- `manifest.webmanifest` et `icon.svg` : paramètres d'affichage sur écran d'accueil.
- `.github/workflows/deploy.yml` : publication automatique à chaque modification sur la branche `main`.

Aucune donnée personnelle n'est envoyée à un serveur. Le navigateur stocke uniquement la progression sur l'appareil utilisé.
