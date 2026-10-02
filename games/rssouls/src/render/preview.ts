import * as THREE from 'three';
import type { GamePreview } from '@pv/game-api';
import { aspect, texture } from './images';

/**
 * The menu tile: the survivor facing a rust spinner in front of the Rosttal, the spinner blinking
 * its telegraph. Built from the game's own pictures; flat shapes where a picture is missing.
 */
export function rssoulsPreview(): GamePreview {
  const group = new THREE.Group();
  const sprite = (id: string, h: number, fallback: string) => {
    const tex = texture(id);
    const w = tex ? h * aspect(id) : h * 0.45;
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      tex ? new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.04 }) : new THREE.MeshBasicMaterial({ color: fallback }),
    );
    m.geometry.translate(0, h / 2, 0);
    return m;
  };
  const back = texture('far_rosttal');
  const bg = new THREE.Mesh(
    new THREE.PlaneGeometry(4.2, 4.2 / aspect('far_rosttal')),
    back ? new THREE.MeshBasicMaterial({ map: back, color: '#9a948c' }) : new THREE.MeshBasicMaterial({ color: '#1f2026' }),
  );
  bg.position.set(0, 0.55, -0.2);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 0.25), new THREE.MeshBasicMaterial({ color: '#2c2723' }));
  ground.position.set(0, -0.12, -0.1);
  const hero = sprite('spr_hero', 1.05, '#d8d2c4');
  hero.position.set(-0.75, 0, 0);
  const spinner = sprite('spr_rost-spinner', 0.5, '#8a4b2a');
  spinner.position.set(0.8, 0, 0);
  spinner.scale.x = -1;
  const mark = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.12), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
  mark.rotation.z = Math.PI / 4;
  mark.position.set(0.8, 0.75, 0.05);
  group.add(bg, ground, hero, spinner, mark);

  let t = 0;
  const spinMat = spinner.material as THREE.MeshBasicMaterial;
  return {
    group,
    spin: 0,
    update(dt) {
      t = (t + dt) % 2.4;
      // a breath for the hero, a telegraph for the spinner, then its lunge
      hero.position.y = Math.sin(t * Math.PI) * 0.01;
      const tell = t > 1 && t < 1.6;
      mark.visible = tell;
      const on = tell && Math.sin(t * 40) > 0;
      spinMat.color.setRGB(on ? 2.2 : 1, on ? 2.2 : 1, on ? 2 : 1);
      spinner.position.x = t > 1.6 && t < 1.8 ? 0.8 - (t - 1.6) * 2 : t >= 1.8 ? 0.4 + (t - 1.8) * 0.66 : 0.8;
    },
  };
}
