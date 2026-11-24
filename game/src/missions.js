// The story of Tanjung Kaca: eight missions in order, told by Rani, a courier who
// knows every street, and Pak Darma, the garage owner. Each mission is a list of
// steps the world engine walks through; the engine only reads the world state,
// so a mission can be restarted cleanly at any time.

export const MISSIONS = [
  {
    id: 'pagi',
    title: 'Pagi di Tanjung Kaca',
    giver: 'Rani',
    intro: [
      'Rani: "Kamu baru di Tanjung Kaca? Kota ini cantik kalau matahari naik — dan berbahaya kalau kamu lengah."',
      'Rani: "Temui aku di Kafe Senja. Aku punya kerjaan buatmu, kalau kamu berani."',
    ],
    outro: ['Rani: "Bagus. Kamu cepat. Kerja sama kita baru mulai."'],
    reward: 100,
    steps: [{ kind: 'goto', text: 'Temui Rani di Kafe Senja', x: 940, y: 700, r: 70 }],
  },
  {
    id: 'paket',
    title: 'Paket Kilat',
    giver: 'Rani',
    intro: [
      'Rani: "Ambil paketnya di Pangkalan, antar ke pelabuhan timur. Jangan telat — pelanggan ini tidak suka menunggu."',
    ],
    outro: ['Rani: "Tepat waktu. Pelanggan senang, aku senang."'],
    reward: 150,
    steps: [
      { kind: 'goto', text: 'Ambil paket di Pangkalan', x: 1600, y: 1300, r: 70 },
      { kind: 'goto', text: 'Antar paket ke gudang timur', x: 2900, y: 1900, r: 80 },
    ],
  },
  {
    id: 'sport',
    title: 'Mobil Impian',
    giver: 'Pak Darma',
    intro: [
      'Pak Darma: "Ada mobil sport merah parkir di jalan utara. Pemiliknya sedang liburan — dia tidak akan merindukannya."',
      'Pak Darma: "Curi mobil itu (E di dekat mobil), bawa ke bengkelku. Hati-hati, polisi tidak suka pencuri."',
    ],
    outro: ['Pak Darma: "Mesinnya masih mulus. Kamu punya bakat, nak."'],
    reward: 250,
    steps: [
      { kind: 'steal', text: 'Curi mobil sport merah di jalan utara', x: 2500, y: 430, r: 90, car: 'sport' },
      { kind: 'driveTo', text: 'Bawa mobil ke Bengkel Pak Darma', x: 700, y: 1900, r: 90 },
    ],
  },
  {
    id: 'balapan',
    title: 'Balapan Senja',
    giver: 'Rani',
    intro: [
      'Rani: "Pembalap pantai menantangmu. Lewati semua titik balapan sebelum waktu habis. Naik mobil dulu!"',
    ],
    outro: ['Rani: "Kamu mengalahkan mereka semua! Kota ini sekarang tahu namamu."'],
    reward: 300,
    steps: [{
      kind: 'race', text: 'Lewati semua titik balapan', time: 80,
      checkpoints: [
        { x: 400, y: 400 }, { x: 2800, y: 400 }, { x: 2800, y: 2200 }, { x: 400, y: 2200 }, { x: 1600, y: 1000 },
      ],
    }],
  },
  {
    id: 'kejaran',
    title: 'Lepas dari Kejaran',
    giver: 'Pak Darma',
    intro: [
      'Pak Darma: "Polisi mengincarmu. Buat mereka mengejarmu, lalu hilangkan jejakmu. Bersembunyi sampai bintangmu padam."',
    ],
    outro: ['Pak Darma: "Bersih. Mereka bahkan tidak tahu kamu ke mana."'],
    reward: 350,
    steps: [{ kind: 'wanted', text: 'Dapatkan 2 bintang, lalu hilangkan semuanya', r: 0 }],
  },
  {
    id: 'kios',
    title: 'Kios Emas',
    giver: 'Rani',
    intro: [
      'Rani: "Kios Emas menyimpan uang tunai di laci. Berdiri di depannya sampai brankas terbuka, lalu kabur dari polisi."',
    ],
    outro: ['Rani: "Uang tunai di tangan. Jangan dihabiskan sekaligus."'],
    reward: 500,
    steps: [
      { kind: 'rob', text: 'Rampok Kios Emas (berdiri di depannya)', x: 1060, y: 1860, r: 80 },
      { kind: 'wanted', text: 'Kabur dan hilangkan semua bintang', r: 0 },
    ],
  },
  {
    id: 'antar',
    title: 'Antar Rani',
    giver: 'Rani',
    intro: [
      'Rani: "Aku harus ke Dermaga sebelum kapal berangkat. Antar aku dengan mobil — dan jangan sampai polisi menilang kita."',
    ],
    outro: ['Rani: "Tepat waktu. Kamu mengemudi seperti pembalap sungguhan."'],
    reward: 400,
    steps: [
      { kind: 'goto', text: 'Jemput Rani di Kafe Senja', x: 940, y: 700, r: 70 },
      { kind: 'escort', text: 'Antar Rani ke Dermaga (dengan mobil)', x: 3350, y: 2280, r: 90 },
    ],
  },
  {
    id: 'terakhir',
    title: 'Pengiriman Terakhir',
    giver: 'Pak Darma',
    intro: [
      'Pak Darma: "Paket terakhir malam ini. Polisi sudah mengendusmu — mereka akan mengejar. Antar paketnya ke Dermaga apa pun yang terjadi."',
    ],
    outro: ['Pak Darma: "Selesai. Tanjung Kaca sekarang milikmu, nak."'],
    reward: 600,
    steps: [{ kind: 'deliver', text: 'Antar paket ke Dermaga selagi dikejar polisi', x: 3350, y: 2280, r: 90 }],
  },
];

export const SIDE_JOB_REWARD = 80;

/** Set up a fresh mission on the state; returns its intro lines for the dialog. */
export function startMission(state, index) {
  const mission = MISSIONS[index];
  state.mission = {
    index,
    step: 0,
    timer: 0,
    robTimer: 0,
    wantedPhase: 0,
    checkpoint: 0,
    targetCarId: null,
    active: true,
  };
  const step = mission.steps[0];
  if (step.kind === 'steal') {
    const car = state.cars.find((c) => c.kind === 'sport' && c.parked);
    if (car) state.mission.targetCarId = car.id;
  }
  if (step.kind === 'race') state.mission.timer = step.time;
  if (mission.id === 'terakhir') {
    state.wanted.stars = Math.max(state.wanted.stars, 2);
    state.wanted.heat = 0;
  }
  return mission.intro;
}

export function currentMission(state) {
  if (!state.mission.active || state.mission.index >= MISSIONS.length) return null;
  return MISSIONS[state.mission.index];
}

export function currentStep(state) {
  const mission = currentMission(state);
  if (!mission) return null;
  return mission.steps[state.mission.step] ?? null;
}

export function missionObjectiveText(state) {
  const mission = currentMission(state);
  if (!mission) return 'Semua misi selesai — jelajahi kota, cari kerja sampingan di Pangkalan.';
  const step = currentStep(state);
  if (!step) return mission.title;
  let text = `${mission.title}: ${step.text}`;
  if (step.kind === 'race') {
    text += ` — titik ${state.mission.checkpoint + 1}/${step.checkpoints.length} · ${Math.max(0, Math.ceil(state.mission.timer))} dtk`;
  }
  if (step.kind === 'rob' && state.mission.robTimer > 0) {
    text += ` — ${Math.ceil(4 - state.mission.robTimer)} dtk lagi`;
  }
  return text;
}

/**
 * Advance the active mission. Returns { completed, failed, note } — the world
 * turns a completion into money, a banner and the next mission's intro.
 */
export function updateMission(state, dt) {
  const mission = currentMission(state);
  if (!mission) return { completed: false, failed: false };
  const step = currentStep(state);
  if (!step) return { completed: false, failed: false };
  const p = state.player;

  if (step.kind === 'goto' || step.kind === 'driveTo' || step.kind === 'escort' || step.kind === 'deliver') {
    const dx = p.x - step.x;
    const dy = p.y - step.y;
    if (dx * dx + dy * dy < step.r * step.r) {
      if (step.kind === 'driveTo' || step.kind === 'escort') {
        if (!p.inCar) return { completed: false, failed: false };
      }
      return advance(state, mission);
    }
    return { completed: false, failed: false };
  }
  if (step.kind === 'steal') {
    if (state.mission.targetCarId !== null && p.inCar === state.mission.targetCarId) return advance(state, mission);
    return { completed: false, failed: false };
  }
  if (step.kind === 'race') {
    state.mission.timer -= dt;
    if (state.mission.timer <= 0) return { completed: false, failed: true, note: 'Waktu balapan habis!' };
    const cp = step.checkpoints[state.mission.checkpoint];
    if (cp) {
      const dx = p.x - cp.x;
      const dy = p.y - cp.y;
      if (dx * dx + dy * dy < 90 * 90) {
        state.mission.checkpoint += 1;
        if (state.mission.checkpoint >= step.checkpoints.length) return advance(state, mission);
      }
    }
    return { completed: false, failed: false };
  }
  if (step.kind === 'rob') {
    const dx = p.x - step.x;
    const dy = p.y - step.y;
    if (dx * dx + dy * dy < step.r * step.r && !p.inCar) {
      state.mission.robTimer += dt;
      if (state.mission.robTimer >= 4) {
        state.wanted.stars = Math.min(5, state.wanted.stars + 2);
        state.wanted.heat = 0;
        return advance(state, mission);
      }
    } else {
      state.mission.robTimer = Math.max(0, state.mission.robTimer - dt * 2);
    }
    return { completed: false, failed: false };
  }
  if (step.kind === 'wanted') {
    if (state.mission.wantedPhase === 0) {
      if (state.wanted.stars >= 2) state.mission.wantedPhase = 1;
    } else if (state.wanted.stars === 0) {
      return advance(state, mission);
    }
    return { completed: false, failed: false };
  }
  return { completed: false, failed: false };
}

function advance(state, mission) {
  state.mission.step += 1;
  state.mission.robTimer = 0;
  state.mission.wantedPhase = 0;
  state.mission.checkpoint = 0;
  if (state.mission.step >= mission.steps.length) {
    state.mission.active = false;
    return { completed: true, failed: false };
  }
  const next = mission.steps[state.mission.step];
  if (next.kind === 'steal') {
    const car = state.cars.find((c) => c.kind === 'sport' && c.parked);
    if (car) state.mission.targetCarId = car.id;
  }
  if (next.kind === 'race') state.mission.timer = next.time;
  return { completed: false, failed: false };
}

/** Start the repeatable delivery side job from the Pangkalan stand. */
export function startSideJob(state) {
  const targets = [
    { x: 400, y: 2200, label: 'ujung barat' },
    { x: 2800, y: 400, label: 'timur laut' },
    { x: 2200, y: 1600, label: 'tengah kota' },
    { x: 1000, y: 400, label: 'utara' },
  ];
  const t = targets[Math.floor(state.random() * targets.length)];
  state.sideJob = { active: true, x: t.x, y: t.y, label: t.label };
  return `Antar paket ke ${t.label}. Cepat, ada bonus kalau tidak menabrak apa-apa!`;
}

export function updateSideJob(state) {
  if (!state.sideJob.active) return false;
  const p = state.player;
  const dx = p.x - state.sideJob.x;
  const dy = p.y - state.sideJob.y;
  if (dx * dx + dy * dy < 80 * 80) {
    state.sideJob.active = false;
    return true;
  }
  return false;
}
