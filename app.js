/* utils.js — outils de base : aléatoire, arrondis, format français des nombres.
 * Aucun accès au DOM. Tout est rangé dans l'espace de noms global MM. */
window.MM = window.MM || {};

(function (MM) {
  'use strict';

  var NBSP = ' ';   // espace insécable
  var MINUS = '−';  // vrai signe moins

  MM.NBSP = NBSP;

  /* ---------- Aléatoire ---------- */

  // Entier aléatoire entre a et b inclus.
  MM.randInt = function (a, b) {
    return a + Math.floor(Math.random() * (b - a + 1));
  };

  // Élément aléatoire d'un tableau.
  MM.pick = function (arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  };

  // Copie mélangée d'un tableau (Fisher-Yates).
  MM.shuffle = function (arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  };

  // Tirage pondéré : items = [{weight: 2, ...}, ...] -> un item.
  MM.pickWeighted = function (items) {
    var total = 0, i;
    for (i = 0; i < items.length; i++) total += items[i].weight;
    var r = Math.random() * total;
    for (i = 0; i < items.length; i++) {
      r -= items[i].weight;
      if (r <= 0) return items[i];
    }
    return items[items.length - 1];
  };

  /* ---------- Arrondis ---------- */

  // Arrondi à d décimales, sans les erreurs de virgule flottante (0,1 + 0,2...).
  MM.round = function (v, d) {
    var f = Math.pow(10, d || 0);
    return Math.round((v + (v >= 0 ? 1 : -1) * 1e-9) * f) / f;
  };

  // Arrondi à n chiffres significatifs (ex. sig(1234, 2) = 1200).
  MM.sig = function (v, n) {
    if (v === 0) return 0;
    return Number(Number(MM.round(v, 8)).toPrecision(n));
  };

  // Nombre de décimales d'un nombre (0 à 2).
  MM.decimals = function (v) {
    var r = MM.round(v, 2);
    if (Math.abs(r - Math.round(r)) < 1e-9) return 0;
    if (Math.abs(r * 10 - Math.round(r * 10)) < 1e-9) return 1;
    return 2;
  };


  // Rappelle fn() jusqu'à ce qu'elle renvoie une valeur "vraie" (max 500 essais).
  // Sert à tirer des paramètres qui respectent une condition (ex. résultat rond).
  MM.retry = function (fn) {
    for (var i = 0; i < 500; i++) {
      var r = fn();
      if (r) return r;
    }
    throw new Error('MM.retry : aucune combinaison valide trouvée');
  };

  // Vrai si v a au plus d décimales (ex. hasMaxDecimals(4.5, 1) = true).
  MM.hasMaxDecimals = function (v, d) {
    var f = Math.pow(10, d);
    return Math.abs(v * f - Math.round(v * f)) < 1e-7;
  };

  /* ---------- Format français ---------- */

  // 12500 -> "12 500" ; 12.5 -> "12,5" ; -4 -> "−4". Max 2 décimales.
  MM.fmtNum = function (v) {
    var r = MM.round(v, 2);
    var neg = r < 0;
    var parts = String(Math.abs(r)).split('.');
    var intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
    var s = parts.length > 1 ? intPart + ',' + parts[1] : intPart;
    return (neg ? MINUS : '') + s;
  };

  // Nombre + unité, tel qu'affiché dans les options.
  //  ''  -> "126"      '%' -> "15 %"      'x' -> "×1,5"      'M€' -> "84 M€"
  MM.fmtAnswer = function (v, unit) {
    var n = MM.fmtNum(v);
    if (!unit) return n;
    if (unit === 'x') return '×' + n;
    return n + NBSP + unit;
  };

  // Pourcentage dans un énoncé : 15 -> "15 %".
  MM.pct = function (v) {
    return MM.fmtNum(v) + NBSP + '%';
  };

})(window.MM);


/* distractors.js — fabrique les 3 mauvaises réponses et assemble la question.
 *
 * Principe : chaque générateur fournit des "erreurs plausibles" (calculées avec
 * la vraie erreur de méthode). Ici on complète avec des erreurs génériques
 * (décalage de virgule, voisin proche) puis on trie les 4 options par valeur. */
window.MM = window.MM || {};

(function (MM) {
  'use strict';

  var MAX_OPTION_LEN = 18;

  // Erreurs qui produisent volontairement de petits nombres décimaux (on garde 2 décimales).
  var GARDE_2_DECIMALES = {
    'decalage-virgule': 1, 'oubli-x100': 1, 'echelle': 1, 'decalage-puissance-de-10': 1
  };

  // Arrondit un candidat à la précision de la bonne réponse (même nombre de décimales),
  // pour que les 4 options aient toutes le même format.
  function snap(v, spec, type, answer) {
    if (spec.sig) return MM.sig(v, spec.sig);
    if (GARDE_2_DECIMALES[type]) return MM.round(v, 2);
    if (spec.dec !== undefined) return MM.round(v, spec.dec);
    if (answer === undefined) return MM.round(v, 2);
    var d = MM.decimals(answer);
    if (d === 0 && Math.abs(v) < 10) d = 1;
    return MM.round(v, d);
  }

  // Liste des erreurs génériques, de la plus "logique" à la moins logique.
  function genericErrors(answer) {
    var list = [
      { value: answer * 10, type: 'decalage-virgule' },
      { value: answer / 10, type: 'decalage-virgule' },
      { value: answer * 1.1, type: 'voisin-proche' },
      { value: answer * 0.9, type: 'voisin-proche' },
      { value: answer * 1.2, type: 'voisin-proche' },
      { value: answer * 0.8, type: 'voisin-proche' },
      { value: answer * 1.05, type: 'voisin-proche' },
      { value: answer * 0.95, type: 'voisin-proche' }
    ];
    // ± 1 sur le dernier chiffre significatif
    var step = Math.pow(10, Math.floor(Math.log(Math.abs(answer) || 1) / Math.LN10) - 1);
    if (step < 0.01) step = 0.01;
    list.push({ value: answer + step, type: 'voisin-proche' });
    list.push({ value: answer - step, type: 'voisin-proche' });
    list.push({ value: answer + 2 * step, type: 'voisin-proche' });
    list.push({ value: answer - 2 * step, type: 'voisin-proche' });
    return list;
  }

  /* Construit la question complète.
   * spec = { category, level, text, unit, params, answer, errors:[{value,type}],
   *          explanation, trick, sig (facultatif : chiffres significatifs) } */
  MM.buildQuestion = function (spec) {
    var unit = spec.unit || '';
    var answer = snap(spec.answer, spec, 'correct');
    var fmt = function (v) { return MM.fmtAnswer(v, unit); };

    var chosen = [{ v: answer, str: fmt(answer), correct: true, type: 'correct' }];
    var seen = {};
    seen[chosen[0].str] = true;

    // Un candidat est-il acceptable ?
    function accept(c) {
      var v = snap(c.value, spec, c.type, answer);
      if (!isFinite(v) || isNaN(v)) return false;
      if (answer > 0 && v <= 0) return false;       // pas de négatif si réponse positive
      if (answer !== 0 && v === 0) return false;
      var str = fmt(v);
      if (seen[str] || str.length > MAX_OPTION_LEN) return false;
      seen[str] = true;
      chosen.push({ v: v, str: str, correct: false, type: c.type });
      return true;
    }

    // 1) erreurs propres à la catégorie (3 au maximum, dans un ordre aléatoire)
    var specific = MM.shuffle(spec.errors || []);
    for (var i = 0; i < specific.length && chosen.length < 4; i++) accept(specific[i]);

    // 2) erreurs génériques
    var generic = genericErrors(answer);
    for (var j = 0; j < generic.length && chosen.length < 4; j++) accept(generic[j]);

    // 3) filet de sécurité : on s'éloigne pas à pas
    var k = 1;
    while (chosen.length < 4 && k < 500) {
      var big = Math.max(Math.abs(answer), 1);
      accept({ value: answer + k * big * 0.07, type: 'voisin-proche' });
      if (chosen.length < 4) accept({ value: answer - k * big * 0.07, type: 'voisin-proche' });
      k++;
    }

    // Ordre aléatoire : la bonne réponse tombe sur chacun des 4 boutons avec la même probabilité.
    // (L'ancien tri par valeur croissante la plaçait presque toujours en haut, car la plupart
    // des erreurs fabriquées sont plus grandes que la bonne réponse.)
    chosen = MM.shuffle(chosen);

    var options = [], values = [], types = [], correctIndex = 0;
    for (var m = 0; m < chosen.length; m++) {
      options.push(chosen[m].str);
      values.push(chosen[m].v);
      types.push(chosen[m].type);
      if (chosen[m].correct) correctIndex = m;
    }

    return {
      category: spec.category,
      level: spec.level,
      text: spec.text,
      unit: unit,
      params: spec.params,
      answer: answer,
      options: options,
      correctIndex: correctIndex,
      explanation: spec.explanation,
      trick: spec.trick || '',
      optionValues: values,   // pour les tests
      optionTypes: types      // type d'erreur de chaque option (pour les stats)
    };
  };

})(window.MM);


/* pourcentages.js — catégorie 1 : x % d'un nombre, part d'un total, % de %.
 * Pour modifier les plages de nombres, change les constantes ci-dessous. */
window.MM = window.MM || {};
MM.generators = MM.generators || {};

(function (MM) {
  'use strict';

  // ---- Plages (faciles à modifier) ----
  var PCT_NIVEAU1 = [10, 20, 50];
  var PCT_NIVEAU2 = [1, 5, 10, 15, 20, 25, 30, 33, 40, 50, 75];
  var PCT_NIVEAU3 = [15, 35, 45, 65];            // 15 ou 35 % de nombres à 3 chiffres
  var PARTS = [5, 10, 12.5, 15, 20, 25, 30, 40, 60, 75];   // parts (en %) pour "part d'un total"
  var TOTAUX = [200, 400, 500, 800, 1000, 1200];
  var PCT_DE_PCT = [10, 20, 25, 30, 40, 50, 60, 75];

  var n = MM.fmtNum;

  // Explication par pourcentage : la méthode rapide.
  function explique(p, b, ans) {
    var d10 = n(b / 10), d1 = n(b / 100);
    var map = {
      1: ['1 % = ÷ 100 : ' + n(b) + ' ÷ 100 = ' + n(ans) + '.', '1 % = ÷ 100.'],
      5: ['5 % = moitié de 10 % = ' + d10 + ' ÷ 2 = ' + n(ans) + '.', '5 % = la moitié de 10 %.'],
      10: ['10 % = on décale la virgule : ' + n(ans) + '.', '10 % = décaler la virgule.'],
      15: ['15 % = 10 % + 5 % = ' + d10 + ' + ' + n(b / 20) + ' = ' + n(ans) + '.', '15 % = 10 % + 5 %.'],
      20: ['20 % = 2 × 10 % = 2 × ' + d10 + ' = ' + n(ans) + '.', '20 % = 2 × 10 %.'],
      25: ['25 % = ÷ 4 : ' + n(b) + ' ÷ 4 = ' + n(ans) + '.', '25 % = ÷ 4.'],
      30: ['30 % = 3 × 10 % = 3 × ' + d10 + ' = ' + n(ans) + '.', '30 % = 3 × 10 %.'],
      33: ['33 % = 3 × 10 % + 3 × 1 % = ' + n(3 * b / 10) + ' + ' + n(3 * b / 100) + ' = ' + n(ans) + '.', '33 % ≈ un tiers.'],
      35: ['35 % = 3 × 10 % + 5 % = ' + n(3 * b / 10) + ' + ' + n(b / 20) + ' = ' + n(ans) + '.', '35 % = 3 × 10 % + 5 %.'],
      40: ['40 % = 4 × 10 % = 4 × ' + d10 + ' = ' + n(ans) + '.', '40 % = 4 × 10 %.'],
      45: ['45 % = 50 % − 5 % = ' + n(b / 2) + ' − ' + n(b / 20) + ' = ' + n(ans) + '.', '45 % = 50 % − 5 %.'],
      50: ['50 % = ÷ 2 : ' + n(b) + ' ÷ 2 = ' + n(ans) + '.', '50 % = la moitié.'],
      65: ['65 % = 50 % + 15 % = ' + n(b / 2) + ' + ' + n(1.5 * b / 10) + ' = ' + n(ans) + '.', '65 % = 50 % + 10 % + 5 %.'],
      75: ['75 % = base − 25 % = ' + n(b) + ' − ' + n(b / 4) + ' = ' + n(ans) + '.', '75 % = 100 % − 25 %.']
    };
    return map[p] || [n(p) + ' % de ' + n(b) + ' = ' + n(p) + ' × ' + d1 + ' = ' + n(ans) + '.', ''];
  }

  // ---- Types de questions ----

  function qPctDe(level) {
    var liste = level === 1 ? PCT_NIVEAU1 : (level === 2 ? PCT_NIVEAU2 : PCT_NIVEAU3);
    var t = MM.retry(function () {
      var p = MM.pick(liste);
      var b = level === 1 ? MM.randInt(2, 90) * 10 :
              level === 2 ? MM.pick([40, 60, 80, 120, 150, 200, 240, 300, 360, 450, 500, 640, 800]) :
                            MM.randInt(10, 49) * 20;            // 3 chiffres, multiple de 20
      if (level === 3 && b < 100) return null;
      return (p * b) % 10 === 0 ? { p: p, b: b } : null;   // résultat à 1 décimale max
    });
    var ans = t.b * t.p / 100;
    var unitBase = (level > 1 && Math.random() < 0.5) ? MM.pick(['M€', 'k€', 'Md€']) : '';
    var ex = explique(t.p, t.b, ans);
    return MM.buildQuestion({
      category: 'pourcentages', level: level,
      text: MM.pct(t.p) + ' de ' + n(t.b) + (unitBase ? MM.NBSP + unitBase : '') + ' ?',
      unit: unitBase,
      params: { kind: 'pctDe', pct: t.p, base: t.b },
      answer: ans,
      errors: [
        { value: t.b - ans, type: 'complement' },          // a pris (100 − x) %
        { value: t.b + ans, type: 'ajout-au-lieu-de-prendre' },
        { value: ans * 10, type: 'decalage-virgule' }
      ],
      explanation: ex[0], trick: ex[1]
    });
  }

  function qPart(level) {
    var t = MM.retry(function () {
      var p = MM.pick(PARTS), tot = MM.pick(TOTAUX);
      var a = tot * p / 100;
      return a === Math.round(a) ? { p: p, tot: tot, a: a } : null;
    });
    return MM.buildQuestion({
      category: 'pourcentages', level: level,
      text: n(t.a) + ' clients sur ' + n(t.tot) + '. Part en % ?',
      unit: '%',
      params: { kind: 'part', a: t.a, tot: t.tot },
      answer: t.p,
      errors: [
        { value: t.p / 100, type: 'oubli-x100' },           // a/T sans ×100
        { value: (t.tot / t.a) * 100, type: 'fraction-inversee' },
        { value: 100 - t.p, type: 'complement' }
      ],
      explanation: n(t.a) + ' / ' + n(t.tot) + ' = ' + n(t.p) + ' % (10 % de ' + n(t.tot) + ' = ' + n(t.tot / 10) + ').',
      trick: 'Part = partie ÷ total, puis × 100.'
    });
  }

  function qPctDePct() {
    var t = MM.retry(function () {
      var p1 = MM.pick(PCT_DE_PCT), p2 = MM.pick(PCT_DE_PCT), b = MM.randInt(2, 10) * 100;
      var ans = b * p1 * p2 / 10000;
      return MM.hasMaxDecimals(ans, 1) ? { p1: p1, p2: p2, b: b, ans: ans } : null;
    });
    return MM.buildQuestion({
      category: 'pourcentages', level: 3,
      text: MM.pct(t.p1) + ' de ' + MM.pct(t.p2) + ' de ' + n(t.b) + ' ?',
      unit: '',
      params: { kind: 'pctDePct', p1: t.p1, p2: t.p2, b: t.b },
      answer: t.ans,
      errors: [
        { value: t.b * (t.p1 + t.p2) / 100, type: 'addition-des-pourcentages' },
        { value: t.b * t.p2 / 100, type: 'une-seule-etape' },
        { value: t.b * t.p1 * t.p2 / 1000, type: 'decalage-virgule' }
      ],
      explanation: MM.pct(t.p2) + ' de ' + n(t.b) + ' = ' + n(t.b * t.p2 / 100) + ', puis ' + MM.pct(t.p1) +
        ' de ça = ' + n(t.ans) + '.',
      trick: 'Un % de % se calcule en deux étapes, jamais en additionnant les taux.'
    });
  }

  function generate(level) {
    if (level === 1) return qPctDe(1);
    if (level === 2) return Math.random() < 0.7 ? qPctDe(2) : qPart(2);
    var r = Math.random();
    return r < 0.4 ? qPctDe(3) : (r < 0.6 ? qPart(3) : qPctDePct());
  }

  // Recalcul indépendant de la réponse à partir des paramètres.
  function recompute(q) {
    var p = q.params;
    if (p.kind === 'pctDe') return (p.pct / 100) * p.base;
    if (p.kind === 'part') return (p.a * 100) / p.tot;
    return (p.b * p.p1 / 100) * p.p2 / 100;
  }

  MM.generators['pourcentages'] = { generate: generate, recompute: recompute };
})(window.MM);


/* fractions.js — catégorie 2 : fraction vers %, % vers dénominateur, fraction d'un nombre. */
window.MM = window.MM || {};
MM.generators = MM.generators || {};

(function (MM) {
  'use strict';

  // ---- Plages (faciles à modifier) : [numérateur, dénominateur] ----
  var FRAC_NIVEAU1 = [[1, 2], [1, 4], [3, 4], [1, 5], [2, 5], [1, 10], [3, 10]];
  var FRAC_NIVEAU2 = [[1, 8], [3, 8], [5, 8], [7, 8], [1, 3], [2, 3], [1, 6], [1, 20]];
  var FRAC_NIVEAU3 = [[3, 8], [1, 7], [5, 6], [7, 9], [1, 9], [2, 7], [5, 7], [4, 9], [1, 6], [3, 7]];
  // pour "1 / ? ≈ x %" : [dénominateur, pourcentage affiché]
  var INVERSES_NIVEAU1 = [[2, 50], [4, 25], [5, 20], [10, 10]];
  var INVERSES_NIVEAU2 = [[8, 12.5], [3, 33.3], [6, 16.7], [20, 5], [12, 8.3]];
  var INVERSES_NIVEAU3 = [[7, 14.3], [9, 11.1], [6, 16.7], [8, 12.5], [12, 8.3]];

  var n = MM.fmtNum;

  function fracVersPct(level) {
    var liste = level === 1 ? FRAC_NIVEAU1 : (level === 2 ? FRAC_NIVEAU2 : FRAC_NIVEAU3);
    var f = MM.pick(liste), num = f[0], den = f[1];
    var ans = MM.round(num / den * 100, 1);
    var errs = [
      { value: 100 / den, type: 'oubli-du-numerateur' },
      { value: 100 - ans, type: 'complement' },
      { value: MM.round(num / (den + 1) * 100, 1), type: 'mauvais-denominateur' }
    ];
    return MM.buildQuestion({
      category: 'fractions', level: level,
      text: num + '/' + den + ' en % ?', unit: '%',
      params: { kind: 'fracPct', num: num, den: den },
      answer: ans, errors: errs,
      explanation: '1/' + den + ' ≈ ' + n(MM.round(100 / den, 1)) + ' %' +
        (num > 1 ? ', donc ' + num + '/' + den + ' = ' + num + ' × ' + n(MM.round(100 / den, 1)) + ' ≈ ' + n(ans) + ' %.' : '.'),
      trick: '1/8 = 12,5 % ; 1/6 ≈ 16,7 % ; 1/7 ≈ 14,3 % ; 1/9 ≈ 11,1 %.'
    });
  }

  function pctVersDen(level) {
    var liste = level === 1 ? INVERSES_NIVEAU1 : (level === 2 ? INVERSES_NIVEAU2 : INVERSES_NIVEAU3);
    var f = MM.pick(liste), den = f[0], pct = f[1];
    var symbole = (pct === 50 || pct === 25 || pct === 20 || pct === 10 || pct === 12.5 || pct === 5) ? '=' : '≈';
    return MM.buildQuestion({
      category: 'fractions', level: level,
      text: '1 / ? ' + symbole + ' ' + MM.pct(pct) + ' (dénominateur ?)', unit: '',
      params: { kind: 'invDen', den: den, pct: pct },
      answer: den,
      errors: [
        { value: den + 1, type: 'voisin-proche' },
        { value: den - 1, type: 'voisin-proche' },
        { value: den * 2, type: 'facteur-2' }
      ],
      explanation: '100 ÷ ' + den + ' ≈ ' + n(MM.round(100 / den, 1)) + ', donc 1/' + den + '.',
      trick: 'Dénominateur = 100 ÷ pourcentage.'
    });
  }

  function fracDe(level) {
    var liste = level === 1 ? [[1, 2], [1, 4], [1, 5]] :
                level === 2 ? [[3, 4], [2, 5], [3, 10], [1, 8]] :
                              [[3, 8], [5, 6], [7, 9], [2, 3]];
    var f = MM.pick(liste), num = f[0], den = f[1];
    var mult = level === 1 ? MM.randInt(2, 20) * 10 : MM.randInt(2, 12) * (level === 2 ? 10 : 8);
    var b = den * mult;   // b est un multiple du dénominateur : résultat entier
    var ans = b / den * num;
    return MM.buildQuestion({
      category: 'fractions', level: level,
      text: num + '/' + den + ' de ' + n(b) + ' ?', unit: '',
      params: { kind: 'fracDe', num: num, den: den, b: b },
      answer: ans,
      errors: [
        { value: b / den, type: 'oubli-du-numerateur' },
        { value: b * den / num, type: 'fraction-inversee' },
        { value: b - ans, type: 'complement' }
      ],
      explanation: n(b) + ' ÷ ' + den + ' = ' + n(b / den) + (num > 1 ? ', puis × ' + num + ' = ' + n(ans) : '') + '.',
      trick: 'Diviser par le dénominateur, multiplier par le numérateur.'
    });
  }

  function generate(level) {
    var r = Math.random();
    if (level === 1) return r < 0.6 ? fracVersPct(1) : (r < 0.8 ? pctVersDen(1) : fracDe(1));
    if (level === 2) return r < 0.5 ? fracVersPct(2) : (r < 0.75 ? pctVersDen(2) : fracDe(2));
    return r < 0.5 ? fracVersPct(3) : (r < 0.7 ? pctVersDen(3) : fracDe(3));
  }

  function recompute(q) {
    var p = q.params;
    if (p.kind === 'fracPct') return MM.round((100 * p.num) / p.den, 1);
    if (p.kind === 'invDen') return p.den;
    return (p.b * p.num) / p.den;
  }

  MM.generators['fractions'] = { generate: generate, recompute: recompute };
})(window.MM);


/* multiplications.js — catégorie 3 : produits, × 5 / 25 / 11 / 12,5, carrés, (a−b)(a+b), divisions. */
window.MM = window.MM || {};
MM.generators = MM.generators || {};

(function (MM) {
  'use strict';

  var n = MM.fmtNum;

  // ---- Types de questions ----

  // 2 chiffres × 1 chiffre (47 × 6)
  function mul21(level) {
    var a = level === 1 ? MM.randInt(12, 49) : MM.randInt(23, 98);
    var b = MM.randInt(3, 9);
    var d = Math.floor(a / 10) * 10, u = a % 10;
    return MM.buildQuestion({
      category: 'multiplications', level: level,
      text: a + ' × ' + b + ' ?', unit: '',
      params: { kind: 'mul', a: a, b: b },
      answer: a * b,
      errors: [
        { value: d * b + u, type: 'unites-non-multipliees' },
        { value: a * b + 10, type: 'retenue-oubliee' },
        { value: a * (b + 1), type: 'mauvais-multiplicateur' }
      ],
      explanation: a + ' × ' + b + ' = ' + d + ' × ' + b + ' + ' + u + ' × ' + b + ' = ' + (d * b) + ' + ' + (u * b) + ' = ' + (a * b) + '.',
      trick: 'Décomposer : dizaines d\'abord, unités ensuite.'
    });
  }

  // × 5, × 25, × 11, × 12,5
  function multSpeciale(level) {
    var mult = level === 1 ? 5 : MM.pick([5, 25, 11, 12.5]);
    var a;
    if (mult === 5) a = MM.randInt(12, level === 1 ? 60 : 98);
    else if (mult === 25) a = MM.randInt(3, 24) * 4;
    else if (mult === 11) a = MM.randInt(12, 89);
    else a = MM.randInt(2, 16) * 8;
    var ans = a * mult;
    var expl, trick;
    if (mult === 5) { expl = a + ' × 5 = ' + a + ' × 10 ÷ 2 = ' + (a * 10) + ' ÷ 2 = ' + n(ans) + '.'; trick = '× 5 = × 10 puis ÷ 2.'; }
    else if (mult === 25) { expl = a + ' × 25 = ' + a + ' × 100 ÷ 4 = ' + (a * 100) + ' ÷ 4 = ' + n(ans) + '.'; trick = '× 25 = × 100 puis ÷ 4.'; }
    else if (mult === 11) { expl = a + ' × 11 = ' + a + ' × 10 + ' + a + ' = ' + (a * 10) + ' + ' + a + ' = ' + n(ans) + '.'; trick = '× 11 = × 10 + le nombre.'; }
    else { expl = a + ' × 12,5 = ' + a + ' × 100 ÷ 8 = ' + n(a * 100) + ' ÷ 8 = ' + n(ans) + '.'; trick = '× 12,5 = × 100 puis ÷ 8.'; }
    return MM.buildQuestion({
      category: 'multiplications', level: level,
      text: a + ' × ' + n(mult) + ' ?', unit: '',
      params: { kind: 'mul', a: a, b: mult },
      answer: ans,
      errors: [
        { value: a * mult * 10, type: 'oubli-de-la-division' },
        { value: a * mult / 2, type: 'division-en-trop' },
        { value: a * (mult === 11 ? 10 : mult) + (mult === 11 ? 0 : a), type: 'mauvaise-decomposition' }
      ],
      explanation: expl, trick: trick
    });
  }

  // 2 chiffres × 2 chiffres
  function mul22(level) {
    var a = MM.randInt(level === 2 ? 12 : 23, level === 2 ? 39 : 89);
    var b = MM.randInt(level === 2 ? 11 : 12, level === 2 ? 29 : 49);
    var bd = Math.floor(b / 10) * 10, bu = b % 10;
    return MM.buildQuestion({
      category: 'multiplications', level: level,
      text: a + ' × ' + b + ' ?', unit: '',
      params: { kind: 'mul', a: a, b: b },
      answer: a * b,
      errors: [
        { value: a * bd + bu, type: 'unites-non-multipliees' },
        { value: a * (b - 1), type: 'mauvais-multiplicateur' },
        { value: a * b + a, type: 'mauvais-multiplicateur' }
      ],
      explanation: a + ' × ' + b + ' = ' + a + ' × ' + bd + ' + ' + a + ' × ' + bu + ' = ' + (a * bd) + ' + ' + (a * bu) + ' = ' + (a * b) + '.',
      trick: 'Décomposer le 2e nombre : dizaines puis unités.'
    });
  }

  // Carré d'un nombre finissant par 5 (35² = 1 225)
  function carre5() {
    var d = MM.randInt(1, 9);                 // chiffre des dizaines
    var a = d * 10 + 5;
    return MM.buildQuestion({
      category: 'multiplications', level: 3,
      text: a + '² ?', unit: '',
      params: { kind: 'carre5', a: a },
      answer: a * a,
      errors: [
        { value: d * d * 100 + 25, type: 'dizaine-au-carre' },
        { value: d * (d + 1) * 100 + 5, type: 'oubli-du-25' },
        { value: d * (d + 2) * 100 + 25, type: 'mauvaise-dizaine' }
      ],
      explanation: a + '² = (' + d + ' × ' + (d + 1) + ') puis 25 = ' + (d * (d + 1)) + '25 = ' + n(a * a) + '.',
      trick: 'Nombre finissant par 5 : dizaine × (dizaine + 1), puis on colle 25.'
    });
  }

  // (a − b)(a + b) : 48 × 52 = 50² − 2²
  function diffCarres() {
    var c = MM.randInt(2, 9) * 10, e = MM.randInt(1, 5);
    var x = c - e, y = c + e;
    return MM.buildQuestion({
      category: 'multiplications', level: 3,
      text: x + ' × ' + y + ' ?', unit: '',
      params: { kind: 'diffCarres', c: c, e: e },
      answer: x * y,
      errors: [
        { value: c * c + e * e, type: 'signe-inverse' },
        { value: c * c, type: 'oubli-du-carre-de-lecart' },
        { value: c * c - e, type: 'ecart-non-eleve-au-carre' }
      ],
      explanation: x + ' × ' + y + ' = ' + c + '² − ' + e + '² = ' + n(c * c) + ' − ' + (e * e) + ' = ' + n(x * y) + '.',
      trick: '(c − e)(c + e) = c² − e².'
    });
  }

  // Division exacte (÷ 5, ÷ 25, ÷ 4, ÷ 8)
  function division(level) {
    var d = level === 1 ? 5 : MM.pick([5, 25, 4, 8, 50]);
    var q = MM.randInt(12, level === 1 ? 90 : 240);
    var N = q * d;
    var trick = d === 5 ? '÷ 5 = × 2 puis ÷ 10.' : (d === 25 ? '÷ 25 = × 4 puis ÷ 100.' : (d === 50 ? '÷ 50 = × 2 puis ÷ 100.' : '÷ ' + d + ' = diviser par 2 ' + (d === 4 ? 'deux fois.' : 'trois fois.')));
    return MM.buildQuestion({
      category: 'multiplications', level: level,
      text: n(N) + ' ÷ ' + d + ' ?', unit: '',
      params: { kind: 'div', N: N, d: d },
      answer: q,
      errors: [
        { value: N / (d * 2), type: 'diviseur-double' },
        { value: q * 2, type: 'division-par-moitie' },
        { value: q * 10, type: 'decalage-virgule' }
      ],
      explanation: n(N) + ' ÷ ' + d + ' = ' + n(q) + '.', trick: trick
    });
  }

  function generate(level) {
    var r = Math.random();
    if (level === 1) return r < 0.6 ? mul21(1) : (r < 0.85 ? multSpeciale(1) : division(1));
    if (level === 2) return r < 0.3 ? mul21(2) : (r < 0.55 ? mul22(2) : (r < 0.85 ? multSpeciale(2) : division(2)));
    return r < 0.3 ? mul22(3) : (r < 0.5 ? carre5() : (r < 0.75 ? diffCarres() : (r < 0.9 ? multSpeciale(3) : division(3))));
  }

  function recompute(q) {
    var p = q.params;
    if (p.kind === 'mul') return (p.a * p.b * 2) / 2;
    if (p.kind === 'carre5') { var d = (p.a - 5) / 10; return d * (d + 1) * 100 + 25; }
    if (p.kind === 'diffCarres') return p.c * p.c - p.e * p.e;
    return p.N / p.d;
  }

  MM.generators['multiplications'] = { generate: generate, recompute: recompute };
})(window.MM);


/* grands-nombres.js — catégorie 4 : k / M / Md, conversions de période.
 * Rappel : on n'écrit jamais "billion" (le billion anglais vaut un milliard). */
window.MM = window.MM || {};
MM.generators = MM.generators || {};

(function (MM) {
  'use strict';

  // ---- Plages (faciles à modifier) ----
  var N1_FACTEURS = [2, 3, 4, 5, 6, 8, 9];
  var N2_MULTIPLICATEURS = [5, 12, 15, 20, 25, 30, 35, 40, 50, 60];
  var N3_DIVISEURS = [6, 12, 15, 20, 24, 30, 40, 60];
  var SEMAINE_K = [25, 50, 100, 150, 200, 250, 300, 500];   // k€ par semaine
  var JOUR_K = [4, 8, 12, 20, 40];                          // k€ par jour ouvré
  var MOIS_K = [50, 75, 100, 125, 250];                     // k€ par mois

  var n = MM.fmtNum;
  var SP = MM.NBSP;

  // 3 M × 4  ->  12 M
  function mulSimple() {
    var a = MM.pick(N1_FACTEURS), b = MM.pick(N1_FACTEURS);
    var u = MM.pick(['M€', 'M', 'Md€']);
    return MM.buildQuestion({
      category: 'grands-nombres', level: 1,
      text: a + SP + u + ' × ' + b + ' ?', unit: u,
      params: { kind: 'mulSimple', a: a, b: b },
      answer: a * b,
      errors: [
        { value: a + b, type: 'addition-au-lieu-de-multiplication' },
        { value: a * b * 10, type: 'decalage-virgule' },
        { value: a * b / 10, type: 'decalage-virgule' }
      ],
      explanation: a + ' × ' + b + ' = ' + (a * b) + ', l\'unité (' + u + ') ne change pas.',
      trick: 'On multiplie les nombres, on garde l\'unité.'
    });
  }

  // 2,4 M × 35  ->  84 M
  function mulDecimal(level) {
    var t = MM.retry(function () {
      var a = MM.randInt(12, 98) / 10, b = MM.pick(N2_MULTIPLICATEURS);
      return MM.hasMaxDecimals(a * b, 1) ? { a: a, b: b } : null;
    });
    var u = MM.pick(['M€', 'k€', 'M']);
    return MM.buildQuestion({
      category: 'grands-nombres', level: level,
      text: n(t.a) + SP + u + ' × ' + t.b + ' ?', unit: u,
      params: { kind: 'mulDecimal', a: t.a, b: t.b },
      answer: t.a * t.b,
      errors: [
        { value: t.a * t.b / 10, type: 'decalage-virgule' },
        { value: t.a * t.b * 10, type: 'decalage-virgule' },
        { value: t.a * (t.b - 5), type: 'mauvais-multiplicateur' }
      ],
      explanation: n(t.a) + ' × ' + t.b + ' = ' + n(t.a * t.b) + ' (' + n(t.a) + ' × ' + t.b + ' = ' + n(t.a * 10) + ' × ' + t.b + ' ÷ 10).',
      trick: 'Enlever la virgule, multiplier, remettre la virgule.'
    });
  }

  // 1,8 Md€ ÷ 60  ->  30 M€
  function divMdVersM() {
    var t = MM.retry(function () {
      var a = MM.randInt(12, 96) / 10, d = MM.pick(N3_DIVISEURS);
      return MM.hasMaxDecimals(a * 1000 / d, 1) ? { a: a, d: d } : null;
    });
    var ans = t.a * 1000 / t.d;
    return MM.buildQuestion({
      category: 'grands-nombres', level: 3,
      text: n(t.a) + SP + 'Md€ ÷ ' + t.d + ', en M€ ?', unit: 'M€',
      params: { kind: 'divMd', a: t.a, d: t.d },
      answer: ans,
      errors: [
        { value: t.a / t.d, type: 'echelle' },               // reste en Md€
        { value: ans * 1000, type: 'echelle' },
        { value: ans / 10, type: 'decalage-virgule' }
      ],
      explanation: n(t.a) + ' Md€ = ' + n(t.a * 1000) + ' M€ ; ' + n(t.a * 1000) + ' ÷ ' + t.d + ' = ' + n(ans) + ' M€.',
      trick: '1 Md = 1 000 M : convertir avant de diviser.'
    });
  }

  // Conversion de période : par semaine / jour ouvré / mois -> par an
  function periode(level) {
    var type = MM.pick(['semaine', 'jour', 'mois']);
    var v, mult, libelle, bad, badLabel;
    if (type === 'semaine') { v = MM.pick(SEMAINE_K); mult = 52; libelle = 'semaine'; bad = 50; badLabel = '50 semaines'; }
    else if (type === 'jour') { v = MM.pick(JOUR_K); mult = 250; libelle = 'jour ouvré'; bad = 365; badLabel = '365 jours'; }
    else { v = MM.pick(MOIS_K); mult = 12; libelle = 'mois'; bad = 10; badLabel = '10 mois'; }
    var ans = v * mult / 1000;   // en M€
    var regle = type === 'semaine' ? '52 semaines' : (type === 'jour' ? 'environ 250 jours ouvrés' : '12 mois');
    return MM.buildQuestion({
      category: 'grands-nombres', level: level,
      text: v + SP + 'k€ par ' + libelle + ' : combien par an, en M€ ?', unit: 'M€',
      params: { kind: 'periode', v: v, mult: mult },
      answer: ans,
      errors: [
        { value: v * bad / 1000, type: 'mauvaise-periode' },
        { value: v * mult, type: 'echelle' },                // oublie de passer de k€ à M€
        { value: v * mult / 100, type: 'echelle' }
      ],
      explanation: v + ' k€ × ' + mult + ' (' + regle + ') = ' + n(v * mult) + ' k€ = ' + n(ans) + ' M€.',
      trick: '52 semaines, environ 250 jours ouvrés, 12 mois ; 1 000 k€ = 1 M€.'
    });
  }

  function generate(level) {
    var r = Math.random();
    if (level === 1) return mulSimple();
    if (level === 2) return r < 0.55 ? mulDecimal(2) : periode(2);
    return r < 0.35 ? divMdVersM() : (r < 0.65 ? mulDecimal(3) : periode(3));
  }

  function recompute(q) {
    var p = q.params;
    if (p.kind === 'mulSimple' || p.kind === 'mulDecimal') return MM.round(p.a * p.b, 6);
    if (p.kind === 'divMd') return MM.round((p.a * 1000) / p.d, 6);
    return MM.round((p.v * p.mult) / 1000, 6);
  }

  MM.generators['grands-nombres'] = { generate: generate, recompute: recompute };
})(window.MM);


/* variations.js — catégorie 5 : hausse/baisse en %, variations enchaînées,
 * retrouver la base, points de pourcentage contre pourcentage relatif. */
window.MM = window.MM || {};
MM.generators = MM.generators || {};

(function (MM) {
  'use strict';

  // ---- Plages (faciles à modifier) ----
  var TAUX_N1 = [10, 20, 50];
  var TAUX_N2 = [5, 10, 15, 20, 25, 30, 40];
  var TAUX_BASE = [10, 20, 25, 40, 50];          // pour retrouver la base
  var TAUX_ENCHAINES = [10, 20, 25, 50];
  // paires [avant, après] en % (points de pourcentage contre relatif)
  var PAIRES_HAUSSE = [[10, 12], [20, 25], [8, 10], [5, 6], [12, 15], [15, 18], [25, 30], [40, 50], [10, 15], [4, 5], [20, 24]];
  var PAIRES_BAISSE = [[20, 15], [50, 40], [25, 20], [10, 8], [8, 6], [40, 30]];

  var n = MM.fmtNum;
  var SP = MM.NBSP;

  function appliquer(level) {
    var taux = level === 1 ? TAUX_N1 : TAUX_N2;
    var p = MM.pick(taux), signe = (level === 1 && Math.random() < 0.4) ? -1 : (Math.random() < 0.5 ? 1 : -1);
    var b = level === 1 ? MM.pick([100, 200, 300, 400, 500]) : MM.randInt(5, 30) * 20;
    var u = MM.pick(['', 'M€', 'k€']);
    var delta = b * p / 100;
    var ans = b + signe * delta;
    var mot = signe > 0 ? 'augmente' : 'baisse';
    return MM.buildQuestion({
      category: 'variations', level: level,
      text: 'Un montant de ' + n(b) + (u ? SP + u : '') + ' ' + mot + ' de ' + MM.pct(p) + '. Nouveau montant ?', unit: u,
      params: { kind: 'appliquer', b: b, p: p, signe: signe },
      answer: ans,
      errors: [
        { value: b - signe * delta, type: 'mauvais-sens' },
        { value: delta, type: 'variation-seule' },
        { value: b + signe * delta * 2, type: 'variation-doublee' }
      ],
      explanation: MM.pct(p) + ' de ' + n(b) + ' = ' + n(delta) + ' ; ' + n(b) + (signe > 0 ? ' + ' : ' − ') + n(delta) + ' = ' + n(ans) + '.',
      trick: 'Calculer la variation, puis l\'ajouter ou la retrancher.'
    });
  }

  // Après +25 %, un prix vaut 100 : prix initial ?
  function retrouverBase() {
    var t = MM.retry(function () {
      var p = MM.pick(TAUX_BASE), signe = Math.random() < 0.65 ? 1 : -1;
      var b0 = MM.randInt(2, 20) * 20;
      var fin = b0 * (100 + signe * p) / 100;
      return ((signe < 0 && p >= 50) || fin !== Math.round(fin)) ? null : { p: p, signe: signe, b0: b0, fin: fin };
    });
    var p = t.p, signe = t.signe;
    var coef = 1 + signe * p / 100;
    var mot = signe > 0 ? 'une hausse de ' : 'une baisse de ';
    return MM.buildQuestion({
      category: 'variations', level: 3,
      text: 'Après ' + mot + MM.pct(p) + ', un prix vaut ' + n(t.fin) + '. Prix initial ?', unit: '',
      params: { kind: 'base', fin: t.fin, p: p, signe: signe },
      answer: t.b0,
      errors: [
        { value: t.fin * (1 - signe * p / 100), type: 'base-inverse' },      // fin × 0,75 au lieu de ÷ 1,25
        { value: t.fin * coef, type: 'mauvais-sens' },
        { value: t.fin / (1 - signe * p / 100), type: 'mauvais-sens' }
      ],
      explanation: 'Il faut diviser : ' + n(t.fin) + ' ÷ ' + n(coef) + ' = ' + n(t.b0) + '. On ne retranche pas ' + MM.pct(p) + ' de ' + n(t.fin) + '.',
      trick: 'Retrouver la base avant une variation de x % : diviser par (1 ± x), pas retrancher x %.'
    });
  }

  // +20 % puis −20 %
  function enchaine(level) {
    var a, b;
    do {
      a = MM.pick(TAUX_ENCHAINES) * MM.pick([1, 1, -1]);
      b = MM.pick(TAUX_ENCHAINES) * MM.pick([1, -1]);
    } while (a === -50 && b === -50);
    var totalPct = ((100 + a) * (100 + b)) / 100 - 100;        // variation totale en %
    var libelle = function (x) { return (x > 0 ? '+' : '−') + MM.pct(Math.abs(x)); };
    var demandeValeur = level === 3 && Math.random() < 0.5;
    var base = MM.pick([100, 200, 400, 500]);
    var ans = demandeValeur ? base * (100 + totalPct) / 100 : totalPct;
    var unit = demandeValeur ? '' : '%';
    var finale = demandeValeur ? 'Valeur finale pour ' + base + ' au départ ?' : 'Variation totale ?';
    return MM.buildQuestion({
      category: 'variations', level: level,
      text: libelle(a) + ' puis ' + libelle(b) + '. ' + finale, unit: unit,
      params: { kind: 'enchaine', a: a, b: b, base: base, valeur: demandeValeur },
      answer: ans,
      errors: [
        { value: demandeValeur ? base * (100 + a + b) / 100 : a + b, type: 'addition-des-taux' },
        { value: demandeValeur ? base * (100 + a) / 100 : a, type: 'une-seule-etape' },
        { value: demandeValeur ? base * (100 + b) / 100 : b, type: 'une-seule-etape' }
      ],
      explanation: 'Coefficients : ' + n((100 + a) / 100) + ' × ' + n((100 + b) / 100) + ' = ' + n((100 + totalPct) / 100) +
        (demandeValeur ? ', donc ' + n(ans) + '.' : ', soit ' + (totalPct >= 0 ? '+' : '−') + MM.pct(Math.abs(totalPct)) + '.'),
      trick: 'Les variations successives se multiplient (coefficients), elles ne s\'additionnent pas.'
    });
  }

  // 10 % -> 12 % : points ou % relatif ?
  function points(level) {
    var paire = (level === 3 && Math.random() < 0.35) ? MM.pick(PAIRES_BAISSE) : MM.pick(PAIRES_HAUSSE);
    var de = paire[0], vers = paire[1];
    var relatif = level === 3;
    var diff = vers - de;
    var rel = MM.round(diff / de * 100, 1);
    return MM.buildQuestion({
      category: 'variations', level: level,
      text: 'Une part de marché passe de ' + MM.pct(de) + ' à ' + MM.pct(vers) + (relatif ? '. Variation en % relatif ?' : '. Variation en points ?'),
      unit: relatif ? '%' : 'pts',
      params: { kind: 'points', de: de, vers: vers, relatif: relatif },
      answer: relatif ? rel : diff,
      errors: relatif ?
        [{ value: diff, type: 'points-confondus-avec-relatif' },
         { value: MM.round(diff / vers * 100, 1), type: 'mauvaise-base' },
         { value: -rel, type: 'mauvais-sens' }] :
        [{ value: rel, type: 'relatif-confondu-avec-points' },
         { value: vers / de, type: 'rapport-au-lieu-de-difference' },
         { value: -diff, type: 'mauvais-sens' }],
      explanation: relatif ?
        'Écart : ' + n(diff) + ' pts. En relatif : ' + n(diff) + ' / ' + n(de) + ' = ' + n(rel) + ' %.' :
        n(vers) + ' − ' + n(de) + ' = ' + n(diff) + ' points de pourcentage.',
      trick: 'Points = différence directe ; relatif = écart ÷ valeur de départ.'
    });
  }

  function generate(level) {
    var r = Math.random();
    if (level === 1) return appliquer(1);
    if (level === 2) return r < 0.55 ? appliquer(2) : (r < 0.8 ? points(2) : enchaine(2));
    return r < 0.35 ? retrouverBase() : (r < 0.7 ? enchaine(3) : points(3));
  }

  function recompute(q) {
    var p = q.params;
    if (p.kind === 'appliquer') return p.b * (1 + p.signe * p.p / 100);
    if (p.kind === 'base') return MM.round(p.fin / (1 + p.signe * p.p / 100), 6);
    if (p.kind === 'enchaine') {
      var coef = (1 + p.a / 100) * (1 + p.b / 100);
      return MM.round(p.valeur ? p.base * coef : (coef - 1) * 100, 6);
    }
    return p.relatif ? MM.round(((p.vers - p.de) * 100) / p.de, 1) : p.vers - p.de;
  }

  MM.generators['variations'] = { generate: generate, recompute: recompute };
})(window.MM);


/* croissance.js — catégorie 6 : valeur finale (1,05 à 1,15 puissance n), TCAM (CAGR), règle des 72. */
window.MM = window.MM || {};
MM.generators = MM.generators || {};

(function (MM) {
  'use strict';

  // ---- Plages (faciles à modifier) ----
  var BASES = [100, 150, 200, 250, 300, 400, 500];          // valeurs de départ (M€)
  var TAUX_N2 = [5, 10];
  var TAUX_N3 = [8, 10, 15];
  var RATIOS_N1 = [[2, 3], [2, 2], [4, 2], [2, 4]];          // [multiplicateur, années]
  var RATIOS_N2 = [[2, 5], [1.5, 4], [3, 3], [1.5, 2]];
  var RATIOS_N3 = [[1.5, 5], [2, 10], [1.2, 3], [3, 5], [1.5, 3]];
  var STARTS = [50, 80, 100, 200, 400];
  var TAUX_72 = [2, 3, 4, 6, 8, 9, 12, 18, 24, 36];
  var ANNEES_72 = [2, 3, 4, 6, 8, 9, 12];

  var n = MM.fmtNum;
  var SP = MM.NBSP;

  function puissances(r) {
    var out = [];
    for (var k = 1; k <= 5; k++) out.push(n(MM.round(Math.pow(1 + r / 100, k), 2)));
    return out.join(' ; ');
  }

  // Valeur finale après n années à r % par an.
  function compose(level) {
    var r = MM.pick(level === 2 ? TAUX_N2 : TAUX_N3);
    var an = level === 2 ? MM.randInt(2, 3) : MM.randInt(3, 5);
    var base = MM.pick(BASES);
    var coef = Math.pow(1 + r / 100, an);
    var ans = MM.sig(base * coef, 3);
    return MM.buildQuestion({
      category: 'croissance', level: level, sig: 3,
      text: n(base) + SP + 'M€ à ' + MM.pct(r) + ' par an pendant ' + an + ' ans. Valeur finale ?', unit: 'M€',
      params: { kind: 'compose', base: base, r: r, an: an },
      answer: ans,
      errors: [
        { value: base * (1 + an * r / 100), type: 'interets-simples' },
        { value: base * Math.pow(1 + r / 100, an - 1), type: 'une-annee-de-moins' },
        { value: base * Math.pow(1 + r / 100, an + 1), type: 'une-annee-de-plus' }
      ],
      explanation: '(1 + ' + n(r / 100) + ')^' + an + ' ≈ ' + n(MM.round(coef, 2)) + ' ; ' + n(base) + ' × ' + n(MM.round(coef, 2)) + ' ≈ ' + n(ans) + ' M€.',
      trick: 'Puissances de ' + n(1 + r / 100) + ' (n = 1 à 5) : ' + puissances(r) + '.'
    });
  }

  // TCAM à partir de deux valeurs.
  function tcam(level) {
    var liste = level === 1 ? RATIOS_N1 : (level === 2 ? RATIOS_N2 : RATIOS_N3);
    var c = MM.pick(liste), ratio = c[0], an = c[1];
    var start = MM.pick(STARTS), fin = start * ratio;
    var y0 = MM.randInt(2016, 2022);
    var ans = MM.round((Math.pow(ratio, 1 / an) - 1) * 100, 1);
    return MM.buildQuestion({
      category: 'croissance', level: level,
      text: 'CA de ' + n(start) + SP + 'M€ en ' + y0 + ', ' + n(fin) + SP + 'M€ en ' + (y0 + an) + '. TCAM ?', unit: '%',
      params: { kind: 'tcam', start: start, fin: fin, an: an },
      answer: ans,
      errors: [
        { value: MM.round((ratio - 1) * 100 / an, 1), type: 'variation-totale-divisee-par-n' },
        { value: MM.round((Math.pow(ratio, 1 / (an + 1)) - 1) * 100, 1), type: 'n-egal-nombre-de-valeurs' },
        { value: MM.round((ratio - 1) * 100, 1), type: 'variation-totale' }
      ],
      explanation: 'n = ' + y0 + ' → ' + (y0 + an) + ' = ' + an + ' ans. Il faut un coefficient c tel que c^' + an + ' = ' + n(ratio) + ' : c ≈ ' + n(MM.round(1 + ans / 100, 3)) + ', soit ' + n(ans) + ' % par an.',
      trick: 'n = nombre d\'années entre les deux dates. Ne jamais diviser la variation totale par n.'
    });
  }

  // Règle des 72
  function regle72(level) {
    var inverse = level === 3 && Math.random() < 0.5;
    if (!inverse) {
      var r = MM.pick(TAUX_72);
      return MM.buildQuestion({
        category: 'croissance', level: level,
        text: 'Un placement rapporte ' + MM.pct(r) + ' par an. Années pour doubler ?', unit: 'ans',
        params: { kind: 'doubler', r: r },
        answer: 72 / r,
        errors: [
          { value: MM.round(100 / r, 1), type: 'regle-de-100' },
          { value: MM.round(72 * r / 100, 1), type: 'multiplication-au-lieu-de-division' },
          { value: MM.round(144 / r, 1), type: 'facteur-2' }
        ],
        explanation: '72 ÷ ' + r + ' = ' + n(72 / r) + ' ans.', trick: 'Années pour doubler ≈ 72 ÷ taux (en %).'
      });
    }
    var a = MM.pick(ANNEES_72);
    return MM.buildQuestion({
      category: 'croissance', level: 3,
      text: 'Le CA double en ' + a + ' ans. Croissance annuelle approximative ?', unit: '%',
      params: { kind: 'taux72', a: a },
      answer: 72 / a,
      errors: [
        { value: MM.round(100 / a, 1), type: 'variation-totale-divisee-par-n' },
        { value: a * 2, type: 'mauvaise-regle' },
        { value: MM.round(72 / (a + 1), 1), type: 'n-egal-nombre-de-valeurs' }
      ],
      explanation: '72 ÷ ' + a + ' = ' + n(72 / a) + ' % par an (approximation).', trick: 'Taux ≈ 72 ÷ années pour doubler.'
    });
  }

  function generate(level) {
    var r = Math.random();
    if (level === 1) return r < 0.65 ? tcam(1) : regle72(1);
    if (level === 2) return r < 0.5 ? compose(2) : (r < 0.8 ? tcam(2) : regle72(2));
    return r < 0.5 ? compose(3) : (r < 0.75 ? tcam(3) : regle72(3));
  }

  function recompute(q) {
    var p = q.params;
    if (p.kind === 'compose') {
      var v = p.base;
      for (var i = 0; i < p.an; i++) v = v * (1 + p.r / 100);   // multiplication année par année
      return MM.sig(v, 3);
    }
    if (p.kind === 'tcam') return MM.round((Math.exp(Math.log(p.fin / p.start) / p.an) - 1) * 100, 1);
    if (p.kind === 'doubler') return 72 / p.r;
    return 72 / p.a;
  }

  MM.generators['croissance'] = { generate: generate, recompute: recompute };
})(window.MM);


/* marges.js — catégorie 7 : marge brute / opérationnelle, du CA au profit, markup contre marge. */
window.MM = window.MM || {};
MM.generators = MM.generators || {};

(function (MM) {
  'use strict';

  // ---- Plages (faciles à modifier) ----
  var CA_N1 = [100, 200, 300, 400, 500, 600, 800];
  var MARGES_N1 = [5, 10, 20, 25, 50];
  var CA_N2 = [150, 250, 350, 450, 600, 750, 800, 950];
  var MARGES_N2 = [8, 12, 14, 15, 18, 35];
  var CA_BRUTE = [200, 400, 500, 800, 1000];
  var MARGES_BRUTE = [20, 25, 30, 35, 40, 45, 60];
  var COUTS_VAR = [40, 50, 55, 60, 65, 70];                   // % du CA
  // paires [coût, prix de vente]
  var PAIRES_MARKUP = [[80, 100], [60, 80], [150, 200], [75, 100], [90, 120], [40, 50], [120, 150], [45, 60]];
  var PRIX_VISES = [40, 50, 100, 120, 200, 250, 400, 500];
  var MARGES_PRIX = [10, 20, 25, 40, 50];

  var n = MM.fmtNum;
  var SP = MM.NBSP;

  function margeOp(level) {
    var ca = MM.pick(level === 1 ? CA_N1 : CA_N2);
    var m = MM.pick(level === 1 ? MARGES_N1 : MARGES_N2);
    if ((ca * m) % 10 !== 0) return margeOp(level);
    var profit = ca * m / 100;
    return MM.buildQuestion({
      category: 'marges', level: level,
      text: 'CA ' + n(ca) + SP + 'M€, marge opérationnelle ' + MM.pct(m) + '. Résultat opérationnel ?', unit: 'M€',
      params: { kind: 'margeOp', ca: ca, m: m },
      answer: profit,
      errors: [
        { value: ca - profit, type: 'complement' },
        { value: ca * m / 10, type: 'decalage-virgule' },
        { value: ca + profit, type: 'ajout-au-lieu-de-prendre' }
      ],
      explanation: MM.pct(m) + ' de ' + n(ca) + ' = ' + n(profit) + ' M€.',
      trick: 'Résultat = CA × taux de marge.'
    });
  }

  function margeBrute(level) {
    var t = MM.retry(function () {
      var ca = MM.pick(CA_BRUTE), m = MM.pick(MARGES_BRUTE);
      var cout = ca * (100 - m) / 100;
      return cout === Math.round(cout) ? { ca: ca, m: m, cout: cout } : null;
    });
    return MM.buildQuestion({
      category: 'marges', level: level,
      text: 'CA ' + n(t.ca) + SP + 'M€, coût des ventes ' + n(t.cout) + SP + 'M€. Taux de marge brute ?', unit: '%',
      params: { kind: 'margeBrute', ca: t.ca, cout: t.cout },
      answer: t.m,
      errors: [
        { value: MM.round(t.cout / t.ca * 100, 1), type: 'taux-de-cout-pris-pour-marge' },
        { value: MM.round((t.ca - t.cout) / t.cout * 100, 1), type: 'markup-pris-pour-marge' },
        { value: MM.round((t.ca - t.cout) / 10, 1), type: 'oubli-de-la-base' }
      ],
      explanation: 'Marge brute = ' + n(t.ca) + ' − ' + n(t.cout) + ' = ' + n(t.ca - t.cout) + ' M€ ; ' + n(t.ca - t.cout) + ' / ' + n(t.ca) + ' = ' + n(t.m) + ' %.',
      trick: 'Taux de marge = marge ÷ prix de vente (le CA), pas ÷ coût.'
    });
  }

  function caVersProfit() {
    var t = MM.retry(function () {
      var ca = MM.randInt(2, 10) * 100, v = MM.pick(COUTS_VAR), fixes = MM.randInt(3, 25) * 10;
      var mv = ca * (100 - v) / 100;
      return (mv === Math.round(mv) && mv - fixes > 0) ? { ca: ca, v: v, fixes: fixes, mv: mv } : null;
    });
    return MM.buildQuestion({
      category: 'marges', level: 3,
      text: 'CA ' + n(t.ca) + SP + 'M€, coûts variables ' + MM.pct(t.v) + ' du CA, coûts fixes ' + n(t.fixes) + SP + 'M€. Résultat ?', unit: 'M€',
      params: { kind: 'caProfit', ca: t.ca, v: t.v, fixes: t.fixes },
      answer: t.mv - t.fixes,
      errors: [
        { value: t.mv, type: 'oubli-des-couts-fixes' },
        { value: t.ca - t.fixes, type: 'oubli-des-couts-variables' },
        { value: t.ca * t.v / 100 - t.fixes, type: 'mauvais-taux' }
      ],
      explanation: 'Marge sur coûts variables = ' + n(t.ca) + ' × ' + n(100 - t.v) + ' % = ' + n(t.mv) + ' ; moins ' + n(t.fixes) + ' de fixes = ' + n(t.mv - t.fixes) + ' M€.',
      trick: 'CA → − coûts variables → − coûts fixes → résultat.'
    });
  }

  function markup() {
    var pr = MM.pick(PAIRES_MARKUP), c = pr[0], p = pr[1];
    var demandeMarge = Math.random() < 0.5;
    var marge = MM.round((p - c) / p * 100, 1), mk = MM.round((p - c) / c * 100, 1);
    return MM.buildQuestion({
      category: 'marges', level: 3,
      text: 'Coût ' + c + ' €, prix de vente ' + p + ' €. ' + (demandeMarge ? 'Taux de marge ?' : 'Markup (sur le coût) ?'), unit: '%',
      params: { kind: 'markup', c: c, p: p, marge: demandeMarge },
      answer: demandeMarge ? marge : mk,
      errors: [
        { value: demandeMarge ? mk : marge, type: 'markup-confondu-avec-marge' },
        { value: p - c, type: 'ecart-absolu-pris-pour-taux' },
        { value: MM.round(100 - (demandeMarge ? marge : mk), 1), type: 'complement' }
      ],
      explanation: 'Écart = ' + (p - c) + ' €. Marge = ' + (p - c) + ' / ' + p + ' = ' + n(marge) + ' % ; markup = ' + (p - c) + ' / ' + c + ' = ' + n(mk) + ' %.',
      trick: 'Marge ÷ prix de vente ; markup ÷ coût. Coût 80, prix 100 : marge 20 %, markup 25 %.'
    });
  }

  function prixDepuisMarge() {
    var t = MM.retry(function () {
      var prix = MM.pick(PRIX_VISES), m = MM.pick(MARGES_PRIX);
      var cout = prix * (100 - m) / 100;
      return cout === Math.round(cout) ? { prix: prix, m: m, cout: cout } : null;
    });
    return MM.buildQuestion({
      category: 'marges', level: 3,
      text: 'Coût ' + n(t.cout) + ' €, taux de marge visé ' + MM.pct(t.m) + '. Prix de vente ?', unit: '€',
      params: { kind: 'prixMarge', cout: t.cout, m: t.m },
      answer: t.prix,
      errors: [
        { value: MM.round(t.cout * (1 + t.m / 100), 1), type: 'markup-confondu-avec-marge' },
        { value: t.cout + t.m, type: 'ecart-absolu-pris-pour-taux' },
        { value: MM.round(t.cout / (1 + t.m / 100), 1), type: 'mauvais-sens' }
      ],
      explanation: 'Prix = coût ÷ (1 − marge) = ' + n(t.cout) + ' ÷ ' + n(1 - t.m / 100) + ' = ' + n(t.prix) + ' €.',
      trick: 'Prix de vente = coût ÷ (1 − taux de marge).'
    });
  }

  function generate(level) {
    var r = Math.random();
    if (level === 1) return margeOp(1);
    if (level === 2) return r < 0.5 ? margeOp(2) : margeBrute(2);
    return r < 0.3 ? markup() : (r < 0.55 ? prixDepuisMarge() : (r < 0.8 ? caVersProfit() : margeBrute(3)));
  }

  function recompute(q) {
    var p = q.params;
    if (p.kind === 'margeOp') return (p.ca / 100) * p.m;
    if (p.kind === 'margeBrute') return MM.round(((p.ca - p.cout) * 100) / p.ca, 1);
    if (p.kind === 'caProfit') return (p.ca / 100) * (100 - p.v) - p.fixes;
    if (p.kind === 'markup') return MM.round(((p.p - p.c) * 100) / (p.marge ? p.p : p.c), 1);
    return MM.round(p.cout / (1 - p.m / 100), 6);
  }

  MM.generators['marges'] = { generate: generate, recompute: recompute };
})(window.MM);


/* rentabilite.js — catégorie 8 : point mort, volume pour un profit cible, payback, ROI. */
window.MM = window.MM || {};
MM.generators = MM.generators || {};

(function (MM) {
  'use strict';

  // ---- Plages (faciles à modifier) ----
  var FIXES_K = [200, 400, 500, 800, 1000, 2000, 3000];       // coûts fixes en k€
  var MARGES_UNIT = [10, 20, 25, 40, 50];                     // marge unitaire en €
  var PRIX = [50, 80, 100, 120, 150, 200];
  var CIBLES_K = [250, 500, 1000];                            // profit cible en k€
  var INVEST_K = [200, 400, 600, 800, 1000, 1200];
  var GAINS_K = [100, 150, 200, 250, 300, 400];
  var ROIS = [20, 25, 50, 60, 75, 100];

  var n = MM.fmtNum;
  var SP = MM.NBSP;

  // 2 000 k€ -> "2 M€" ; 800 -> "800 k€"
  function argent(k) {
    return k >= 1000 ? n(k / 1000) + SP + 'M€' : n(k) + SP + 'k€';
  }

  function pointMort(level) {
    var t = MM.retry(function () {
      var f = MM.pick(FIXES_K), m = MM.pick(MARGES_UNIT), prix = MM.pick(PRIX);
      if (level > 1 && prix <= m) return null;
      var ans = f / m;                                    // en milliers d'unités (k€ ÷ €)
      return MM.hasMaxDecimals(ans, 1) ? { f: f, m: m, prix: prix, ans: ans } : null;
    });
    var cv = t.prix - t.m;
    var texte = level === 1 ?
      'Coûts fixes ' + argent(t.f) + ', marge unitaire ' + t.m + ' €. Point mort ?' :
      'Coûts fixes ' + argent(t.f) + '. Prix ' + t.prix + ' €, coût variable ' + cv + ' €. Point mort ?';
    return MM.buildQuestion({
      category: 'rentabilite', level: level,
      text: texte, unit: 'k unités',
      params: { kind: 'pointMort', f: t.f, m: t.m, prix: t.prix, level: level },
      answer: t.ans,
      errors: [
        { value: level === 1 ? t.f / (t.m * 2) : t.f / t.prix, type: level === 1 ? 'facteur-2' : 'prix-au-lieu-de-marge' },
        { value: level === 1 ? t.f / (t.m / 2) : t.f / (t.prix - t.m), type: level === 1 ? 'facteur-2' : 'cout-variable-au-lieu-de-marge' },
        { value: t.ans * 10, type: 'decalage-virgule' }
      ],
      explanation: 'Marge unitaire = ' + t.m + ' €. Point mort = ' + n(t.f) + ' k€ ÷ ' + t.m + ' € = ' + n(t.ans) + ' k unités (' + n(t.ans * 1000) + ' unités).',
      trick: 'Point mort = coûts fixes ÷ marge unitaire (prix − coût variable).'
    });
  }

  function profitCible(level) {
    var t = MM.retry(function () {
      var f = MM.pick([500, 1000, 1500, 2000]), c = MM.pick(CIBLES_K), m = MM.pick(MARGES_UNIT);
      var ans = (f + c) / m;
      return MM.hasMaxDecimals(ans, 1) ? { f: f, c: c, m: m, ans: ans } : null;
    });
    return MM.buildQuestion({
      category: 'rentabilite', level: level,
      text: 'Coûts fixes ' + argent(t.f) + ', marge unitaire ' + t.m + ' €, profit cible ' + argent(t.c) + '. Volume ?', unit: 'k unités',
      params: { kind: 'profitCible', f: t.f, c: t.c, m: t.m },
      answer: t.ans,
      errors: [
        { value: t.c / t.m, type: 'oubli-des-couts-fixes' },
        { value: t.f / t.m, type: 'oubli-du-profit-cible' },
        { value: (t.f - t.c) / t.m, type: 'signe-inverse' }
      ],
      explanation: '(' + n(t.f) + ' + ' + n(t.c) + ') k€ ÷ ' + t.m + ' € = ' + n(t.ans) + ' k unités.',
      trick: 'Volume = (coûts fixes + profit cible) ÷ marge unitaire.'
    });
  }

  function payback(level) {
    var mensuel = level === 3;
    var t = MM.retry(function () {
      var inv = MM.pick(INVEST_K), g = mensuel ? MM.pick([10, 20, 25, 50]) : MM.pick(GAINS_K);
      var gAn = mensuel ? g * 12 : g;
      var ans = inv / gAn;
      return (ans >= 1.5 && ans <= 8 && MM.hasMaxDecimals(ans, 1)) ? { inv: inv, g: g, gAn: gAn, ans: ans } : null;
    });
    return MM.buildQuestion({
      category: 'rentabilite', level: level,
      text: 'Investissement ' + argent(t.inv) + ', gain de ' + n(t.g) + SP + 'k€ par ' + (mensuel ? 'mois' : 'an') + '. Payback ?', unit: 'ans',
      params: { kind: 'payback', inv: t.inv, g: t.g, mensuel: mensuel },
      answer: t.ans,
      errors: [
        { value: mensuel ? t.inv / t.g : t.ans * 12, type: 'mois-confondus-avec-annees' },
        { value: mensuel ? t.inv / (t.g * 6) : t.ans + 1, type: 'mauvaise-operation' },
        { value: t.ans / 2, type: 'division-en-trop' }
      ],
      explanation: mensuel ?
        'Gain annuel = ' + n(t.g) + ' × 12 = ' + n(t.gAn) + ' k€ ; ' + n(t.inv) + ' ÷ ' + n(t.gAn) + ' = ' + n(t.ans) + ' ans.' :
        n(t.inv) + ' ÷ ' + n(t.g) + ' = ' + n(t.ans) + ' ans.',
      trick: 'Payback = investissement ÷ gain annuel (même unité de temps).'
    });
  }

  function roi() {
    var t = MM.retry(function () {
      var inv = MM.pick([200, 400, 500, 800, 1000]), r = MM.pick(ROIS);
      var gain = inv * (100 + r) / 100;
      return gain === Math.round(gain) ? { inv: inv, r: r, gain: gain, an: MM.pick([3, 4, 5]) } : null;
    });
    return MM.buildQuestion({
      category: 'rentabilite', level: 3,
      text: 'Investissement ' + argent(t.inv) + ', gains cumulés ' + argent(t.gain) + ' sur ' + t.an + ' ans. ROI total ?', unit: '%',
      params: { kind: 'roi', inv: t.inv, gain: t.gain },
      answer: t.r,
      errors: [
        { value: MM.round(t.gain / t.inv * 100, 1), type: 'gain-brut-pris-pour-roi' },
        { value: MM.round((t.gain - t.inv) / t.gain * 100, 1), type: 'mauvaise-base' },
        { value: MM.round(t.r / t.an, 1), type: 'roi-annualise' }
      ],
      explanation: 'Gain net = ' + n(t.gain) + ' − ' + n(t.inv) + ' = ' + n(t.gain - t.inv) + ' k€ ; ' + n(t.gain - t.inv) + ' / ' + n(t.inv) + ' = ' + n(t.r) + ' %.',
      trick: 'ROI = (gain − investissement) ÷ investissement.'
    });
  }

  function generate(level) {
    var r = Math.random();
    if (level === 1) return r < 0.6 ? pointMort(1) : payback(1);
    if (level === 2) return r < 0.4 ? pointMort(2) : (r < 0.7 ? profitCible(2) : payback(2));
    return r < 0.3 ? profitCible(3) : (r < 0.55 ? roi() : (r < 0.8 ? payback(3) : pointMort(3)));
  }

  function recompute(q) {
    var p = q.params;
    if (p.kind === 'pointMort') return MM.round(p.f / p.m, 6);
    if (p.kind === 'profitCible') return MM.round((p.f + p.c) / p.m, 6);
    if (p.kind === 'payback') return MM.round(p.inv / (p.mensuel ? p.g * 12 : p.g), 6);
    return MM.round(((p.gain - p.inv) * 100) / p.inv, 6);
  }

  MM.generators['rentabilite'] = { generate: generate, recompute: recompute };
})(window.MM);


/* market-sizing.js — catégorie 9 : chaînes de 3 à 5 facteurs, réponse à 2 chiffres significatifs.
 * Niveau 1 : population × taux × dépense annuelle                         (3 facteurs)
 * Niveau 2 : population × taux × achats par an × prix                     (4 facteurs)
 * Niveau 3 : population × taux × achats par période × nb de périodes × prix (5 facteurs)
 * Le piège classique : le décalage d'une puissance de 10 (M contre Md). */
window.MM = window.MM || {};
MM.generators = MM.generators || {};

(function (MM) {
  'use strict';

  // ---- Populations (en millions d'habitants) ----
  var FRANCE = { nom: 'France', val: 68, txt: '68 M d\'habitants' };
  var EUROPE = { nom: 'Europe', val: 450, txt: '450 M d\'habitants' };
  var MONDE = { nom: 'Monde', val: 8000, txt: '8 Md d\'habitants' };

  // ---- Scénarios (faciles à modifier ou à compléter) ----
  // qui : "x % <qui>" ; achats par an (niveau 2) ; période (niveau 3) ; prix unitaires en €
  var SCENARIOS = [
    { sujet: 'café', qui: 'boivent du café', objet: 'cafés', pops: [FRANCE, EUROPE],
      taux: [40, 50, 60, 70, 80], depense: [100, 150, 200, 300], achats: [100, 150, 200, 300],
      periode: { mot: 'jour', mots: 'jours', nb: 365, par: [2, 3, 4] }, prix: [1, 1.5, 2, 3] },
    { sujet: 'cinéma', qui: 'vont au cinéma', objet: 'séances', pops: [FRANCE, EUROPE],
      taux: [30, 40, 50, 60], depense: [20, 30, 40, 50], achats: [2, 3, 4, 5, 6],
      periode: { mot: 'mois', mots: 'mois', nb: 12, par: [2, 3] }, prix: [8, 10, 12] },
    { sujet: 'repas du midi', qui: 'déjeunent dehors', objet: 'repas', pops: [FRANCE],
      taux: [20, 30, 40], depense: [500, 800, 1000], achats: [50, 80, 100, 120],
      periode: { mot: 'semaine', mots: 'semaines', nb: 52, par: [2, 3, 4] }, prix: [10, 12, 15] },
    { sujet: 'VTC', qui: 'prennent des VTC', objet: 'courses', pops: [EUROPE],
      taux: [10, 15, 20, 25], depense: [150, 250, 300], achats: [10, 20, 30],
      periode: { mot: 'mois', mots: 'mois', nb: 12, par: [2, 3, 4] }, prix: [15, 20, 25] },
    { sujet: 'coiffeur', qui: 'vont chez le coiffeur', objet: 'coupes', pops: [FRANCE, EUROPE],
      taux: [60, 70, 80], depense: [60, 100, 150], achats: [3, 4, 6, 8],
      periode: { mot: 'trimestre', mots: 'trimestres', nb: 4, par: [2, 3] }, prix: [20, 25, 30, 40] },
    { sujet: 'boissons', qui: 'achètent des canettes', objet: 'canettes', pops: [MONDE],
      taux: [20, 30, 40], depense: [20, 30, 50], achats: [20, 30, 50],
      periode: { mot: 'semaine', mots: 'semaines', nb: 52, par: [2, 3, 4] }, prix: [0.5, 1, 1.5] }
  ];

  var n = MM.fmtNum;
  var SP = MM.NBSP;

  // Convertit une valeur en M€ vers l'unité d'affichage (M€ ou Md€) et arrondit à 2 chiffres.
  function versUnite(valeurMEuro, enMd) {
    return MM.sig(enMd ? valeurMEuro / 1000 : valeurMEuro, 2);
  }

  function generate(level) {
    var s = MM.pick(SCENARIOS);
    var pop = MM.pick(s.pops), taux = MM.pick(s.taux);
    var depense = MM.pick(s.depense), achats = MM.pick(s.achats), prix = MM.pick(s.prix);
    var par = MM.pick(s.periode.par), nb = s.periode.nb;

    // Valeur exacte en M€ (population en M × € = M€).
    var total, texte, sansTaux, sansEtape;
    var base = pop.val * taux / 100;
    if (level === 1) {
      total = base * depense;
      sansTaux = pop.val * depense;
      sansEtape = null;
      texte = pop.nom + ' : ' + pop.txt + ', ' + MM.pct(taux) + ' ' + s.qui + ', ' + n(depense) + ' € par an et par client. Marché annuel ?';
    } else if (level === 2) {
      total = base * achats * prix;
      sansTaux = pop.val * achats * prix;
      sansEtape = base * prix;                       // oublie le nombre d'achats par an
      texte = pop.nom + ' : ' + pop.txt + ', ' + MM.pct(taux) + ' ' + s.qui + ', ' + achats + ' ' + s.objet + ' par an à ' + n(prix) + ' €. Marché annuel ?';
    } else {
      total = base * par * nb * prix;
      sansTaux = pop.val * par * nb * prix;
      sansEtape = base * par * prix;                 // oublie de multiplier par le nombre de périodes
      texte = pop.nom + ' : ' + pop.txt + ', ' + MM.pct(taux) + ' ' + s.qui + ', ' + par + ' ' + s.objet + ' par ' + s.periode.mot + ', ' + nb + ' ' + s.periode.mots + ' par an, ' + n(prix) + ' € l\'unité. Marché ?';
    }
    if (texte.length > 140) texte = texte.replace(' d\'habitants', ' hab.');

    var enMd = total >= 1000;
    var unit = enMd ? 'Md€' : 'M€';
    var ans = versUnite(total, enMd);
    var errors = [
      { value: versUnite(total * 10, enMd), type: 'decalage-puissance-de-10' },       // piège classique
      { value: versUnite(total / 10, enMd), type: 'decalage-puissance-de-10' },
      { value: versUnite(sansTaux, enMd), type: 'oubli-du-taux' }
    ];
    if (sansEtape) errors.push({ value: versUnite(sansEtape, enMd), type: 'etape-oubliee' });

    var etapes = level === 1 ?
      n(pop.val) + ' M × ' + n(taux / 100) + ' = ' + n(MM.round(base, 1)) + ' M de clients ; × ' + n(depense) + ' € ≈ ' :
      level === 2 ?
      n(pop.val) + ' M × ' + n(taux / 100) + ' = ' + n(MM.round(base, 1)) + ' M de clients ; × ' + achats + ' × ' + n(prix) + ' € ≈ ' :
      n(pop.val) + ' M × ' + n(taux / 100) + ' = ' + n(MM.round(base, 1)) + ' M de clients ; × ' + par + ' × ' + nb + ' × ' + n(prix) + ' € ≈ ';
    return MM.buildQuestion({
      category: 'market-sizing', level: level, sig: 2,
      text: texte, unit: unit,
      params: { kind: 'chaine', level: level, pop: pop.val, taux: taux, depense: depense, achats: achats, prix: prix, par: par, nb: nb },
      answer: ans,
      errors: errors,
      explanation: etapes + n(ans) + SP + unit + '.',
      trick: 'Puissances de 10 d\'abord (M × € = M€), 2 chiffres significatifs, puis test de cohérence.'
    });
  }

  function recompute(q) {
    var p = q.params;
    var facteurs;
    if (p.level === 1) facteurs = [p.depense, p.pop, p.taux / 100];
    else if (p.level === 2) facteurs = [p.prix, p.achats, p.taux / 100, p.pop];
    else facteurs = [p.nb, p.prix, p.par, p.taux / 100, p.pop];
    var total = 1;
    for (var i = 0; i < facteurs.length; i++) total *= facteurs[i];
    return versUnite(total, total >= 1000);
  }

  MM.generators['market-sizing'] = { generate: generate, recompute: recompute };
})(window.MM);


/* prix-volume-mix.js — catégorie 10 : moyenne pondérée de prix, effet prix / volume,
 * part de marché relative, contribution d'un segment à la croissance. */
window.MM = window.MM || {};
MM.generators = MM.generators || {};

(function (MM) {
  'use strict';

  // ---- Plages (faciles à modifier) ----
  var POIDS = [[50, 50], [60, 40], [70, 30], [80, 20], [75, 25], [40, 60]];   // parts des deux gammes (%)
  var PRIX_GAMMES = [10, 20, 30, 40, 50, 60, 80, 100];
  var CA_BASE = [100, 200, 400, 500, 800];
  var TAUX_PRIX = [-10, -5, 5, 10, 20];
  var TAUX_VOLUME = [-20, -10, 5, 10, 20];
  var PRIX_UNIT = [20, 25, 40, 50, 80];
  var PARTS_RELATIVES = [[20, 40], [30, 45], [15, 30], [24, 30], [12, 16], [18, 36]];   // [notre part, part du leader]
  var CROISSANCES = [5, 10, 20];

  var n = MM.fmtNum;
  var SP = MM.NBSP;
  var signe = function (x) { return (x > 0 ? '+' : '−') + MM.pct(Math.abs(x)); };

  function moyennePonderee(level) {
    var t = MM.retry(function () {
      var w = MM.pick(POIDS), a = MM.pick(PRIX_GAMMES), b = MM.pick(PRIX_GAMMES);
      if (a === b) return null;
      var moy = (w[0] * a + w[1] * b) / 100;
      return MM.hasMaxDecimals(moy, 1) && (level > 1 || (w[0] * a + w[1] * b) % 100 === 0) ? { w: w, a: a, b: b, moy: moy } : null;
    });
    return MM.buildQuestion({
      category: 'prix-volume-mix', level: level,
      text: 'Gamme A : ' + MM.pct(t.w[0]) + ' des ventes à ' + t.a + ' €. Gamme B : ' + MM.pct(t.w[1]) + ' à ' + t.b + ' €. Prix moyen ?', unit: '€',
      params: { kind: 'moyenne', w1: t.w[0], a: t.a, w2: t.w[1], b: t.b },
      answer: t.moy,
      errors: [
        { value: (t.a + t.b) / 2, type: 'moyenne-simple' },
        { value: (t.w[1] * t.a + t.w[0] * t.b) / 100, type: 'poids-inverses' },
        { value: t.a + t.b, type: 'somme-au-lieu-de-moyenne' }
      ],
      explanation: n(t.w[0] / 100) + ' × ' + t.a + ' + ' + n(t.w[1] / 100) + ' × ' + t.b + ' = ' + n(t.w[0] * t.a / 100) + ' + ' + n(t.w[1] * t.b / 100) + ' = ' + n(t.moy) + ' €.',
      trick: 'Moyenne pondérée : chaque prix × son poids, puis on additionne.'
    });
  }

  // Prix et volume varient ensemble : nouveau CA
  function effetCA(level) {
    var t = MM.retry(function () {
      var ca = MM.pick(CA_BASE), p = MM.pick(TAUX_PRIX), v = MM.pick(TAUX_VOLUME);
      var ans = ca * (100 + p) * (100 + v) / 10000;
      return MM.hasMaxDecimals(ans, 1) ? { ca: ca, p: p, v: v, ans: ans } : null;
    });
    return MM.buildQuestion({
      category: 'prix-volume-mix', level: level,
      text: 'CA de ' + n(t.ca) + SP + 'M€. Prix ' + signe(t.p) + ', volume ' + signe(t.v) + '. Nouveau CA ?', unit: 'M€',
      params: { kind: 'effetCA', ca: t.ca, p: t.p, v: t.v },
      answer: t.ans,
      errors: [
        { value: t.ca * (100 + t.p + t.v) / 100, type: 'addition-des-taux' },
        { value: t.ca * (100 + t.p) / 100, type: 'effet-volume-oublie' },
        { value: t.ca * (100 + t.v) / 100, type: 'effet-prix-oublie' }
      ],
      explanation: n(t.ca) + ' × ' + n((100 + t.p) / 100) + ' × ' + n((100 + t.v) / 100) + ' = ' + n(t.ans) + ' M€.',
      trick: 'CA = prix × volume : les deux effets se multiplient, ils ne s\'additionnent pas.'
    });
  }

  // Décomposition de la variation de CA : effet prix (au nouveau volume) ou effet volume (à l'ancien prix)
  function decomposition() {
    var t = MM.retry(function () {
      var p0 = MM.pick(PRIX_UNIT), q0 = MM.pick([2, 4, 5, 10]);
      var p1 = p0 + MM.pick([-5, -4, 4, 5, 10]), q1 = q0 + MM.pick([-1, 1, 2, -2]);
      return (p1 > 0 && q1 > 0 && p1 !== p0 && q1 !== q0) ? { p0: p0, q0: q0, p1: p1, q1: q1 } : null;
    });
    var demandePrix = Math.random() < 0.5;
    var effetPrix = (t.p1 - t.p0) * t.q1, effetVol = (t.q1 - t.q0) * t.p0;
    return MM.buildQuestion({
      category: 'prix-volume-mix', level: 3,
      text: 'Prix ' + t.p0 + ' → ' + t.p1 + ' €, volume ' + t.q0 + ' → ' + t.q1 + ' M. ' + (demandePrix ? 'Effet prix ?' : 'Effet volume ?'), unit: 'M€',
      params: { kind: 'decomp', p0: t.p0, q0: t.q0, p1: t.p1, q1: t.q1, prix: demandePrix },
      answer: demandePrix ? effetPrix : effetVol,
      errors: demandePrix ?
        [{ value: (t.p1 - t.p0) * t.q0, type: 'mauvais-volume' },
         { value: effetPrix + effetVol, type: 'effet-total' },
         { value: (t.q1 - t.q0) * t.p0, type: 'effet-volume-pris-pour-prix' }] :
        [{ value: (t.q1 - t.q0) * t.p1, type: 'mauvais-prix' },
         { value: effetPrix + effetVol, type: 'effet-total' },
         { value: (t.p1 - t.p0) * t.q1, type: 'effet-prix-pris-pour-volume' }],
      explanation: demandePrix ?
        'Effet prix = écart de prix × nouveau volume = ' + (t.p1 - t.p0) + ' × ' + t.q1 + ' = ' + n(effetPrix) + ' M€.' :
        'Effet volume = écart de volume × ancien prix = ' + (t.q1 - t.q0) + ' × ' + t.p0 + ' = ' + n(effetVol) + ' M€.',
      trick: 'Effet volume à l\'ancien prix, effet prix au nouveau volume : la somme donne la variation totale.'
    });
  }

  function partRelative() {
    var c = MM.pick(PARTS_RELATIVES), nous = c[0], leader = c[1];
    var ans = MM.round(nous / leader, 2);
    return MM.buildQuestion({
      category: 'prix-volume-mix', level: 3, dec: 2,
      text: 'Notre part de marché : ' + MM.pct(nous) + '. Leader : ' + MM.pct(leader) + '. Part relative ?', unit: 'x',
      params: { kind: 'relative', nous: nous, leader: leader },
      answer: ans,
      errors: [
        { value: MM.round(leader / nous, 2), type: 'rapport-inverse' },
        { value: MM.round((leader - nous) / leader, 2), type: 'ecart-pris-pour-rapport' },
        { value: MM.round(nous / (nous + leader), 2), type: 'mauvaise-base' }
      ],
      explanation: 'Part relative = ' + nous + ' ÷ ' + leader + ' = ' + n(ans) + '. Au-dessus de 1, on mène le marché.',
      trick: 'Part relative = notre part ÷ part du premier concurrent.'
    });
  }

  function contribution() {
    var w = MM.pick([[60, 40], [70, 30], [50, 50], [80, 20]]), g = MM.pick(CROISSANCES);
    var ans = w[0] * g / 100;
    var gB = MM.pick(CROISSANCES);
    return MM.buildQuestion({
      category: 'prix-volume-mix', level: 3,
      text: 'Segment A : ' + MM.pct(w[0]) + ' du CA, +' + MM.pct(g) + '. Segment B : ' + MM.pct(w[1]) + ', +' + MM.pct(gB) + '. Contribution de A ?', unit: 'pts',
      params: { kind: 'contrib', w: w[0], g: g },
      answer: ans,
      errors: [
        { value: g, type: 'croissance-du-segment-seule' },
        { value: w[1] * gB / 100, type: 'mauvais-segment' },
        { value: w[0], type: 'poids-pris-pour-contribution' }
      ],
      explanation: 'Contribution = poids × croissance = ' + n(w[0] / 100) + ' × ' + g + ' = ' + n(ans) + ' points de croissance totale.',
      trick: 'Contribution d\'un segment = son poids × sa croissance.'
    });
  }

  function generate(level) {
    var r = Math.random();
    if (level === 1) return moyennePonderee(1);
    if (level === 2) return r < 0.5 ? moyennePonderee(2) : effetCA(2);
    return r < 0.3 ? decomposition() : (r < 0.55 ? partRelative() : (r < 0.8 ? contribution() : effetCA(3)));
  }

  function recompute(q) {
    var p = q.params;
    if (p.kind === 'moyenne') return (p.a * p.w1 + p.b * p.w2) / 100;
    if (p.kind === 'effetCA') return (p.ca * (1 + p.p / 100)) * (1 + p.v / 100);
    if (p.kind === 'decomp') return p.prix ? (p.p1 * p.q1 - p.p0 * p.q1) : (p.q1 * p.p0 - p.q0 * p.p0);
    if (p.kind === 'relative') return MM.round(p.nous / p.leader, 2);
    return (p.g / 100) * p.w;
  }

  MM.generators['prix-volume-mix'] = { generate: generate, recompute: recompute };
})(window.MM);


/* registry.js — liste des catégories (id, nom, niveaux, fonction génératrice).
 * Pour ajouter une catégorie : créer js/generators/ma-categorie.js, la charger
 * dans index.html (et tests/run-tests.js), puis ajouter une ligne ci-dessous. */
window.MM = window.MM || {};

(function (MM) {
  'use strict';

  var G = MM.generators;

  // bloc : "Socle" (1 à 5) puis "Conseil" (6 à 10)
  var DEFS = [
    { id: 'pourcentages',    nom: 'Pourcentages',        bloc: 'Socle',   exemple: '15 % de 840 ?' },
    { id: 'fractions',       nom: 'Fractions',           bloc: 'Socle',   exemple: '5/8 en % ?' },
    { id: 'multiplications', nom: 'Multiplications',     bloc: 'Socle',   exemple: '48 × 52 ?' },
    { id: 'grands-nombres',  nom: 'Grands nombres',      bloc: 'Socle',   exemple: '2,4 M€ × 35 ?' },
    { id: 'variations',      nom: 'Variations',          bloc: 'Socle',   exemple: 'Après +25 %, prix = 100. Avant ?' },
    { id: 'croissance',      nom: 'Croissance',          bloc: 'Conseil', exemple: '100 → 150 en 5 ans, TCAM ?' },
    { id: 'marges',          nom: 'Marges',              bloc: 'Conseil', exemple: 'Coût 80, prix 100 : markup ?' },
    { id: 'rentabilite',     nom: 'Rentabilité',         bloc: 'Conseil', exemple: 'Point mort : 2 M€ / 40 €' },
    { id: 'market-sizing',   nom: 'Market sizing',       bloc: 'Conseil', exemple: 'Cafés vendus par an en France' },
    { id: 'prix-volume-mix', nom: 'Prix · volume · mix', bloc: 'Conseil', exemple: 'Prix moyen de deux gammes' }
  ];

  MM.categories = DEFS.map(function (d) {
    return {
      id: d.id, nom: d.nom, bloc: d.bloc, exemple: d.exemple,
      niveaux: [1, 2, 3],
      weight: 1,                                   // poids dans le mode Mix
      generate: G[d.id].generate,                  // generate(niveau) -> question
      recompute: G[d.id].recompute                 // recompute(question) -> réponse
    };
  });

  MM.getCategory = function (id) {
    for (var i = 0; i < MM.categories.length; i++) {
      if (MM.categories[i].id === id) return MM.categories[i];
    }
    return null;
  };

  // Recalcule la réponse d'une question par la voie indépendante de sa catégorie.
  MM.recompute = function (question) {
    return MM.getCategory(question.category).recompute(question);
  };

})(window.MM);


/* quiz.js — moteur de session : tirage des questions, score, niveau progressif.
 * Ne touche jamais au DOM ni au stockage : l'interface (app.js) fait le lien. */
window.MM = window.MM || {};

(function (MM) {
  'use strict';

  var MEMOIRE = 30;          // nombre de questions mémorisées pour éviter les doublons
  var SERIE_POUR_MONTER = 5; // mode Progressif : bonnes réponses d'affilée pour monter
  var ERREURS_POUR_BAISSER = 2;

  /* Crée une session.
   * options = { categorie: 'pourcentages' | 'mix', niveau: 1|2|3|'progressif', poids: {id: nombre} } */
  MM.createSession = function (options) {
    var progressif = options.niveau === 'progressif';
    return {
      categorie: options.categorie,
      niveau: progressif ? 1 : Number(options.niveau),
      progressif: progressif,
      poids: options.poids || {},
      recentes: [],           // textes des dernières questions
      total: 0,
      bonnes: 0,
      serie: 0,
      meilleureSerie: 0,
      bonnesDAffilee: 0,      // pour le niveau progressif
      erreursDAffilee: 0,
      ratees: []              // { question, choisi }
    };
  };

  // Catégorie tirée pour la prochaine question (pondérée en mode Mix).
  function tirerCategorie(s) {
    if (s.categorie !== 'mix') return MM.getCategory(s.categorie);
    var items = MM.categories.map(function (c) {
      return { cat: c, weight: c.weight * (s.poids[c.id] || 1) };
    });
    return MM.pickWeighted(items).cat;
  }

  // Tire la prochaine question (sans doublon parmi les 30 dernières).
  MM.nextQuestion = function (s) {
    var q = null;
    for (var essai = 0; essai < 25; essai++) {
      var cat = tirerCategorie(s);
      q = cat.generate(s.niveau);
      if (s.recentes.indexOf(q.text) === -1) break;
    }
    s.recentes.push(q.text);
    if (s.recentes.length > MEMOIRE) s.recentes.shift();
    return q;
  };

  // Enregistre la réponse choisie. Retourne { correct, niveauChange }.
  MM.submitAnswer = function (s, q, indexChoisi) {
    var correct = indexChoisi === q.correctIndex;
    var ancien = s.niveau;
    s.total++;
    if (correct) {
      s.bonnes++;
      s.serie++;
      if (s.serie > s.meilleureSerie) s.meilleureSerie = s.serie;
      s.bonnesDAffilee++;
      s.erreursDAffilee = 0;
      if (s.progressif && s.bonnesDAffilee >= SERIE_POUR_MONTER && s.niveau < 3) {
        s.niveau++;
        s.bonnesDAffilee = 0;
      }
    } else {
      s.serie = 0;
      s.bonnesDAffilee = 0;
      s.erreursDAffilee++;
      s.ratees.push({ question: q, choisi: indexChoisi });
      if (s.progressif && s.erreursDAffilee >= ERREURS_POUR_BAISSER && s.niveau > 1) {
        s.niveau--;
        s.erreursDAffilee = 0;
      }
    }
    return { correct: correct, niveauChange: s.niveau !== ancien };
  };

  MM.sessionPourcentage = function (s) {
    return s.total ? Math.round(s.bonnes / s.total * 100) : 0;
  };

})(window.MM);


/* storage.js — statistiques et réglages dans localStorage (tout le stockage passe ici).
 * Si le stockage est indisponible (mode privé, quota...), on garde tout en mémoire. */
window.MM = window.MM || {};

(function (MM) {
  'use strict';

  var CLE = 'mm-consulting-v1';
  var MAX_ERREURS = 50;
  var MAX_LENTES = 15;

  var etat = null;   // copie en mémoire

  function vide() {
    return {
      version: 1,
      stats: {},               // stats[idCategorie][niveau] = { n, ok }
      meilleureSerie: 0,
      erreurs: [],             // 50 dernières erreurs
      lentes: [],              // 15 questions ayant pris le plus de temps { text, category, level, ms, ok, date }
      reglages: { niveau: '1' }
    };
  }

  function lire() {
    try {
      var brut = window.localStorage.getItem(CLE);
      if (!brut) return vide();
      var data = JSON.parse(brut);
      return (data && data.version === 1) ? data : vide();
    } catch (e) {
      return vide();
    }
  }

  function ecrire() {
    try {
      window.localStorage.setItem(CLE, JSON.stringify(etat));
    } catch (e) { /* stockage indisponible : on continue en mémoire */ }
  }

  function charge() {
    if (!etat) etat = lire();
    if (!etat.lentes) etat.lentes = [];   // anciennes données sans chronomètre
    return etat;
  }

  MM.storage = {
    // Enregistre une réponse. q = question, indexChoisi = option touchée, ms = durée de réflexion.
    enregistrer: function (q, indexChoisi, serieCourante, ms) {
      var e = charge();
      var parCat = e.stats[q.category] = e.stats[q.category] || {};
      var lvl = parCat[q.level] = parCat[q.level] || { n: 0, ok: 0 };
      var correct = indexChoisi === q.correctIndex;
      lvl.n++;
      if (correct) lvl.ok++;
      if (ms > 0) {
        lvl.t = (lvl.t || 0) + ms;       // temps cumulé
        lvl.nt = (lvl.nt || 0) + 1;      // nombre de questions chronométrées
        e.lentes.push({ text: q.text, category: q.category, level: q.level, ms: ms, ok: correct, date: Date.now() });
        e.lentes.sort(function (a, b) { return b.ms - a.ms; });
        if (e.lentes.length > MAX_LENTES) e.lentes.length = MAX_LENTES;
      }
      if (serieCourante > e.meilleureSerie) e.meilleureSerie = serieCourante;
      if (!correct) {
        e.erreurs.unshift({
          category: q.category, level: q.level, text: q.text,
          bonne: q.options[q.correctIndex], choisie: q.options[indexChoisi],
          type: q.optionTypes ? q.optionTypes[indexChoisi] : '', date: Date.now()
        });
        if (e.erreurs.length > MAX_ERREURS) e.erreurs.length = MAX_ERREURS;
      }
      ecrire();
    },

    // { n, ok } d'une catégorie, tous niveaux confondus ou pour un niveau précis.
    statsCategorie: function (id, niveau) {
      var parCat = charge().stats[id] || {};
      var n = 0, ok = 0, t = 0, nt = 0;
      [1, 2, 3].forEach(function (l) {
        if (niveau && niveau !== l) return;
        if (parCat[l]) { n += parCat[l].n; ok += parCat[l].ok; t += parCat[l].t || 0; nt += parCat[l].nt || 0; }
      });
      return { n: n, ok: ok, t: t, nt: nt };
    },

    meilleureSerie: function () { return charge().meilleureSerie; },
    erreurs: function () { return charge().erreurs; },
    lentes: function () { return charge().lentes; },

    reglage: function (nom, defaut) {
      var v = charge().reglages[nom];
      return v === undefined ? defaut : v;
    },
    setReglage: function (nom, valeur) {
      charge().reglages[nom] = valeur;
      ecrire();
    },

    // Efface les statistiques (les réglages sont conservés).
    reinitialiser: function () {
      var reglages = charge().reglages;
      etat = vide();
      etat.reglages = reglages;
      ecrire();
    }
  };

})(window.MM);


/* app.js — toute l'interface (DOM + événements tactiles). Le moteur ne connaît pas le DOM.
 * Écrans : "entrainer" (accueil) · "question" · "recap" · "stats". */
(function (MM) {
  'use strict';

  var racine = document.getElementById('app');

  // ---------- État de l'interface ----------
  var ecran = 'entrainer';
  var session = null;
  var question = null;
  var repondu = false;
  var confirmerReset = false;

  // ---------- Petit utilitaire pour fabriquer des éléments ----------
  // h('button', { class: 'carte', onclick: fn }, [enfants ou texte])
  function h(tag, props, enfants) {
    var el = document.createElement(tag);
    props = props || {};
    Object.keys(props).forEach(function (k) {
      if (k === 'class') el.className = props[k];
      else if (k.indexOf('on') === 0) el.addEventListener(k.slice(2), props[k]);
      else if (k === 'disabled') el.disabled = !!props[k];
      else el.setAttribute(k, props[k]);
    });
    (enfants === undefined ? [] : [].concat(enfants)).forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    });
    return el;
  }

  function pourcent(s) {
    return s.n ? Math.round(s.ok / s.n * 100) : null;
  }

  // ---------- Chronomètre (un par question) ----------
  var chrono = { debut: 0, ecoule: 0, id: null };

  // 4,2 -> "4,2 s" ; 75 s -> "1:15"
  function fmtTemps(ms) {
    var s = ms / 1000;
    if (s < 60) return (Math.round(s * 10) / 10).toFixed(1).replace('.', ',') + ' s';
    var m = Math.floor(s / 60), r = Math.floor(s % 60);
    return m + ':' + (r < 10 ? '0' : '') + r;
  }

  function dureeChrono() {
    return chrono.ecoule + (chrono.debut ? Date.now() - chrono.debut : 0);
  }

  function majChrono() {
    var el = document.getElementById('chrono');
    if (el) el.textContent = fmtTemps(dureeChrono());
  }

  function demarrerChrono() {
    arreterChrono();
    chrono.ecoule = 0;
    chrono.debut = Date.now();
    chrono.id = setInterval(majChrono, 100);
    majChrono();
  }

  // Fige le chrono et renvoie la durée en ms.
  function arreterChrono() {
    if (chrono.id) clearInterval(chrono.id);
    chrono.id = null;
    chrono.ecoule = dureeChrono();
    chrono.debut = 0;
    return chrono.ecoule;
  }

  // Si l'appli passe en arrière-plan, le temps ne compte pas.
  document.addEventListener('visibilitychange', function () {
    if (!chrono.id) return;
    if (document.hidden) { chrono.ecoule = dureeChrono(); chrono.debut = 0; }
    else if (!chrono.debut) chrono.debut = Date.now();
  });

  // ---------- Navigation ----------
  function aller(nom) {
    arreterChrono();
    ecran = nom;
    confirmerReset = false;
    afficher();
  }

  function afficher() {
    racine.innerHTML = '';
    if (ecran === 'question') { racine.appendChild(vueQuestion()); demarrerChrono(); }
    else if (ecran === 'recap') { racine.appendChild(vueRecap()); racine.appendChild(barreOnglets()); }
    else if (ecran === 'stats') { racine.appendChild(vueStats()); racine.appendChild(barreOnglets()); }
    else { racine.appendChild(vueEntrainer()); racine.appendChild(barreOnglets()); }
  }

  function barreOnglets() {
    var actif = ecran === 'stats' ? 'stats' : 'entrainer';
    return h('nav', { class: 'nav' }, [
      h('button', { class: actif === 'entrainer' ? 'actif' : '', onclick: function () { aller('entrainer'); } }, "S'entraîner"),
      h('button', { class: actif === 'stats' ? 'actif' : '', onclick: function () { aller('stats'); } }, 'Stats')
    ]);
  }

  // ---------- Session ----------
  function poidsMix() {
    // Le mode Mix tire un peu plus souvent les catégories les plus faibles.
    var poids = {};
    MM.categories.forEach(function (c) {
      var st = MM.storage.statsCategorie(c.id);
      poids[c.id] = st.n >= 5 ? 1 + (1 - st.ok / st.n) : 1;
    });
    return poids;
  }

  function lancer(idCategorie) {
    session = MM.createSession({
      categorie: idCategorie,
      niveau: MM.storage.reglage('niveau', '1'),
      poids: poidsMix()
    });
    session.temps = [];   // { texte, ms, correct } pour chaque question de la séance
    question = MM.nextQuestion(session);
    repondu = false;
    aller('question');
  }

  function repondre(index) {
    if (repondu) return;
    repondu = true;
    var ms = arreterChrono();
    var res = MM.submitAnswer(session, question, index);
    session.temps.push({ texte: question.text, ms: ms, correct: res.correct });
    MM.storage.enregistrer(question, index, session.serie, ms);
    afficherRetour(index, ms);
  }

  function suivant() {
    question = MM.nextQuestion(session);
    repondu = false;
    afficher();
  }

  function terminer() {
    if (session && session.total > 0) aller('recap');
    else aller('entrainer');
  }

  // ---------- Écran "S'entraîner" ----------
  function vueEntrainer() {
    var niveauActuel = String(MM.storage.reglage('niveau', '1'));
    var choix = [['1', '1'], ['2', '2'], ['3', '3'], ['progressif', 'Progressif']];

    var selecteur = h('div', { class: 'niveaux' }, choix.map(function (c) {
      return h('button', {
        class: c[0] === niveauActuel ? 'actif' : '',
        onclick: function () { MM.storage.setReglage('niveau', c[0]); afficher(); }
      }, c[1]);
    }));

    var enfants = [
      h('h1', {}, 'Calcul mental'),
      h('p', { class: 'sous-titre' }, 'Cases conseil et finance. Chrono sur chaque question.'),
      h('div', { class: 'bloc-titre' }, 'Niveau'),
      selecteur,
      h('div', { class: 'bloc-titre' }, 'Séries'),
      h('button', { class: 'carte mix', onclick: function () { lancer('mix'); } }, [
        h('div', { class: 'ligne' }, [h('span', { class: 'nom' }, 'Mix aléatoire'), h('span', { class: 'taux' }, '')]),
        h('div', { class: 'ex' }, 'Toutes les catégories, tirage pondéré')
      ])
    ];

    var blocCourant = '';
    MM.categories.forEach(function (c, i) {
      if (c.bloc !== blocCourant) {
        blocCourant = c.bloc;
        enfants.push(h('div', { class: 'bloc-titre' }, c.bloc === 'Socle' ? 'Socle (1 à 5)' : 'Conseil (6 à 10)'));
      }
      var p = pourcent(MM.storage.statsCategorie(c.id));
      enfants.push(h('button', { class: 'carte', onclick: function () { lancer(c.id); } }, [
        h('div', { class: 'ligne' }, [
          h('span', { class: 'nom' }, (i + 1) + '. ' + c.nom),
          h('span', { class: 'taux' }, p === null ? '' : p + ' %')
        ]),
        h('div', { class: 'ex' }, c.exemple)
      ]));
    });

    return h('div', { class: 'page' }, enfants);
  }

  // ---------- Écran de question ----------
  function vueQuestion() {
    var infos = h('div', { class: 'infos' }, [
      h('span', { class: 'puce' }, 'Question ' + (session.total + (repondu ? 0 : 1))),
      h('span', { class: 'puce', id: 'puce-serie' }, 'Série ' + session.serie),
      h('span', { class: 'puce' }, 'Niveau ' + question.level)
    ]);

    var boutons = question.options.map(function (texte, i) {
      return h('button', { class: 'rep', 'data-i': String(i), onclick: function () { repondre(i); } }, [
        h('span', { class: 'icone' }, ''), h('span', {}, texte), h('span', {}, '')
      ]);
    });

    var haut = h('div', { class: 'q-haut' }, [
      h('button', { class: 'btn-fin', onclick: terminer }, 'Terminer'),
      h('div', { class: 'chrono', id: 'chrono' }, '0,0 s')
    ]);
    var principal = h('div', { class: 'q-main', id: 'q-main' }, [
      h('div', { class: 'zone-enonce' }, h('div', { class: 'enonce' }, question.text)),
      h('div', { class: 'zone-retour', id: 'zone-retour' })
    ]);
    var reponses = h('div', { class: 'reponses', id: 'reponses' }, boutons);
    var pied = h('div', { class: 'q-pied' }, [
      h('button', { class: 'btn-suivant cache', id: 'btn-suivant', onclick: suivant }, 'Suivant')
    ]);

    return h('div', { class: 'q' }, [haut, infos, principal, reponses, pied]);
  }

  // Met à jour l'écran en place après un clic (pas de re-création : pas de flash).
  function afficherRetour(index, ms) {
    var correct = index === question.correctIndex;
    var boutons = document.querySelectorAll('#reponses .rep');
    Array.prototype.forEach.call(boutons, function (b, i) {
      var icone = b.querySelector('.icone');
      if (i === question.correctIndex) { b.classList.add('ok'); icone.textContent = '✓'; }
      else if (i === index) { b.classList.add('ko'); icone.textContent = '✗'; }
      else b.classList.add('neutre');
      b.disabled = true;
    });

    var retour = h('div', { class: 'retour ' + (correct ? 'ok' : 'ko') }, [
      h('div', { class: 'verdict' }, (correct ? '✓ Juste' : '✗ Faux. Réponse : ' + question.options[question.correctIndex]) + ' · ' + fmtTemps(ms)),
      h('div', {}, question.explanation),
      question.trick ? h('div', { class: 'astuce' }, '💡 ' + question.trick) : null
    ]);
    document.getElementById('zone-retour').appendChild(retour);
    majChrono();
    document.getElementById('chrono').classList.add('fige');

    document.getElementById('puce-serie').textContent = 'Série ' + session.serie;
    document.getElementById('btn-suivant').classList.remove('cache');
  }

  // ---------- Récapitulatif ----------
  function moyenne(temps) {
    if (!temps || !temps.length) return 0;
    var somme = 0;
    temps.forEach(function (t) { somme += t.ms; });
    return somme / temps.length;
  }

  function vueRecap() {
    var s = session;
    var enfants = [
      h('h1', {}, 'Séance terminée'),
      h('div', { class: 'chiffres' }, [
        h('div', { class: 'chiffre' }, [h('b', {}, s.total), h('span', {}, 'questions')]),
        h('div', { class: 'chiffre' }, [h('b', {}, MM.sessionPourcentage(s) + ' %'), h('span', {}, 'réussite')]),
        h('div', { class: 'chiffre' }, [h('b', {}, s.meilleureSerie), h('span', {}, 'meilleure série')]),
        h('div', { class: 'chiffre' }, [h('b', {}, fmtTemps(moyenne(s.temps))), h('span', {}, 'temps moyen')])
      ])
    ];

    var lentes = (s.temps || []).slice().sort(function (a, b) { return b.ms - a.ms; }).slice(0, 5);
    if (lentes.length) {
      enfants.push(h('h2', {}, 'Les plus longues'));
      lentes.forEach(function (t) {
        enfants.push(h('div', { class: 'liste-erreur' }, [
          h('span', { class: 'temps' }, fmtTemps(t.ms)),
          h('div', { class: 'q-txt' }, t.texte),
          h('div', { class: t.correct ? 'bonne' : 'faux' }, t.correct ? '✓ Juste' : '✗ Faux')
        ]));
      });
    }

    if (s.ratees.length) {
      enfants.push(h('h2', {}, 'À revoir (' + s.ratees.length + ')'));
      s.ratees.forEach(function (r) {
        enfants.push(h('div', { class: 'liste-erreur' }, [
          h('div', { class: 'q-txt' }, r.question.text),
          h('div', { class: 'faux' }, '✗ ' + r.question.options[r.choisi]),
          h('div', { class: 'bonne' }, '✓ ' + r.question.options[r.question.correctIndex]),
          h('div', { class: 'ex', style: 'color:var(--muted)' }, r.question.explanation)
        ]));
      });
    } else {
      enfants.push(h('p', { class: 'vide' }, 'Aucune erreur sur cette séance.'));
    }

    enfants.push(h('button', { class: 'btn-large', onclick: function () { lancer(s.categorie); } }, 'Rejouer la même série'));
    enfants.push(h('button', { class: 'btn-large secondaire', onclick: function () { aller('entrainer'); } }, "Retour à l'accueil"));
    return h('div', { class: 'page' }, enfants);
  }

  // ---------- Stats ----------
  function categorieLaPlusFaible() {
    var pire = null;
    MM.categories.forEach(function (c) {
      var st = MM.storage.statsCategorie(c.id);
      if (st.n < 10) return;
      var taux = st.ok / st.n;
      if (!pire || taux < pire.taux) pire = { id: c.id, nom: c.nom, taux: taux };
    });
    return pire;
  }

  function vueStats() {
    var lignes = MM.categories.map(function (c) {
      var cellules = [1, 2, 3].map(function (l) {
        var st = MM.storage.statsCategorie(c.id, l);
        return h('td', {}, st.n ? [
          Math.round(st.ok / st.n * 100) + ' %',
          h('small', {}, st.n + ' q.'),
          st.nt ? h('small', {}, '⌀ ' + fmtTemps(st.t / st.nt)) : null
        ] : '–');
      });
      return h('tr', {}, [h('td', {}, c.nom)].concat(cellules));
    });

    var faible = categorieLaPlusFaible();
    var enfants = [
      h('h1', {}, 'Stats'),
      h('p', { class: 'sous-titre' }, 'Meilleure série : ' + MM.storage.meilleureSerie()),
      h('table', { class: 'stats' }, [
        h('thead', {}, h('tr', {}, [h('th', {}, 'Catégorie'), h('th', {}, 'Niv. 1'), h('th', {}, 'Niv. 2'), h('th', {}, 'Niv. 3')])),
        h('tbody', {}, lignes)
      ]),
      h('button', {
        class: 'btn-large', disabled: !faible,
        onclick: function () { if (faible) lancer(faible.id); }
      }, faible ? 'Travailler ma catégorie la plus faible (' + faible.nom + ')' : 'Catégorie la plus faible : 10 réponses minimum'),
      h('h2', {}, 'Questions les plus longues')
    ];

    var lentes = MM.storage.lentes();
    if (!lentes.length) enfants.push(h('p', { class: 'vide' }, 'Pas encore de temps enregistré.'));
    lentes.slice(0, 10).forEach(function (e) {
      var cat = MM.getCategory(e.category);
      enfants.push(h('div', { class: 'liste-erreur' }, [
        h('span', { class: 'temps' }, fmtTemps(e.ms)),
        h('div', { class: 'q-txt' }, e.text),
        h('div', { class: 'ex', style: 'color:var(--muted)' }, (cat ? cat.nom : e.category) + ' · niveau ' + e.level + (e.ok ? '' : ' · ✗ ratée'))
      ]));
    });

    enfants.push(h('h2', {}, '50 dernières erreurs'));

    var erreurs = MM.storage.erreurs();
    if (!erreurs.length) enfants.push(h('p', { class: 'vide' }, 'Aucune erreur enregistrée.'));
    erreurs.forEach(function (e) {
      enfants.push(h('div', { class: 'liste-erreur' }, [
        h('div', { class: 'q-txt' }, e.text),
        h('div', { class: 'faux' }, '✗ ' + e.choisie),
        h('div', { class: 'bonne' }, '✓ ' + e.bonne)
      ]));
    });

    // Réinitialisation avec confirmation dans l'interface (pas d'alert() natif).
    if (confirmerReset) {
      enfants.push(h('div', { class: 'confirmation' }, [
        h('div', {}, 'Effacer toutes les statistiques ? Action définitive.'),
        h('div', { class: 'rang' }, [
          h('button', { class: 'btn-large secondaire', onclick: function () { confirmerReset = false; afficher(); } }, 'Annuler'),
          h('button', { class: 'btn-large danger', onclick: function () { MM.storage.reinitialiser(); confirmerReset = false; afficher(); } }, 'Effacer')
        ])
      ]));
    } else {
      enfants.push(h('button', { class: 'btn-large danger', onclick: function () { confirmerReset = true; afficher(); } }, 'Réinitialiser'));
    }

    return h('div', { class: 'page' }, enfants);
  }

  // ---------- Démarrage ----------
  afficher();

  // Écran d'ouverture : le logo reste 2,79 s, puis fondu vers l'accueil (déjà affiché dessous).
  var splash = document.getElementById('splash');
  if (splash) {
    setTimeout(function () {
      splash.classList.add('fin');
      setTimeout(function () { if (splash.parentNode) splash.parentNode.removeChild(splash); }, 450);
    }, 2790);
  }

  // Service worker : fonctionnement hors ligne (uniquement en http/https, pas en file://).
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js').catch(function () { /* hors ligne non disponible */ });
    });
  }

})(window.MM);

