// Muskelgruppen, die im Dashboard ausgewertet werden.
const MUSCLES = {
  brust: 'Brust',
  ruecken: 'Rücken',
  schultern: 'Schultern',
  bizeps: 'Bizeps',
  trizeps: 'Trizeps',
  quads: 'Quadrizeps',
  beinbeuger: 'Beinbeuger',
  adduktoren: 'Adduktoren',
  bauch: 'Bauch',
};

// Startplan beim ersten Öffnen (bzw. über „Plan → Standardplan laden“).
// sets = Standard-Sätze. Gewicht und Wiederholungen kommen immer aus dem letzten Training.
// Gleichnamige Übungen an verschiedenen Tagen teilen sich den Gewichtsverlauf.
const DEFAULT_PLAN = {
  days: [
    {
      id: 'ok-a',
      name: 'Oberkörper A',
      exercises: [
        { id: 'ok-a-schraegbank', name: 'Schrägbank', muscle: 'brust', sets: 2 },
        { id: 'ok-a-butterfly', name: 'Butterfly', muscle: 'brust', sets: 2 },
        { id: 'ok-a-rows', name: 'Mario Rows', muscle: 'ruecken', sets: 2 },
        { id: 'ok-a-latzug', name: 'Latzug', muscle: 'ruecken', sets: 1 },
        { id: 'ok-a-seitheben', name: 'Seitheben', muscle: 'schultern', sets: 2 },
        { id: 'ok-a-reverse-butterfly', name: 'Reverse Butterfly', muscle: 'schultern', sets: 1 },
        { id: 'ok-a-katana', name: 'Katana Extensions', muscle: 'trizeps', sets: 1 },
        { id: 'ok-a-sigma-curls', name: 'Sigma Curls', muscle: 'bizeps', sets: 1 },
      ],
    },
    {
      id: 'uk-a',
      name: 'Unterkörper A',
      exercises: [
        { id: 'uk-a-beinpresse', name: 'Beinpresse', muscle: 'quads', sets: 2 },
        { id: 'uk-a-beinstrecker', name: 'Beinstrecker', muscle: 'quads', sets: 2 },
        { id: 'uk-a-beinbeuger', name: 'Beinbeuger', muscle: 'beinbeuger', sets: 1 },
        { id: 'uk-a-adduktoren', name: 'Adduktoren', muscle: 'adduktoren', sets: 1 },
        { id: 'uk-a-cable-crunches', name: 'Cable Crunches', muscle: 'bauch', sets: 1 },
      ],
    },
    {
      id: 'ok-b',
      name: 'Oberkörper B',
      exercises: [
        { id: 'ok-b-rows', name: 'Mario Rows', muscle: 'ruecken', sets: 2 },
        { id: 'ok-b-latzug', name: 'Latzug', muscle: 'ruecken', sets: 2 },
        { id: 'ok-b-kelso-shrugs', name: 'Kelso Shrugs', muscle: 'ruecken', sets: 1 },
        { id: 'ok-b-butterfly', name: 'Butterfly', muscle: 'brust', sets: 2 },
        { id: 'ok-b-seitheben', name: 'Seitheben', muscle: 'schultern', sets: 2 },
        { id: 'ok-b-skull-crushers', name: 'Skull Crushers', muscle: 'trizeps', sets: 1 },
        { id: 'ok-b-preacher-curls', name: 'Preacher Curls', muscle: 'bizeps', sets: 1 },
      ],
    },
    {
      id: 'uk-b',
      name: 'Unterkörper B',
      exercises: [
        { id: 'uk-b-rdl', name: 'Romanian Deadlifts', muscle: 'beinbeuger', sets: 2 },
        { id: 'uk-b-beinbeuger', name: 'Beinbeuger', muscle: 'beinbeuger', sets: 2 },
        { id: 'uk-b-beinpresse', name: 'Beinpresse', muscle: 'quads', sets: 2 },
        { id: 'uk-b-beinstrecker', name: 'Beinstrecker', muscle: 'quads', sets: 1 },
        { id: 'uk-b-cable-crunches', name: 'Cable Crunches', muscle: 'bauch', sets: 1 },
      ],
    },
    {
      id: 'ok-c',
      name: 'Oberkörper C',
      exercises: [
        { id: 'ok-c-seitheben', name: 'Seitheben', muscle: 'schultern', sets: 2 },
        { id: 'ok-c-reverse-butterfly', name: 'Reverse Butterfly', muscle: 'schultern', sets: 2 },
        { id: 'ok-c-schraegbank', name: 'Schrägbank', muscle: 'brust', sets: 1 },
        { id: 'ok-c-butterfly', name: 'Butterfly', muscle: 'brust', sets: 1 },
        { id: 'ok-c-rows', name: 'Mario Rows', muscle: 'ruecken', sets: 1 },
        { id: 'ok-c-latzug', name: 'Latzug', muscle: 'ruecken', sets: 1 },
        { id: 'ok-c-katana', name: 'Katana Extensions', muscle: 'trizeps', sets: 2 },
        { id: 'ok-c-preacher-curls', name: 'Preacher Curls', muscle: 'bizeps', sets: 2 },
      ],
    },
  ],
};
