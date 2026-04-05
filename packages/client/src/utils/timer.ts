export function tickTimer(timer: number, delta: number): number {
    return Math.max(0, timer - delta);
}
