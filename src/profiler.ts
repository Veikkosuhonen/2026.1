export const Profiler = {
  marks: {} as Record<string, number>,
  measures: {} as Record<string, number>,

  start(name: string) {
    this.marks[name] = performance.now()
  },

  end(name: string) {
    this.measures[name] = performance.now() - this.marks[name]
  }
}