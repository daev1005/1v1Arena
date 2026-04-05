export function tickTimer(timer, delta) {
    return Math.max(0, timer - delta);
}
