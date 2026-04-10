import './style.css';

type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';
type Lang = 'ja' | 'en';

const TEXT = {
  ja: {
    title: '数独 Infinity',
    subtitle: 'PC・スマホ両対応。好きなだけ遊べる、ちょっとポップな数独サイト。',
    easy: '初級',
    medium: '中級',
    hard: '上級',
    expert: '最上級',
    newGame: '新しい問題',
    restart: '最初から',
    noteMode: 'メモ',
    hint: 'ヒント',
    clear: '消す',
    loading: '問題を生成しています…',
    solved: 'クリア！',
    puzzleComplete: 'クリア数を保存しました。次の問題にも挑戦できます。',
    restarted: 'この問題を最初からやり直しました。',
    solvedCount: 'クリア数',
    timer: '経過',
    progress: '進捗',
    selected: '選択中',
    noSelection: 'なし',
    instructions: '数字を先に選ぶ／マスを先に選ぶ、どちらでも操作できます。青い数字はもう一度押すと解除できます。',
    resume: '途中状態は自動保存されます。',
    hintResultWrong: 'この盤面は矛盾しています。赤いマスを見直してください。',
    hintResultCell: 'このマスに注目してください。候補が1つだけです。',
    hintResultNone: '今はメモを見直すと進める可能性があります。',
    hintFocusRow: 'この行に注目してください。置ける場所が1つだけあります。',
    hintFocusColumn: 'この列に注目してください。置ける場所が1つだけあります。',
    hintFocusBox: 'この9マスブロックに注目してください。置ける場所が1つだけあります。',
    privacyTitle: '保存について',
    privacy:
      'このサイトはユーザーのデータをサーバーへ一切保存しません。進捗・設定・クリア数は、このブラウザの localStorage のみに保存されます。',
    keyboard: 'PCではキーボード入力、スマホではタップ入力に対応しています。',
    on: 'ON',
    off: 'OFF',
    currentDifficulty: '難しさ',
  },
  en: {
    title: 'Sudoku Infinity',
    subtitle: 'Play endlessly on desktop or mobile with a light, friendly design.',
    easy: 'Easy',
    medium: 'Medium',
    hard: 'Hard',
    expert: 'Expert+',
    newGame: 'New puzzle',
    restart: 'Restart',
    noteMode: 'Notes',
    hint: 'Hint',
    clear: 'Clear',
    loading: 'Generating a puzzle…',
    solved: 'Solved!',
    puzzleComplete: 'Your clear count has been saved. Ready for the next puzzle.',
    restarted: 'This puzzle has been reset to the beginning.',
    solvedCount: 'Solved',
    timer: 'Time',
    progress: 'Progress',
    selected: 'Selected',
    noSelection: 'None',
    instructions: 'You can choose a digit first or a cell first. Tap the active blue digit again to deselect it.',
    resume: 'Your in-progress board is auto-saved in this browser.',
    hintResultWrong: 'This board has a contradiction. Please review the red cells.',
    hintResultCell: 'Focus on this cell. It has only one candidate left.',
    hintResultNone: 'Review your notes to find the next step.',
    hintFocusRow: 'Focus on this row. There is only one place left for the digit.',
    hintFocusColumn: 'Focus on this column. There is only one place left for the digit.',
    hintFocusBox: 'Focus on this 3×3 box. There is only one place left for the digit.',
    privacyTitle: 'Storage notice',
    privacy:
      'This site does not store your data on any server. Progress, settings, and solve counts stay only in your browser localStorage.',
    keyboard: 'Keyboard input works on desktop, and tap input works on mobile.',
    on: 'ON',
    off: 'OFF',
    currentDifficulty: 'Difficulty',
  },
} as const;

type MessageKey = keyof typeof TEXT.ja;

interface CellState {
  value: number;
  fixed: boolean;
  notes: number[];
}

interface GameState {
  difficulty: Difficulty;
  puzzle: number[];
  solution: number[];
  cells: CellState[];
  noteMode: boolean;
  selectedCell: number | null;
  selectedDigit: number | null;
  hintCell: number | null;
  hintScope: number[];
  wrongCells: number[];
  elapsedSeconds: number;
  completed: boolean;
  generating: boolean;
  messageKey: MessageKey;
}

interface Stats {
  easy: number;
  medium: number;
  hard: number;
  expert: number;
}

interface LogicalMove {
  index: number;
  value: number;
  reason: 'single' | 'row' | 'column' | 'box';
  highlightIndices: number[];
}

interface DifficultyAnalysis {
  initialSingles: number;
  totalSingles: number;
  solvedByLogic: boolean;
  stalled: boolean;
  minRemainingCandidates: number;
  emptyCells: number;
}

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('App container not found.');
}

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard', 'expert'];
const STORAGE_KEYS = {
  stats: 'sudoku-infinity-stats',
  game: 'sudoku-infinity-current',
  lang: 'sudoku-infinity-language',
} as const;
const DIFFICULTY_SETTINGS: Record<Difficulty, { clues: [number, number]; attempts: number }> = {
  easy: { clues: [40, 44], attempts: 5 },
  medium: { clues: [33, 36], attempts: 6 },
  hard: { clues: [28, 31], attempts: 8 },
  expert: { clues: [23, 25], attempts: 12 },
};
const UNITS = buildUnits();
const PEERS = buildPeers();

let language: Lang = loadLanguage();
let stats: Stats = loadStats();
let state: GameState = loadSavedGame() ?? createEmptyState('easy');

document.addEventListener('keydown', handleKeydown);
window.setInterval(() => {
  if (!state.generating && state.puzzle.length > 0 && !state.completed) {
    state.elapsedSeconds += 1;
    if (state.elapsedSeconds % 5 === 0) {
      persistGame();
    }
    updateElapsedTimeUI();
  }
}, 1000);

render();
if (state.puzzle.length === 0) {
  void startNewGame('easy');
}

function t(key: MessageKey): string {
  return TEXT[language][key];
}

function difficultyLabel(difficulty: Difficulty): string {
  return TEXT[language][difficulty];
}

function createEmptyState(difficulty: Difficulty): GameState {
  return {
    difficulty,
    puzzle: [],
    solution: [],
    cells: [],
    noteMode: false,
    selectedCell: null,
    selectedDigit: null,
    hintCell: null,
    hintScope: [],
    wrongCells: [],
    elapsedSeconds: 0,
    completed: false,
    generating: false,
    messageKey: 'resume',
  };
}

function loadLanguage(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.lang);
    if (saved === 'ja' || saved === 'en') {
      return saved;
    }
  } catch {
    // ignore storage access errors
  }

  return navigator.language.toLowerCase().startsWith('ja') ? 'ja' : 'en';
}

function loadStats(): Stats {
  const base: Stats = { easy: 0, medium: 0, hard: 0, expert: 0 };

  try {
    const raw = localStorage.getItem(STORAGE_KEYS.stats);
    if (!raw) {
      return base;
    }

    const parsed = JSON.parse(raw) as Partial<Stats>;
    return {
      easy: Number(parsed.easy ?? 0),
      medium: Number(parsed.medium ?? 0),
      hard: Number(parsed.hard ?? 0),
      expert: Number(parsed.expert ?? 0),
    };
  } catch {
    return base;
  }
}

function loadSavedGame(): GameState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.game);
    if (!raw) {
      return null;
    }

    const saved = JSON.parse(raw) as Partial<GameState> & { cells?: Partial<CellState>[] };
    if (!saved || !Array.isArray(saved.puzzle) || !Array.isArray(saved.solution) || !Array.isArray(saved.cells)) {
      return null;
    }

    const difficulty = DIFFICULTIES.includes(saved.difficulty as Difficulty)
      ? (saved.difficulty as Difficulty)
      : 'easy';
    const puzzle = saved.puzzle.slice(0, 81).map((value) => Number(value) || 0);
    const solution = saved.solution.slice(0, 81).map((value) => Number(value) || 0);

    if (puzzle.length !== 81 || solution.length !== 81) {
      return null;
    }

    return {
      difficulty,
      puzzle,
      solution,
      cells: saved.cells.slice(0, 81).map((cell, index) => normalizeCell(cell, index, puzzle)),
      noteMode: Boolean(saved.noteMode),
      selectedCell: null,
      selectedDigit: saved.selectedDigit && DIGITS.includes(saved.selectedDigit as (typeof DIGITS)[number])
        ? Number(saved.selectedDigit)
        : null,
      hintCell: null,
      hintScope: [],
      wrongCells: [],
      elapsedSeconds: Math.max(0, Number(saved.elapsedSeconds ?? 0)),
      completed: Boolean(saved.completed),
      generating: false,
      messageKey: 'resume',
    };
  } catch {
    return null;
  }
}

function normalizeCell(cell: Partial<CellState> | undefined, index: number, puzzle: number[]): CellState {
  const fixedValue = puzzle[index] ?? 0;
  const value = fixedValue !== 0 ? fixedValue : Math.max(0, Math.min(9, Number(cell?.value ?? 0)));
  const notes = Array.isArray(cell?.notes)
    ? cell.notes
        .map((note) => Number(note))
        .filter((note) => Number.isInteger(note) && note >= 1 && note <= 9)
        .sort((a, b) => a - b)
    : [];

  return {
    value,
    fixed: fixedValue !== 0,
    notes,
  };
}

function persistStats(): void {
  try {
    localStorage.setItem(STORAGE_KEYS.stats, JSON.stringify(stats));
  } catch {
    // ignore storage access errors
  }
}

function persistGame(): void {
  if (state.puzzle.length !== 81 || state.solution.length !== 81) {
    return;
  }

  try {
    localStorage.setItem(
      STORAGE_KEYS.game,
      JSON.stringify({
        difficulty: state.difficulty,
        puzzle: state.puzzle,
        solution: state.solution,
        cells: state.cells.map((cell) => ({
          value: cell.value,
          fixed: cell.fixed,
          notes: [...cell.notes].sort((a, b) => a - b),
        })),
        noteMode: state.noteMode,
        selectedDigit: state.selectedDigit,
        elapsedSeconds: state.elapsedSeconds,
        completed: state.completed,
      }),
    );
    localStorage.setItem(STORAGE_KEYS.lang, language);
  } catch {
    // ignore storage access errors
  }
}

async function startNewGame(difficulty: Difficulty): Promise<void> {
  state = {
    ...createEmptyState(difficulty),
    generating: true,
    messageKey: 'loading',
  };
  render();

  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

  const { puzzle, solution } = generatePuzzleForDifficulty(difficulty);
  state = {
    difficulty,
    puzzle,
    solution,
    cells: createCellsFromPuzzle(puzzle),
    noteMode: false,
    selectedCell: null,
    selectedDigit: null,
    hintCell: null,
    hintScope: [],
    wrongCells: [],
    elapsedSeconds: 0,
    completed: false,
    generating: false,
    messageKey: 'resume',
  };

  persistGame();
  render();
}

function createCellsFromPuzzle(puzzle: number[]): CellState[] {
  return puzzle.map((value) => ({
    value,
    fixed: value !== 0,
    notes: [],
  }));
}

function handleLanguageSwitch(next: Lang): void {
  language = next;
  try {
    localStorage.setItem(STORAGE_KEYS.lang, language);
  } catch {
    // ignore storage access errors
  }
  render();
}

function handleCellClick(index: number): void {
  if (state.generating) {
    return;
  }

  syncSelectedDigitState();

  const cell = state.cells[index];
  state.selectedCell = index;
  state.hintCell = null;
  state.hintScope = [];

  if (!cell.fixed && state.selectedDigit !== null && !state.completed) {
    applyDigitToCell(index, state.selectedDigit);
    return;
  }

  render();
}

function handleDigitClick(digit: number): void {
  if (state.generating || state.completed) {
    return;
  }

  syncSelectedDigitState();

  if (getCompletedDigits().has(digit)) {
    state.messageKey = 'instructions';
    persistGame();
    render();
    return;
  }

  if (state.selectedDigit === digit) {
    state.selectedDigit = null;
    state.messageKey = 'instructions';
    persistGame();
    render();
    return;
  }

  state.selectedDigit = digit;

  if (state.selectedCell !== null) {
    applyDigitToCell(state.selectedCell, digit);
  } else {
    state.messageKey = 'instructions';
    persistGame();
    render();
  }
}

function handleClear(): void {
  if (state.generating || state.completed || state.selectedCell === null) {
    return;
  }

  state.selectedDigit = null;
  applyDigitToCell(state.selectedCell, 0);
}

function applyDigitToCell(index: number, digit: number): void {
  const cell = state.cells[index];
  if (!cell || cell.fixed || state.completed) {
    render();
    return;
  }

  state.selectedCell = index;
  state.hintCell = null;
  state.hintScope = [];
  state.wrongCells = [];

  if (state.noteMode && digit !== 0) {
    if (cell.value !== 0) {
      cell.value = 0;
    }
    cell.notes = cell.notes.includes(digit)
      ? cell.notes.filter((note) => note !== digit)
      : [...cell.notes, digit].sort((a, b) => a - b);
  } else {
    cell.value = digit;
    cell.notes = [];
  }

  state.messageKey = 'instructions';
  checkCompletion();
  syncSelectedDigitState();
  persistGame();
  render();
}

function toggleNoteMode(): void {
  if (state.generating) {
    return;
  }

  state.noteMode = !state.noteMode;
  state.messageKey = 'instructions';
  persistGame();
  render();
}

function restartPuzzle(): void {
  if (state.generating || state.puzzle.length !== 81) {
    return;
  }

  state.cells = createCellsFromPuzzle(state.puzzle);
  state.noteMode = false;
  state.selectedCell = null;
  state.selectedDigit = null;
  state.hintCell = null;
  state.hintScope = [];
  state.wrongCells = [];
  state.elapsedSeconds = 0;
  state.completed = false;
  state.messageKey = 'restarted';
  persistGame();
  render();
}

function showHint(): void {
  if (state.generating) {
    return;
  }

  state.wrongCells = getWrongCells();
  if (state.wrongCells.length > 0) {
    state.hintCell = null;
    state.hintScope = [];
    state.messageKey = 'hintResultWrong';
    render();
    return;
  }

  const sanitized = sanitizeBoardForHints(getValuesFromCells(state.cells));
  const move = collectLogicalMoves(sanitized)[0] ?? null;
  state.hintCell = move?.index ?? null;
  state.hintScope = move?.highlightIndices ?? [];
  state.messageKey = getHintMessageKey(move);
  render();
}

function getHintMessageKey(move: LogicalMove | null): MessageKey {
  if (!move) {
    return 'hintResultNone';
  }

  switch (move.reason) {
    case 'row':
      return 'hintFocusRow';
    case 'column':
      return 'hintFocusColumn';
    case 'box':
      return 'hintFocusBox';
    case 'single':
    default:
      return 'hintResultCell';
  }
}

function getWrongCells(): number[] {
  return state.cells.flatMap((cell, index) => {
    if (!cell.fixed && cell.value !== 0 && cell.value !== state.solution[index]) {
      return [index];
    }
    return [];
  });
}

function sanitizeBoardForHints(values: number[]): number[] {
  return values.map((value, index) => (value !== 0 && value !== state.solution[index] ? 0 : value));
}

function getValuesFromCells(cells: CellState[]): number[] {
  return cells.map((cell) => cell.value);
}

function checkCompletion(): void {
  const solved = state.cells.every((cell, index) => cell.value === state.solution[index]);
  if (!solved) {
    state.completed = false;
    return;
  }

  if (!state.completed) {
    state.completed = true;
    stats[state.difficulty] += 1;
    persistStats();
    state.messageKey = 'puzzleComplete';
  }
}

function handleKeydown(event: KeyboardEvent): void {
  const target = event.target as HTMLElement | null;
  if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
    return;
  }

  if (state.generating) {
    return;
  }

  if (event.key >= '1' && event.key <= '9') {
    event.preventDefault();
    handleDigitClick(Number(event.key));
    return;
  }

  if (event.key === 'Backspace' || event.key === 'Delete' || event.key === '0') {
    event.preventDefault();
    handleClear();
    return;
  }

  if (event.key.toLowerCase() === 'n') {
    event.preventDefault();
    toggleNoteMode();
    return;
  }

  if (state.selectedCell === null) {
    return;
  }

  const row = Math.floor(state.selectedCell / 9);
  const col = state.selectedCell % 9;
  let nextRow = row;
  let nextCol = col;

  switch (event.key) {
    case 'ArrowUp':
      nextRow = (row + 8) % 9;
      break;
    case 'ArrowDown':
      nextRow = (row + 1) % 9;
      break;
    case 'ArrowLeft':
      nextCol = (col + 8) % 9;
      break;
    case 'ArrowRight':
      nextCol = (col + 1) % 9;
      break;
    default:
      return;
  }

  event.preventDefault();
  state.selectedCell = nextRow * 9 + nextCol;
  render();
}

function render(): void {
  const filledCount = state.cells.filter((cell) => cell.value !== 0).length;
  const completedDigits = getCompletedDigits();
  const selectionValue = state.selectedDigit ?? null;
  const selectedLabel = selectionValue !== null ? selectionValue : t('noSelection');

  app.innerHTML = `
    <div class="shell">
      <section class="panel hero">
        <div>
          <h1>${t('title')}</h1>
          <p>${t('subtitle')}</p>
        </div>
        <div class="lang-switch" aria-label="language switcher">
          <button class="${language === 'ja' ? 'active' : ''}" data-lang="ja">JP</button>
          <button class="${language === 'en' ? 'active' : ''}" data-lang="en">EN</button>
        </div>
      </section>

      <section class="panel controls-grid">
        <div class="controls-row controls-top-row">
          ${DIFFICULTIES.map(
            (difficulty) => `
              <button class="difficulty-btn ${state.difficulty === difficulty ? 'active' : ''}" data-difficulty="${difficulty}">
                ${difficultyLabel(difficulty)}
              </button>
            `,
          ).join('')}
          <button class="action-btn" data-action="hint">${t('hint')}</button>
          <button class="action-btn" data-action="restart">${t('restart')}</button>
          <button class="action-btn" data-action="new">${t('newGame')}</button>
        </div>
      </section>

      <section class="game-layout">
        <section class="panel board-card">
          <div class="meta-grid">
            <div class="info-card">
              <span>${t('currentDifficulty')}</span>
              <strong>${difficultyLabel(state.difficulty)}</strong>
            </div>
            <div class="info-card">
              <span>${t('timer')}</span>
              <strong data-role="timer-value">${formatTime(state.elapsedSeconds)}</strong>
            </div>
            <div class="info-card">
              <span>${t('progress')}</span>
              <strong>${filledCount} / 81</strong>
            </div>
          </div>

          ${state.generating ? `<div class="loading-card">${t('loading')}</div>` : renderBoard()}

          <div class="digit-pad">
            ${DIGITS.map((digit) => {
              const isDisabled = completedDigits.has(digit);
              return `
                <button
                  class="digit-btn ${state.selectedDigit === digit ? 'active' : ''}"
                  data-digit="${digit}"
                  ${isDisabled ? 'disabled' : ''}
                >
                  ${digit}
                </button>
              `;
            }).join('')}
          </div>

          <div class="secondary-pad">
            <button class="action-btn ${state.noteMode ? 'active' : ''}" data-action="note">
              ${t('noteMode')}: ${state.noteMode ? t('on') : t('off')}
            </button>
            <button class="action-btn" data-action="clear">${t('clear')}</button>
          </div>

          <p class="message">
            <strong>${state.completed ? t('solved') : `${t('selected')}: ${selectedLabel}`}</strong><br />
            ${t(state.messageKey)}
          </p>
        </section>

        <aside class="panel">
          <div class="stats-grid">
            ${DIFFICULTIES.map(
              (difficulty) => `
                <div class="stat-card">
                  <span>${difficultyLabel(difficulty)}</span>
                  <strong>${stats[difficulty]} ${t('solvedCount')}</strong>
                </div>
              `,
            ).join('')}
          </div>

          <p class="notice">${t('keyboard')}</p>
          <p class="notice">${t('privacy')}</p>
          <div class="footer-note">
            <span class="pill">HTML + TypeScript</span>
            <span class="pill">localStorage only</span>
            <span class="pill">Cloudflare Pages ready</span>
          </div>
        </aside>
      </section>
    </div>
  `;

  bindEvents();
}

function renderBoard(): string {
  const selectedValue = state.selectedDigit ?? (state.selectedCell !== null ? state.cells[state.selectedCell]?.value || null : null);

  return `
    <div class="board" role="grid" aria-label="Sudoku board">
      ${state.cells
        .map((cell, index) => {
          const row = Math.floor(index / 9);
          const col = index % 9;
          const related = state.selectedCell !== null && isRelatedCell(index, state.selectedCell);
          const matching = selectedValue !== null && cell.value === selectedValue && selectedValue !== 0;
          const classes = [
            'cell',
            cell.fixed ? 'fixed' : 'editable',
            related ? 'related' : '',
            matching ? 'matching' : '',
            state.selectedCell === index ? 'selected' : '',
            state.hintScope.includes(index) ? 'hint-scope' : '',
            state.hintCell === index ? 'hint' : '',
            state.wrongCells.includes(index) ? 'wrong' : '',
            col === 2 || col === 5 ? 'box-right' : '',
            row === 2 || row === 5 ? 'box-bottom' : '',
          ]
            .filter(Boolean)
            .join(' ');

          return `
            <button class="${classes}" data-cell="${index}" aria-label="row ${row + 1}, column ${col + 1}">
              ${cell.value !== 0 ? `<span class="cell-value">${cell.value}</span>` : renderNotes(cell.notes)}
            </button>
          `;
        })
        .join('')}
    </div>
  `;
}

function renderNotes(notes: number[]): string {
  const noteSet = new Set(notes);
  return `
    <div class="notes">
      ${DIGITS.map((digit) => `<span>${noteSet.has(digit) ? digit : ''}</span>`).join('')}
    </div>
  `;
}

function bindEvents(): void {
  app.querySelectorAll<HTMLButtonElement>('[data-lang]').forEach((button) => {
    button.addEventListener('click', () => {
      const next = button.dataset.lang === 'en' ? 'en' : 'ja';
      handleLanguageSwitch(next);
    });
  });

  app.querySelectorAll<HTMLButtonElement>('[data-difficulty]').forEach((button) => {
    button.addEventListener('click', () => {
      const difficulty = button.dataset.difficulty as Difficulty;
      void startNewGame(difficulty);
    });
  });

  app.querySelectorAll<HTMLButtonElement>('[data-cell]').forEach((button) => {
    button.addEventListener('click', () => {
      const index = Number(button.dataset.cell ?? '-1');
      if (index >= 0) {
        handleCellClick(index);
      }
    });
  });

  app.querySelectorAll<HTMLButtonElement>('[data-digit]').forEach((button) => {
    button.addEventListener('click', () => {
      const digit = Number(button.dataset.digit ?? '0');
      if (digit >= 1 && digit <= 9) {
        handleDigitClick(digit);
      }
    });
  });

  app.querySelectorAll<HTMLButtonElement>('[data-action]').forEach((button) => {
    button.addEventListener('click', () => {
      switch (button.dataset.action) {
        case 'new':
          void startNewGame(state.difficulty);
          break;
        case 'restart':
          restartPuzzle();
          break;
        case 'note':
          toggleNoteMode();
          break;
        case 'hint':
          showHint();
          break;
        case 'clear':
          handleClear();
          break;
        default:
          break;
      }
    });
  });
}

function syncSelectedDigitState(): void {
  if (state.selectedDigit !== null && getCompletedDigits().has(state.selectedDigit)) {
    state.selectedDigit = null;
  }
}

function getCompletedDigits(): Set<number> {
  const completed = new Set<number>();

  if (state.solution.length !== 81) {
    return completed;
  }

  for (const digit of DIGITS) {
    const correctCount = state.cells.reduce((count, cell, index) => {
      return count + Number(cell.value === digit && state.solution[index] === digit);
    }, 0);

    if (correctCount >= 9) {
      completed.add(digit);
    }
  }

  return completed;
}

function isRelatedCell(index: number, selected: number): boolean {
  const row = Math.floor(index / 9);
  const col = index % 9;
  const selectedRow = Math.floor(selected / 9);
  const selectedCol = selected % 9;
  const box = Math.floor(row / 3) * 3 + Math.floor(col / 3);
  const selectedBox = Math.floor(selectedRow / 3) * 3 + Math.floor(selectedCol / 3);
  return row === selectedRow || col === selectedCol || box === selectedBox;
}

function updateElapsedTimeUI(): void {
  const timerValue = app.querySelector<HTMLElement>('[data-role="timer-value"]');
  if (timerValue) {
    timerValue.textContent = formatTime(state.elapsedSeconds);
  }
}

function formatTime(seconds: number): string {
  const safe = Math.max(0, seconds);
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  return hrs > 0
    ? `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    : `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function buildUnits(): number[][] {
  const units: number[][] = [];

  for (let row = 0; row < 9; row += 1) {
    units.push(Array.from({ length: 9 }, (_, col) => row * 9 + col));
  }

  for (let col = 0; col < 9; col += 1) {
    units.push(Array.from({ length: 9 }, (_, row) => row * 9 + col));
  }

  for (let boxRow = 0; boxRow < 3; boxRow += 1) {
    for (let boxCol = 0; boxCol < 3; boxCol += 1) {
      const unit: number[] = [];
      for (let row = 0; row < 3; row += 1) {
        for (let col = 0; col < 3; col += 1) {
          unit.push((boxRow * 3 + row) * 9 + boxCol * 3 + col);
        }
      }
      units.push(unit);
    }
  }

  return units;
}

function buildPeers(): number[][] {
  return Array.from({ length: 81 }, (_, index) => {
    const peers = new Set<number>();
    for (const unit of UNITS) {
      if (!unit.includes(index)) {
        continue;
      }
      for (const peer of unit) {
        if (peer !== index) {
          peers.add(peer);
        }
      }
    }
    return [...peers];
  });
}

function generatePuzzleForDifficulty(difficulty: Difficulty): { puzzle: number[]; solution: number[] } {
  const config = DIFFICULTY_SETTINGS[difficulty];
  let best: { puzzle: number[]; solution: number[]; score: number } | null = null;

  for (let attempt = 0; attempt < config.attempts; attempt += 1) {
    const solution = generateSolvedBoard();
    const targetClues = randomBetween(config.clues[0], config.clues[1]);
    const puzzle = carvePuzzle(solution, targetClues);
    const analysis = analyzePuzzle(puzzle);
    const score = scoreDifficulty(difficulty, analysis, puzzle);

    if (!best || score > best.score) {
      best = { puzzle, solution, score };
    }

    if (matchesDifficulty(difficulty, analysis, puzzle)) {
      return { puzzle, solution };
    }
  }

  if (best) {
    return { puzzle: best.puzzle, solution: best.solution };
  }

  const fallbackSolution = generateSolvedBoard();
  return {
    puzzle: carvePuzzle(fallbackSolution, 34),
    solution: fallbackSolution,
  };
}

function generateSolvedBoard(): number[] {
  const board = Array<number>(81).fill(0);

  for (let box = 0; box < 3; box += 1) {
    const digits = shuffle([...DIGITS]);
    for (let row = 0; row < 3; row += 1) {
      for (let col = 0; col < 3; col += 1) {
        board[(box * 3 + row) * 9 + box * 3 + col] = digits[row * 3 + col];
      }
    }
  }

  solveBoard(board);
  return board;
}

function carvePuzzle(solution: number[], targetClues: number): number[] {
  const puzzle = solution.slice();
  let clues = 81;
  const pairs: Array<[number, number]> = [];
  const seen = new Set<number>();

  for (let index = 0; index < 81; index += 1) {
    if (seen.has(index)) {
      continue;
    }
    const mirror = 80 - index;
    seen.add(index);
    seen.add(mirror);
    pairs.push([index, mirror]);
  }

  shuffle(pairs);

  for (const [a, b] of pairs) {
    if (clues <= targetClues) {
      break;
    }

    const removed = a === b ? 1 : 2;
    if (clues - removed < targetClues) {
      continue;
    }

    const backupA = puzzle[a];
    const backupB = puzzle[b];
    puzzle[a] = 0;
    if (a !== b) {
      puzzle[b] = 0;
    }

    if (countSolutions(puzzle, 2) !== 1) {
      puzzle[a] = backupA;
      if (a !== b) {
        puzzle[b] = backupB;
      }
    } else {
      clues -= removed;
    }
  }

  if (clues > targetClues) {
    const singles = shuffle(Array.from({ length: 81 }, (_, index) => index));
    for (const index of singles) {
      if (clues <= targetClues || puzzle[index] === 0) {
        continue;
      }

      const backup = puzzle[index];
      puzzle[index] = 0;
      if (countSolutions(puzzle, 2) !== 1) {
        puzzle[index] = backup;
      } else {
        clues -= 1;
      }
    }
  }

  return puzzle;
}

function solveBoard(board: number[]): boolean {
  const { index, candidates } = findBestCell(board);
  if (index === -1) {
    return true;
  }

  if (candidates.length === 0) {
    return false;
  }

  for (const candidate of shuffle([...candidates])) {
    board[index] = candidate;
    if (solveBoard(board)) {
      return true;
    }
  }

  board[index] = 0;
  return false;
}

function countSolutions(board: number[], limit = 2): number {
  const work = board.slice();
  let count = 0;

  const search = (): void => {
    if (count >= limit) {
      return;
    }

    const { index, candidates } = findBestCell(work);
    if (index === -1) {
      count += 1;
      return;
    }

    if (candidates.length === 0) {
      return;
    }

    for (const candidate of candidates) {
      work[index] = candidate;
      search();
      if (count >= limit) {
        break;
      }
    }

    work[index] = 0;
  };

  search();
  return count;
}

function findBestCell(board: number[]): { index: number; candidates: number[] } {
  let bestIndex = -1;
  let bestCandidates: number[] = [];

  for (let index = 0; index < 81; index += 1) {
    if (board[index] !== 0) {
      continue;
    }

    const candidates = getCandidates(board, index);
    if (candidates.length === 0) {
      return { index, candidates };
    }

    if (bestIndex === -1 || candidates.length < bestCandidates.length) {
      bestIndex = index;
      bestCandidates = candidates;
      if (candidates.length === 1) {
        break;
      }
    }
  }

  return { index: bestIndex, candidates: bestCandidates };
}

function getCandidates(board: number[], index: number): number[] {
  if (board[index] !== 0) {
    return [];
  }

  const blocked = new Set<number>();
  for (const peer of PEERS[index]) {
    const value = board[peer];
    if (value !== 0) {
      blocked.add(value);
    }
  }

  return DIGITS.filter((digit) => !blocked.has(digit));
}

function analyzePuzzle(puzzle: number[]): DifficultyAnalysis {
  const work = puzzle.slice();
  let currentMoves = collectLogicalMoves(work);
  const initialSingles = currentMoves.length;
  let totalSingles = 0;

  while (currentMoves.length > 0) {
    for (const move of currentMoves) {
      if (work[move.index] === 0) {
        work[move.index] = move.value;
        totalSingles += 1;
      }
    }
    currentMoves = collectLogicalMoves(work);
  }

  const remainingCandidates = work
    .map((value, index) => (value === 0 ? getCandidates(work, index).length : 0))
    .filter((count) => count > 0);

  return {
    initialSingles,
    totalSingles,
    solvedByLogic: !work.includes(0),
    stalled: work.includes(0),
    minRemainingCandidates: remainingCandidates.length > 0 ? Math.min(...remainingCandidates) : 0,
    emptyCells: work.filter((value) => value === 0).length,
  };
}

function collectLogicalMoves(board: number[]): LogicalMove[] {
  const candidateMap = new Map<number, number[]>();
  const moveMap = new Map<number, LogicalMove>();

  for (let index = 0; index < 81; index += 1) {
    if (board[index] !== 0) {
      continue;
    }
    const candidates = getCandidates(board, index);
    candidateMap.set(index, candidates);
    if (candidates.length === 1) {
      moveMap.set(index, {
        index,
        value: candidates[0],
        reason: 'single',
        highlightIndices: [index],
      });
    }
  }

  for (const [unitIndex, unit] of UNITS.entries()) {
    for (const digit of DIGITS) {
      const slots = unit.filter((index) => candidateMap.get(index)?.includes(digit));
      if (slots.length === 1) {
        moveMap.set(slots[0], {
          index: slots[0],
          value: digit,
          reason: getUnitReason(unitIndex),
          highlightIndices: [...unit],
        });
      }
    }
  }

  return [...moveMap.values()];
}

function getUnitReason(unitIndex: number): LogicalMove['reason'] {
  if (unitIndex < 9) {
    return 'row';
  }
  if (unitIndex < 18) {
    return 'column';
  }
  return 'box';
}

function matchesDifficulty(difficulty: Difficulty, analysis: DifficultyAnalysis, puzzle: number[]): boolean {
  const clues = countFilled(puzzle);

  switch (difficulty) {
    case 'easy':
      return clues >= 40 && clues <= 44 && analysis.solvedByLogic && analysis.initialSingles >= 4;
    case 'medium':
      return clues >= 33 && clues <= 36 && analysis.solvedByLogic && analysis.initialSingles >= 2 && analysis.initialSingles <= 8;
    case 'hard':
      return clues >= 28 && clues <= 31 && analysis.initialSingles <= 3 && (analysis.stalled || analysis.totalSingles >= 10);
    case 'expert':
      return clues >= 23 && clues <= 25 && analysis.initialSingles <= 1 && analysis.stalled && analysis.minRemainingCandidates >= 2;
    default:
      return true;
  }
}

function scoreDifficulty(difficulty: Difficulty, analysis: DifficultyAnalysis, puzzle: number[]): number {
  const clues = countFilled(puzzle);

  switch (difficulty) {
    case 'easy':
      return (analysis.solvedByLogic ? 40 : 0) + Math.max(0, 10 - Math.abs(clues - 42) * 2) + Math.min(analysis.initialSingles, 10);
    case 'medium':
      return (analysis.solvedByLogic ? 30 : 0) + Math.max(0, 10 - Math.abs(clues - 35) * 2) + Math.max(0, 8 - Math.abs(analysis.initialSingles - 4));
    case 'hard':
      return (analysis.stalled ? 30 : 0) + Math.max(0, 10 - Math.abs(clues - 29) * 2) + Math.max(0, 6 - analysis.initialSingles);
    case 'expert':
      return (analysis.stalled ? 50 : 0) + Math.max(0, 12 - Math.abs(clues - 24) * 3) + Math.max(0, 8 - analysis.initialSingles * 3) + analysis.minRemainingCandidates;
    default:
      return 0;
  }
}

function countFilled(board: number[]): number {
  return board.reduce((count, value) => count + Number(value !== 0), 0);
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle<T>(items: T[]): T[] {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }
  return items;
}
