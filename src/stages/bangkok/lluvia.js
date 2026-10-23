// Lluvia de monzón: miles de gotas en UN solo LineSegments animado en el shader
// (la caja de lluvia sigue a la cámara envolviéndose, así no hay que mover nada en la CPU).
import * as THREE from 'three';

export function createRain(scene, count) {
  const BOX = 70, H = 34;
  const off = new Float32Array(count * 2 * 3), end = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const x = Math.random() * BOX, y = Math.random() * H, z = Math.random() * BOX;
    off.set([x, y, z, x, y, z], i * 6);
    end[i * 2] = 0; end[i * 2 + 1] = 1;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(off, 3));
  geo.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uT: { value: 0 }, uCam: { value: new THREE.Vector3() }, uBox: { value: BOX }, uH: { value: H }, uOp: { value: 0.42 } },
    vertexShader: `
      attribute float aEnd; uniform float uT; uniform vec3 uCam; uniform float uBox; uniform float uH; varying float vA;
      void main(){
        vec3 p = position;
        p.y = mod(p.y - uT * 38.0, uH);
        p.x = mod(p.x - uCam.x + uT * 3.0, uBox) - uBox * 0.5 + uCam.x;
        p.z = mod(p.z - uCam.z, uBox) - uBox * 0.5 + uCam.z;
        p += vec3(-0.12, 1.25, 0.0) * aEnd;
        vA = mix(0.0, 1.0, aEnd);
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: 'uniform float uOp; varying float vA; void main(){ gl_FragColor = vec4(0.75, 0.85, 1.0, uOp * (0.3 + vA * 0.7)); }',
  });
  const lines = new THREE.LineSegments(geo, mat);
  lines.frustumCulled = false;
  scene.add(lines);
  return {
    mesh: lines,
    update(t, cam) { mat.uniforms.uT.value = t; mat.uniforms.uCam.value.copy(cam); },
    dispose() { scene.remove(lines); geo.dispose(); mat.dispose(); },
  };
}
