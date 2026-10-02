import { windupOf } from '../core/attack';
import type { Sim } from '../core/sim';
import { NO_COMMAND, type Command } from '../core/types';

/**
 * A plain demo player for the hero: walks up, swings, parries the bite, rolls away from the pounce.
 *
 * It exists for the tests and the hub's autoplay (`humans=0&cpus=1`), not as an opponent, so it
 * reads the simulation directly. Pure: same sim, same command.
 */
export class HeroBot {
  private attackHeld = false;
  private rollHeld = false;
  private jumpHeld = false;

  think(sim: Sim): Command {
    const hero = sim.hero;
    const cmd: Command = { ...NO_COMMAND };
    if (!hero.alive) return cmd;
    let best = -1;
    let bestD = Infinity;
    sim.enemies.forEach((e, i) => {
      const d = Math.abs(e.body.x - hero.body.x) + Math.abs(e.body.y - hero.body.y) * 2;
      if (e.alive && d < bestD) {
        bestD = d;
        best = i;
      }
    });
    const e = sim.enemies[best];
    if (!e) {
      // nothing left to fight: walk on east, hop over what is in the way, wait out a rest
      if (hero.state === 'rest') return cmd;
      cmd.x = 1;
      cmd.jump = hero.body.wallR && hero.body.onGround ? !this.jumpHeld : hero.body.vy > 0;
      this.jumpHeld = cmd.jump;
      return cmd;
    }
    const dx = e.body.x - hero.body.x;
    const dist = Math.abs(dx);
    const toward = Math.sign(dx) || 1;
    const run = e.state === 'attack' ? e.attack : null;
    const left = run ? windupOf(run) - run.t : 0;

    if (run && left > 0 && dist < 260) {
      if (run.def.parryable && dist < 110) {
        // raise the guard just before the bite lands: the opening of the block is the parry
        cmd.x = toward * 0.1;
        cmd.block = left < 0.1;
        return cmd;
      }
      if (!run.def.parryable && left < 0.2) {
        cmd.x = -toward;
        cmd.roll = !this.rollHeld;
        this.rollHeld = cmd.roll;
        return cmd;
      }
    }
    this.rollHeld = false;

    if (dist <= 62 && Math.abs(e.body.y - hero.body.y) < 30) {
      cmd.x = toward * 0.4;
      if (hero.stamina > 26 && (e.state !== 'attack' || e.attack === null)) {
        cmd.attack = !this.attackHeld;
      }
      this.attackHeld = cmd.attack;
      return cmd;
    }
    this.attackHeld = false;
    cmd.x = toward;
    // the spinner on the high platform: jump up after it
    if (e.body.y - hero.body.y > 60 && dist < 160 && hero.body.onGround) cmd.jump = true;
    return cmd;
  }
}
