/** Motion preference (FR-080): OS reduced-motion, overridden by the persisted user toggle. */
export type MotionState = 'full' | 'reduced';
type UserChoice = 'paused' | 'playing';
type Listener = (state: MotionState) => void;

const STORAGE_KEY = 'timeline:motion';

function readChoice(): UserChoice | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'paused' || value === 'playing' ? value : null;
  } catch {
    return null;
  }
}

function writeChoice(choice: UserChoice): void {
  try {
    localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    // Private mode or blocked storage: the choice lasts for this session only.
  }
}

export class Motion {
  private readonly listeners = new Set<Listener>();
  private readonly query = matchMedia('(prefers-reduced-motion: reduce)');
  private choice: UserChoice | null = readChoice();

  constructor() {
    this.query.addEventListener('change', () => {
      this.apply();
    });
    this.apply();
  }

  get state(): MotionState {
    const choice = this.choice ?? (this.query.matches ? 'paused' : 'playing');
    return choice === 'paused' ? 'reduced' : 'full';
  }

  get paused(): boolean {
    return this.state === 'reduced';
  }

  setPaused(paused: boolean): void {
    this.choice = paused ? 'paused' : 'playing';
    writeChoice(this.choice);
    this.apply();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private apply(): void {
    document.documentElement.dataset['motion'] = this.state;
    for (const listener of this.listeners) listener(this.state);
  }
}

let instance: Motion | undefined;

/** Page-wide singleton, created on first use so tests can control matchMedia first. */
export function getMotion(): Motion {
  instance ??= new Motion();
  return instance;
}
