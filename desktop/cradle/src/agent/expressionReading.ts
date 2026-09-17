/** Pure completion cursor over owner block IDs. Pagination can never lower it. */
export function advanceCompletion(prior:number|undefined,observed:number|undefined) {
 return {
  highWater:observed===undefined?prior:Math.max(prior??observed,observed),
  arrived:prior!==undefined&&observed!==undefined&&observed>prior,
 };
}
