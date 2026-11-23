/** Feedback cannot outlive either five seconds or the code that was copied. */
export function copiedUntil(at:number){return Math.min(at+5000,(Math.floor(at/30000)+1)*30000);}
