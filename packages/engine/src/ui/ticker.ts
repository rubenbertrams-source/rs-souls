/** Per-simulation-tick callbacks for UI components (menus read input edges here). */
export class Ticker {
  private fns = new Set<(dt: number) => void>();
  on(fn: (dt: number) => void) {
    this.fns.add(fn);
    return () => {
      this.fns.delete(fn);
    };
  }
  emit(dt: number) {
    for (const f of [...this.fns]) f(dt);
  }
}
