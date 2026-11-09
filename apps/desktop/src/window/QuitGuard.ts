export class QuitGuard {
  count = 0;
  confirmed = false;
  private pending: Promise<boolean> | undefined;

  get canExit() {
    return this.confirmed || this.count === 0;
  }

  confirm(prompt: (count: number) => Promise<boolean>): Promise<boolean> {
    if (this.canExit) return Promise.resolve(true);
    return (this.pending ??= prompt(this.count)
      .then((confirmed) => {
        this.confirmed = confirmed;
        return confirmed;
      })
      .finally(() => {
        this.pending = undefined;
      }));
  }
}
