// Muskelgruppen, die im Dashboard ausgewertet werden.
const MUSCLES = {
  brust: 'Brust',
  ruecken: 'Rücken',
  schultern: 'Schultern',
  bizeps: 'Bizeps',
  trizeps: 'Trizeps',
  quads: 'Quadrizeps',
  beinbeuger: 'Beinbeuger',
  po: 'Po',
  waden: 'Waden',
  bauch: 'Bauch',
};

// Startplan beim ersten Öffnen. Wird später durch den echten Trainingsplan ersetzt.
// sets = Standard-Sätze, reps = Ziel-Wiederholungen.
const DEFAULT_PLAN = {
  days: [
    {
      id: 'push',
      name: 'Push',
      exercises: [
        { id: 'bankdruecken', name: 'Bankdrücken', muscle: 'brust', sets: 3, reps: 8 },
        { id: 'schraegbank-kh', name: 'Schrägbankdrücken KH', muscle: 'brust', sets: 3, reps: 10 },
        { id: 'schulterdruecken', name: 'Schulterdrücken', muscle: 'schultern', sets: 3, reps: 10 },
        { id: 'seitheben', name: 'Seitheben', muscle: 'schultern', sets: 3, reps: 12 },
        { id: 'trizeps-kabel', name: 'Trizepsdrücken Kabel', muscle: 'trizeps', sets: 3, reps: 12 },
      ],
    },
    {
      id: 'pull',
      name: 'Pull',
      exercises: [
        { id: 'klimmzuege', name: 'Latziehen', muscle: 'ruecken', sets: 3, reps: 10 },
        { id: 'rudern-lh', name: 'Rudern Langhantel', muscle: 'ruecken', sets: 3, reps: 8 },
        { id: 'face-pulls', name: 'Face Pulls', muscle: 'schultern', sets: 3, reps: 15 },
        { id: 'bizeps-curls', name: 'Bizeps Curls', muscle: 'bizeps', sets: 3, reps: 10 },
      ],
    },
    {
      id: 'legs',
      name: 'Beine',
      exercises: [
        { id: 'kniebeuge', name: 'Kniebeuge', muscle: 'quads', sets: 3, reps: 8 },
        { id: 'rumaenisches-kh', name: 'Rumänisches Kreuzheben', muscle: 'beinbeuger', sets: 3, reps: 10 },
        { id: 'beinpresse', name: 'Beinpresse', muscle: 'quads', sets: 3, reps: 12 },
        { id: 'hip-thrust', name: 'Hip Thrust', muscle: 'po', sets: 3, reps: 10 },
        { id: 'wadenheben', name: 'Wadenheben', muscle: 'waden', sets: 3, reps: 15 },
        { id: 'crunches', name: 'Kabel-Crunches', muscle: 'bauch', sets: 3, reps: 15 },
      ],
    },
  ],
};
